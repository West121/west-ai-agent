from __future__ import annotations

from collections.abc import Mapping
import re
from typing import Any, Protocol

from app.sinks import MinioObjectStorageSink, OpenSearchIndexSink, WorkerSinks, build_worker_sinks

def run_smoke_job() -> str:
    return "worker-jobs smoke job completed"


class SearchIndexSink(Protocol):
    provider: str

    def index_documents(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        ...


class InMemorySearchIndexSink:
    provider = "in_memory"

    def __init__(self) -> None:
        self.documents: list[dict[str, Any]] = []
        self.payloads: list[dict[str, Any]] = []

    def index_documents(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        payload_dict = dict(payload)
        self.payloads.append(payload_dict)
        documents = [dict(document) for document in payload_dict.get("documents", [])]
        self.documents.extend(documents)
        return {
            "provider": self.provider,
            "indexed_count": len(documents),
            "document_id": payload_dict.get("document_id", ""),
        }


def _normalize_raw_faq_content(raw_content: str) -> list[dict[str, str]]:
    normalized = raw_content.replace("\r\n", "\n").strip()
    if not normalized:
        return []

    blocks = [block.strip() for block in re.split(r"\n\s*\n", normalized) if block.strip()]
    items: list[dict[str, str]] = []
    for block in blocks:
        question = ""
        answer_lines: list[str] = []
        for line in [segment.strip() for segment in block.splitlines() if segment.strip()]:
            if not question and re.match(r"^(q|问)\s*[:：]", line, flags=re.IGNORECASE):
                question = re.sub(r"^(q|问)\s*[:：]\s*", "", line, flags=re.IGNORECASE).strip()
                continue
            if re.match(r"^(a|答)\s*[:：]", line, flags=re.IGNORECASE):
                answer_lines.append(re.sub(r"^(a|答)\s*[:：]\s*", "", line, flags=re.IGNORECASE).strip())
                continue
            if not question:
                question = line
            else:
                answer_lines.append(line)
        if question:
            items.append({"question": question, "answer": "\n".join(answer_lines).strip()})
    return items


def _extract_keywords(text: str) -> list[str]:
    normalized = re.sub(r"[^\w\u4e00-\u9fff]+", " ", text.lower())
    keywords: list[str] = []
    for token in normalized.split():
        if len(token) >= 2 and token not in keywords:
            keywords.append(token)
        if re.fullmatch(r"[\u4e00-\u9fff]+", token):
            max_window = min(len(token), 4)
            for window in range(2, max_window + 1):
                for index in range(0, len(token) - window + 1):
                    candidate = token[index : index + window]
                    if candidate not in keywords:
                        keywords.append(candidate)
    return keywords


def _normalize_markdown_sections(raw_content: str) -> list[dict[str, Any]]:
    normalized = raw_content.replace("\r\n", "\n").strip()
    if not normalized:
        return []

    sections: list[dict[str, Any]] = []
    title_path: list[str] = []
    current_lines: list[str] = []

    def flush_current() -> None:
        if not current_lines:
            return
        content = "\n".join(current_lines).strip()
        if not content:
            current_lines.clear()
            return
        sections.append(
            {
                "title_path": list(title_path),
                "content": content,
                "keywords": _extract_keywords(" ".join([*title_path, content])),
            }
        )
        current_lines.clear()

    for line in normalized.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        match = re.match(r"^(#{1,6})\s+(.+)$", stripped)
        if match:
            flush_current()
            level = len(match.group(1))
            heading = match.group(2).strip()
            title_path = title_path[: level - 1]
            title_path.append(heading)
            continue
        current_lines.append(stripped)

    flush_current()

    if sections:
        return sections

    return [
        {
            "title_path": [],
            "content": normalized,
            "keywords": _extract_keywords(normalized),
        }
    ]


def document_parse(document: Mapping[str, Any]) -> dict[str, Any]:
    document_type = str(document.get("type", "article"))
    parsed: dict[str, Any] = {
        "document_id": str(document.get("id", document.get("document_id", ""))),
        "tenant_id": str(document.get("tenant_id", "")),
        "type": document_type,
        "title": str(document.get("title", "")),
        "category": str(document.get("category", "")),
        "tags": list(document.get("tags", [])),
        "language": str(document.get("language", "zh-CN")),
        "channels": list(document.get("channels", [])),
        "version": int(document.get("version", 1)),
        "publish_version": int(document.get("publish_version", 1)),
    }

    if document_type == "faq":
        faq_items = []
        raw_content = document.get("content", [])
        if isinstance(raw_content, str):
            content_items = _normalize_raw_faq_content(raw_content)
        else:
            content_items = list(raw_content)
        for item in content_items:
            faq_items.append(
                {
                    "question": str(item.get("question", "")),
                    "answer": str(item.get("answer", "")),
                }
            )
        parsed["faq_items"] = faq_items
        return parsed

    sections = []
    raw_sections = document.get("sections", [])
    if raw_sections:
        source_sections = list(raw_sections)
    else:
        source_sections = _normalize_markdown_sections(str(document.get("content", "")))
    for section in source_sections:
        sections.append(
            {
                "title_path": list(section.get("title_path", [])),
                "content": str(section.get("content", "")),
                "keywords": list(section.get("keywords", [])),
            }
        )
    parsed["sections"] = sections
    return parsed


def chunk_build(document: Mapping[str, Any]) -> list[dict[str, Any]]:
    document_id = str(document.get("document_id", ""))
    tenant_id = str(document.get("tenant_id", ""))
    document_type = str(document.get("type", "article"))
    title = str(document.get("title", ""))
    category = str(document.get("category", ""))
    tags = list(document.get("tags", []))
    language = str(document.get("language", "zh-CN"))
    channels = list(document.get("channels", []))
    version = int(document.get("version", 1))
    publish_version = int(document.get("publish_version", 1))

    if document_type == "faq":
        chunks: list[dict[str, Any]] = []
        for index, item in enumerate(document.get("faq_items", []), start=1):
            question = str(item.get("question", ""))
            answer = str(item.get("answer", ""))
            chunks.append(
                {
                    "id": f"{document_id}-faq-{index}",
                    "document_id": document_id,
                    "tenant_id": tenant_id,
                    "document_type": document_type,
                    "title": title,
                    "category": category,
                    "tags": tags,
                    "language": language,
                    "channels": channels,
                    "version": version,
                    "publish_version": publish_version,
                    "title_path": [question] if question else [],
                    "content": answer,
                    "keywords": [question.lower()] if question else [],
                    "metadata": {
                        "slice_type": "faq_item",
                        "question": question,
                    },
                }
            )
        return chunks

    chunks = []
    for index, section in enumerate(document.get("sections", []), start=1):
        title_path = list(section.get("title_path", []))
        chunks.append(
            {
                "id": f"{document_id}-slice-{index}",
                "document_id": document_id,
                "tenant_id": tenant_id,
                "document_type": document_type,
                "title": title,
                "category": category,
                "tags": tags,
                "language": language,
                "channels": channels,
                "version": version,
                "publish_version": publish_version,
                "title_path": title_path,
                "content": str(section.get("content", "")),
                "keywords": list(section.get("keywords", [])),
                "metadata": {
                    "slice_type": "article_section",
                    "section_index": index,
                },
            }
        )
    return chunks


def build_search_index_payload(payload: Mapping[str, Any]) -> dict[str, Any]:
    document_id = str(payload.get("document_id", ""))
    tenant_id = str(payload.get("tenant_id", ""))
    title = str(payload.get("title", ""))
    category = str(payload.get("category", ""))
    tags = list(payload.get("tags", []))
    language = str(payload.get("language", "zh-CN"))
    channels = list(payload.get("channels", []))
    version = int(payload.get("version", 1))
    publish_version = int(payload.get("publish_version", version))

    indexed_documents = []
    for chunk in payload.get("chunks", []):
        chunk_payload = {
            "chunk_id": str(chunk.get("id", "")),
            "document_id": document_id,
            "tenant_id": str(chunk.get("tenant_id", tenant_id)),
            "document_type": str(chunk.get("document_type", payload.get("type", "article"))),
            "title": title or str(chunk.get("title", "")),
            "category": str(chunk.get("category", category)),
            "tags": list(chunk.get("tags", tags)),
            "language": str(chunk.get("language", language)),
            "channels": list(chunk.get("channels", channels)),
            "version": int(chunk.get("version", version)),
            "publish_version": int(chunk.get("publish_version", publish_version)),
            "content": str(chunk.get("content", "")),
            "keywords": list(chunk.get("keywords", [])),
            "title_path": list(chunk.get("title_path", [])),
            "metadata": {
                **dict(chunk.get("metadata", {})),
                "tenant_id": str(chunk.get("tenant_id", tenant_id)),
                "publish_version": int(chunk.get("publish_version", publish_version)),
                "document_type": str(chunk.get("document_type", payload.get("type", "article"))),
            },
        }
        indexed_documents.append(chunk_payload)

    return {
        "document_id": document_id,
        "tenant_id": tenant_id,
        "title": title,
        "category": category,
        "tags": tags,
        "language": language,
        "channels": channels,
        "version": version,
        "publish_version": publish_version,
        "documents": indexed_documents,
    }


def search_index(payload: Mapping[str, Any], sink: SearchIndexSink | None = None) -> dict[str, Any]:
    built_payload = build_search_index_payload(payload)
    if sink is None:
        return {
            **built_payload,
            "sink": {
                "provider": "noop",
                "indexed_count": len(built_payload["documents"]),
            },
        }

    sink_result = sink.index_documents(built_payload)
    return {
        **built_payload,
        "sink": sink_result,
    }


def run_knowledge_index_job(
    document: Mapping[str, Any],
    sinks: WorkerSinks | None = None,
) -> dict[str, Any]:
    resolved_sinks = sinks or build_worker_sinks()
    parsed_document = document_parse(document)
    chunks = chunk_build(parsed_document)
    payload = build_search_index_payload({**parsed_document, "chunks": chunks})
    if hasattr(resolved_sinks.object_storage, "store_payload"):
        object_storage_result = resolved_sinks.object_storage.store_payload(
            f"{payload['document_id']}/search-index.json",
            payload,
        )
    else:
        object_storage_result = resolved_sinks.object_storage.store_json(payload)
    search_index_result = resolved_sinks.search_index.index_documents(payload)
    return {
        "document": parsed_document,
        "chunks": chunks,
        "payload": payload,
        "object_storage": object_storage_result,
        "search_index": search_index_result,
    }
