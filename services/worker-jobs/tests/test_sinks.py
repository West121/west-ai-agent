from __future__ import annotations

import json

import pytest

from app.sinks import MinIOSearchObjectStoreSink, OpenSearchIndexSink, WorkerSinks, build_worker_sinks
from app.tasks import run_knowledge_index_job


def test_build_worker_sinks_defaults_to_noop(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("WORKER_JOBS_OBJECT_STORAGE_PROVIDER", raising=False)
    monkeypatch.delenv("WORKER_JOBS_SEARCH_INDEX_PROVIDER", raising=False)

    sinks = build_worker_sinks()

    assert sinks.object_storage.provider == "noop"
    assert sinks.search_index.provider == "noop"


def test_minio_sink_stores_json_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    class FakeObject:
        def put(self, payload, length, content_type):  # noqa: ANN001
            captured["payload"] = payload.read().decode()
            captured["length"] = length
            captured["content_type"] = content_type

    class FakeBucket:
        def stat_object(self, *_args, **_kwargs):
            raise RuntimeError("missing")

    class FakeMinioClient:
        def bucket_exists(self, bucket_name):  # noqa: ANN001
            captured["bucket_exists"] = bucket_name
            return False

        def make_bucket(self, bucket_name):  # noqa: ANN001
            captured["make_bucket"] = bucket_name

        def put_object(self, bucket_name, object_name, data, length, content_type=None):  # noqa: ANN001
            captured["bucket_name"] = bucket_name
            captured["object_name"] = object_name
            captured["payload"] = data.read().decode()
            captured["length"] = length
            captured["content_type"] = content_type

    sink = MinIOSearchObjectStoreSink(
        client=FakeMinioClient(),
        bucket_name="knowledge",
        object_prefix="docs",
    )

    result = sink.store_json(
        {
            "document_id": "doc-1",
            "tenant_id": "tenant-1",
            "documents": [{"chunk_id": "chunk-1", "content": "hello"}],
        }
    )

    assert result["provider"] == "minio"
    assert result["bucket"] == "knowledge"
    assert captured["bucket_name"] == "knowledge"
    assert captured["object_name"].startswith("docs/doc-1/")
    assert captured["content_type"] == "application/json"
    assert json.loads(captured["payload"])["document_id"] == "doc-1"


def test_opensearch_sink_posts_documents(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {"errors": False}

    class FakeClient:
        def get(self, url, auth=None):  # noqa: ANN001
            captured["get_url"] = str(url)
            captured["get_auth"] = auth

            class FakeGetResponse:
                status_code = 200

                def raise_for_status(self) -> None:
                    return None

            return FakeGetResponse()

        def post(self, url, content=None, headers=None, auth=None):  # noqa: ANN001
            captured["url"] = str(url)
            captured["content"] = content.decode()
            captured["headers"] = headers
            captured["auth"] = auth
            return FakeResponse()

    sink = OpenSearchIndexSink(
        client=FakeClient(),
        base_url="http://localhost:9200",
        index_name="knowledge",
    )
    result = sink.index_documents(
        {
            "document_id": "doc-2",
            "documents": [{"chunk_id": "chunk-2", "content": "hello"}],
        }
    )

    assert result["provider"] == "opensearch"
    assert result["indexed_count"] == 1
    assert captured["url"] == "http://localhost:9200/knowledge/_bulk"
    assert "_bulk" in captured["url"]
    assert "chunk-2" in captured["content"]


def test_run_knowledge_index_job_writes_to_both_sinks() -> None:
    class FakeObjectStorage:
        provider = "fake_object"

        def __init__(self) -> None:
            self.calls: list[dict[str, object]] = []

        def store_json(self, payload):
            self.calls.append(dict(payload))
            return {"provider": self.provider, "object_name": "docs/doc-3/payload.json"}

    class FakeSearchIndex:
        provider = "fake_search"

        def __init__(self) -> None:
            self.calls: list[dict[str, object]] = []

        def index_documents(self, payload):
            self.calls.append(dict(payload))
            return {"provider": self.provider, "indexed_count": len(payload["documents"])}

    object_storage = FakeObjectStorage()
    search_index = FakeSearchIndex()
    sinks = WorkerSinks(object_storage=object_storage, search_index=search_index)

    result = run_knowledge_index_job(
        {
            "document_id": "doc-3",
            "tenant_id": "tenant-3",
            "type": "faq",
            "title": "Billing",
            "category": "support",
            "tags": ["billing"],
            "language": "zh-CN",
            "channels": ["web"],
            "version": 1,
            "publish_version": 1,
            "content": [{"question": "Where is my invoice?", "answer": "In billing."}],
        },
        sinks=sinks,
    )

    assert object_storage.calls[0]["document_id"] == "doc-3"
    assert search_index.calls[0]["document_id"] == "doc-3"
    assert result["object_storage"]["provider"] == "fake_object"
    assert result["search_index"]["provider"] == "fake_search"
    assert result["search_index"]["indexed_count"] == 1
