from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shlex
import subprocess
import tempfile
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.knowledge.models import KnowledgeDocument
from app.modules.knowledge.schemas import (
    KnowledgeDocumentCreate,
    KnowledgeDocumentImportRequest,
    KnowledgeIndexTaskResultRead,
    PublishVersionRequest,
)


def _not_found(document_id: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"knowledge document {document_id} not found")


def _load_document(db: Session, document_id: int) -> KnowledgeDocument:
    document = db.get(KnowledgeDocument, document_id)
    if document is None:
        raise _not_found(document_id)
    return document


def _default_worker_jobs_directory() -> Path:
    return Path(__file__).resolve().parents[4] / "worker-jobs"


def _build_worker_runner_command(input_path: Path) -> list[str]:
    configured_command = os.getenv("KNOWLEDGE_WORKER_JOBS_CMD", "").strip()
    if configured_command:
        return [*shlex.split(configured_command), "--input", str(input_path)]

    return [
        "uv",
        "run",
        "--directory",
        str(_default_worker_jobs_directory()),
        "worker-jobs",
        "--job",
        "knowledge-index",
        "--input",
        str(input_path),
    ]


def _parse_worker_output(stdout: str) -> dict[str, Any]:
    lines = [line.strip() for line in stdout.splitlines() if line.strip()]
    if not lines:
        raise RuntimeError("worker-jobs returned empty output")
    return json.loads(lines[-1])


def run_worker_knowledge_index_job(payload: dict[str, Any]) -> dict[str, Any]:
    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False)
            temp_path = Path(handle.name)

        command = _build_worker_runner_command(temp_path)
        completed = subprocess.run(
            command,
            capture_output=True,
            check=True,
            text=True,
        )
        return _parse_worker_output(completed.stdout)
    finally:
        if temp_path is not None and temp_path.exists():
            temp_path.unlink()


def _create_document(
    db: Session,
    data: KnowledgeDocumentCreate,
    *,
    source_kind: str,
    imported_at: datetime | None,
) -> KnowledgeDocument:
    document = KnowledgeDocument(
        tenant_id=data.tenant_id,
        type=data.type,
        title=data.title,
        source_kind=source_kind,
        status="draft",
        category=data.category,
        tags=data.tags,
        language=data.language,
        channels=data.channels,
        version=1,
        content=data.content,
        index_status="idle",
        indexed_chunk_count=0,
        imported_at=imported_at,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def create_knowledge_document(db: Session, data: KnowledgeDocumentCreate) -> KnowledgeDocument:
    return _create_document(db, data, source_kind="manual", imported_at=None)


def import_knowledge_document(db: Session, data: KnowledgeDocumentImportRequest) -> KnowledgeDocument:
    return _create_document(
        db,
        data,
        source_kind="imported",
        imported_at=datetime.now(timezone.utc),
    )


def list_knowledge_documents(db: Session) -> list[KnowledgeDocument]:
    return list(db.scalars(select(KnowledgeDocument).order_by(KnowledgeDocument.id)).all())


def get_knowledge_document(db: Session, document_id: int) -> KnowledgeDocument:
    return _load_document(db, document_id)


def submit_knowledge_document_for_review(db: Session, document_id: int) -> KnowledgeDocument:
    document = _load_document(db, document_id)
    if document.status != "draft":
        raise HTTPException(status_code=409, detail="knowledge document must be draft to submit for review")
    document.status = "in_review"
    db.commit()
    db.refresh(document)
    return document


def publish_knowledge_document_version(db: Session, document_id: int, data: PublishVersionRequest) -> KnowledgeDocument:
    document = _load_document(db, document_id)
    if document.status != "in_review":
        raise HTTPException(status_code=409, detail="knowledge document must be in review to publish")
    document.status = "published"
    document.publish_version = data.publish_version
    document.version = data.publish_version
    document.published_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)
    return document


def rebuild_knowledge_document_index(db: Session, document_id: int) -> KnowledgeIndexTaskResultRead:
    document = _load_document(db, document_id)
    payload = {
        "id": document.id,
        "tenant_id": document.tenant_id,
        "type": document.type,
        "title": document.title,
        "category": document.category,
        "tags": list(document.tags or []),
        "language": document.language,
        "channels": list(document.channels or []),
        "version": document.version,
        "publish_version": document.publish_version or document.version,
        "content": document.content or "",
    }

    task_id = f"knowledge-{document.id}-v{document.publish_version or document.version}"
    document.index_status = "running"
    document.last_index_task_id = task_id
    document.last_index_error = None
    db.commit()

    try:
        result = run_worker_knowledge_index_job(payload)
    except (OSError, RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        document.index_status = "failed"
        document.last_index_error = str(exc)
        db.commit()
        db.refresh(document)
        raise HTTPException(status_code=502, detail=f"knowledge index rebuild failed: {exc}") from exc

    indexed_chunk_count = int(
        result.get("search_index", {}).get("indexed_count")
        or len(result.get("payload", {}).get("documents", []))
    )
    indexed_at = datetime.now(timezone.utc)

    document.index_status = "completed"
    document.indexed_chunk_count = indexed_chunk_count
    document.last_indexed_at = indexed_at
    document.last_index_error = None
    document.last_index_result = result
    db.commit()
    db.refresh(document)
    return KnowledgeIndexTaskResultRead(
        document_id=document.id,
        task_id=task_id,
        status="completed",
        indexed_chunk_count=indexed_chunk_count,
        indexed_at=indexed_at,
        result=result,
    )
