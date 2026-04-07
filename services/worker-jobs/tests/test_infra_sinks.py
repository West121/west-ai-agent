from __future__ import annotations

import json

import httpx

from app.tasks import MinioObjectStorageSink, OpenSearchIndexSink


class _FakeMinioClient:
    def __init__(self) -> None:
        self.bucket_exists_calls: list[str] = []
        self.created_buckets: list[str] = []
        self.objects: list[dict[str, object]] = []
        self._buckets: set[str] = set()

    def bucket_exists(self, bucket_name: str) -> bool:
        self.bucket_exists_calls.append(bucket_name)
        return bucket_name in self._buckets

    def make_bucket(self, bucket_name: str) -> None:
        self.created_buckets.append(bucket_name)
        self._buckets.add(bucket_name)

    def put_object(
        self,
        bucket_name: str,
        object_name: str,
        data,
        length: int,
        content_type: str,
    ) -> None:
        self.objects.append(
            {
                "bucket_name": bucket_name,
                "object_name": object_name,
                "data": data.read(),
                "length": length,
                "content_type": content_type,
            }
        )


def test_minio_object_storage_sink_creates_bucket_and_uploads_json() -> None:
    client = _FakeMinioClient()
    sink = MinioObjectStorageSink(
        endpoint="127.0.0.1:9000",
        access_key="minio",
        secret_key="minio123",
        bucket="knowledge-artifacts",
        secure=False,
        client=client,
    )

    result = sink.store_payload("knowledge/doc-1.json", {"document_id": "doc-1", "title": "FAQ"})

    assert result["provider"] == "minio"
    assert result["bucket"] == "knowledge-artifacts"
    assert result["object_key"] == "knowledge/doc-1.json"
    assert client.created_buckets == ["knowledge-artifacts"]
    assert json.loads(client.objects[0]["data"].decode())["document_id"] == "doc-1"


def test_opensearch_index_sink_indexes_documents_via_bulk_api() -> None:
    captured: list[tuple[str, str | None, str | None]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append((request.method, str(request.url), request.content.decode()))
        if request.method == "GET":
            return httpx.Response(404)
        if request.method == "PUT" and request.url.path == "/knowledge_chunks":
            return httpx.Response(200, json={"acknowledged": True})
        if request.method == "POST" and request.url.path == "/knowledge_chunks/_bulk":
            return httpx.Response(200, json={"errors": False, "items": []})
        raise AssertionError(f"Unexpected request {request.method} {request.url}")

    sink = OpenSearchIndexSink(
        base_url="http://127.0.0.1:9200",
        index_name="knowledge_chunks",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    result = sink.index_documents(
        {
            "document_id": "doc-1",
            "documents": [
                {"chunk_id": "chunk-1", "content": "到账需要 1 到 3 个工作日", "metadata": {"tenant_id": "default"}},
                {"chunk_id": "chunk-2", "content": "发票需要订单号", "metadata": {"tenant_id": "default"}},
            ],
        }
    )

    assert result["provider"] == "opensearch"
    assert result["indexed_count"] == 2
    assert captured[0][0] == "GET"
    assert captured[1][0] == "PUT"
    assert captured[2][0] == "POST"
    assert '"chunk_id":"chunk-1"' in captured[2][2]
