from __future__ import annotations

import json
from dataclasses import dataclass
from io import BytesIO
from os import getenv
from typing import Any, Literal, Mapping, Protocol

import httpx
from minio import Minio

ObjectStorageProviderName = Literal["noop", "minio"]
SearchIndexProviderName = Literal["noop", "opensearch"]


class ObjectStorageSink(Protocol):
    provider: str

    def store_payload(self, object_key: str, payload: Mapping[str, Any]) -> dict[str, Any]:
        ...


class SearchIndexSink(Protocol):
    provider: str

    def index_documents(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        ...


class NoopObjectStorageSink:
    provider = "noop"

    def store_payload(self, object_key: str, payload: Mapping[str, Any]) -> dict[str, Any]:
        payload_dict = dict(payload)
        return {
            "provider": self.provider,
            "stored": False,
            "object_key": object_key,
            "document_id": payload_dict.get("document_id", ""),
        }


class NoopSearchIndexSink:
    provider = "noop"

    def index_documents(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        payload_dict = dict(payload)
        documents = list(payload_dict.get("documents", []))
        return {
            "provider": self.provider,
            "indexed_count": len(documents),
            "document_id": payload_dict.get("document_id", ""),
        }


class MinioObjectStorageSink:
    provider = "minio"

    def __init__(
        self,
        endpoint: str | None = None,
        access_key: str | None = None,
        secret_key: str | None = None,
        bucket: str | None = None,
        secure: bool = False,
        client: Minio | None = None,
        object_prefix: str = "knowledge",
        bucket_name: str | None = None,
    ) -> None:
        self._client = client or self._build_client(endpoint, access_key, secret_key, secure)
        self._bucket_name = bucket_name or bucket or "knowledge"
        self._object_prefix = object_prefix.strip("/")
        self._bucket_ready = False

    def _build_client(
        self,
        endpoint: str | None,
        access_key: str | None,
        secret_key: str | None,
        secure: bool,
    ) -> Minio:
        if not endpoint or not access_key or not secret_key:
            raise ValueError("MinIO endpoint, access key, and secret key are required")
        return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=secure)

    def _ensure_bucket(self) -> None:
        if self._bucket_ready:
            return
        if not self._client.bucket_exists(self._bucket_name):
            self._client.make_bucket(self._bucket_name)
        self._bucket_ready = True

    def store_payload(self, object_key: str, payload: Mapping[str, Any]) -> dict[str, Any]:
        payload_dict = dict(payload)
        self._ensure_bucket()
        data = BytesIO(json.dumps(payload_dict, ensure_ascii=False, sort_keys=True).encode("utf-8"))
        self._client.put_object(
            self._bucket_name,
            object_key,
            data,
            length=len(data.getvalue()),
            content_type="application/json",
        )
        return {
            "provider": self.provider,
            "stored": True,
            "bucket": self._bucket_name,
            "object_key": object_key,
            "object_name": object_key,
            "document_id": payload_dict.get("document_id", ""),
        }

    def store_json(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        payload_dict = dict(payload)
        document_id = str(payload_dict.get("document_id", "document")).strip() or "document"
        object_name = f"{self._object_prefix}/{document_id}/payload.json"
        result = self.store_payload(object_name, payload_dict)
        result["object_name"] = object_name
        return result


class OpenSearchIndexSink:
    provider = "opensearch"

    def __init__(
        self,
        client: httpx.Client,
        base_url: str,
        index_name: str,
        username: str | None = None,
        password: str | None = None,
    ) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._index_name = index_name
        self._auth = httpx.BasicAuth(username, password) if username and password else None

    def index_documents(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        from app.tasks import build_search_index_payload

        if "documents" in payload and "chunks" not in payload:
            built_payload = dict(payload)
        else:
            built_payload = build_search_index_payload(payload)
        self._ensure_index()
        bulk_lines: list[str] = []
        for document in built_payload["documents"]:
            bulk_lines.append(
                json.dumps(
                    {"index": {"_index": self._index_name, "_id": document["chunk_id"]}},
                    separators=(",", ":"),
                )
            )
            bulk_lines.append(json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
        bulk_body = "\n".join(bulk_lines) + "\n"
        response = self._client.post(
            f"{self._base_url}/{self._index_name}/_bulk",
            content=bulk_body.encode("utf-8"),
            headers={"Content-Type": "application/x-ndjson"},
            auth=self._auth,
        )
        response.raise_for_status()
        body = response.json()
        return {
            "provider": self.provider,
            "indexed_count": len(built_payload["documents"]),
            "document_id": built_payload["document_id"],
            "index": self._index_name,
            "errors": body.get("errors", False),
        }

    def _ensure_index(self) -> None:
        if not hasattr(self._client, "get") or not hasattr(self._client, "put"):
            return
        response = self._client.get(
            f"{self._base_url}/{self._index_name}",
            auth=self._auth,
        )
        if response.status_code == 404:
            create_response = self._client.put(
                f"{self._base_url}/{self._index_name}",
                json={
                    "settings": {
                        "number_of_shards": 1,
                        "number_of_replicas": 0,
                    }
                },
                auth=self._auth,
            )
            create_response.raise_for_status()
            return
        response.raise_for_status()


MinIOSearchObjectStoreSink = MinioObjectStorageSink


@dataclass(frozen=True, slots=True)
class WorkerSinks:
    object_storage: ObjectStorageSink
    search_index: SearchIndexSink


@dataclass(frozen=True, slots=True)
class WorkerSinkSettings:
    object_storage_provider: ObjectStorageProviderName = "noop"
    search_index_provider: SearchIndexProviderName = "noop"
    minio_endpoint: str = "127.0.0.1:9000"
    minio_access_key: str = "minio"
    minio_secret_key: str = "minio123"
    minio_bucket: str = "knowledge"
    minio_secure: bool = False
    minio_object_prefix: str = "knowledge"
    opensearch_url: str = "http://127.0.0.1:9200"
    opensearch_index: str = "knowledge"
    opensearch_username: str | None = None
    opensearch_password: str | None = None

    @classmethod
    def from_env(cls) -> "WorkerSinkSettings":
        def read_bool(name: str, default: bool) -> bool:
            value = getenv(name)
            if value is None:
                return default
            return value.strip().lower() in {"1", "true", "yes", "on"}

        def read_optional(name: str) -> str | None:
            value = getenv(name)
            if value is None:
                return None
            normalized = value.strip()
            return normalized or None

        object_storage_provider = read_optional("WORKER_JOBS_OBJECT_STORAGE_PROVIDER") or "noop"
        search_index_provider = read_optional("WORKER_JOBS_SEARCH_INDEX_PROVIDER") or "noop"
        if object_storage_provider not in {"noop", "minio"}:
            object_storage_provider = "noop"
        if search_index_provider not in {"noop", "opensearch"}:
            search_index_provider = "noop"

        return cls(
            object_storage_provider=object_storage_provider,
            search_index_provider=search_index_provider,
            minio_endpoint=read_optional("WORKER_JOBS_MINIO_ENDPOINT") or cls.minio_endpoint,
            minio_access_key=read_optional("WORKER_JOBS_MINIO_ACCESS_KEY") or cls.minio_access_key,
            minio_secret_key=read_optional("WORKER_JOBS_MINIO_SECRET_KEY") or cls.minio_secret_key,
            minio_bucket=read_optional("WORKER_JOBS_MINIO_BUCKET") or cls.minio_bucket,
            minio_secure=read_bool("WORKER_JOBS_MINIO_SECURE", cls.minio_secure),
            minio_object_prefix=read_optional("WORKER_JOBS_MINIO_OBJECT_PREFIX") or cls.minio_object_prefix,
            opensearch_url=read_optional("WORKER_JOBS_OPENSEARCH_URL") or cls.opensearch_url,
            opensearch_index=read_optional("WORKER_JOBS_OPENSEARCH_INDEX") or cls.opensearch_index,
            opensearch_username=read_optional("WORKER_JOBS_OPENSEARCH_USERNAME"),
            opensearch_password=read_optional("WORKER_JOBS_OPENSEARCH_PASSWORD"),
        )


def build_worker_sinks(settings: WorkerSinkSettings | None = None) -> WorkerSinks:
    resolved = settings or WorkerSinkSettings.from_env()
    object_storage: ObjectStorageSink
    search_index: SearchIndexSink

    if resolved.object_storage_provider == "minio":
        object_storage = MinioObjectStorageSink(
            endpoint=resolved.minio_endpoint,
            access_key=resolved.minio_access_key,
            secret_key=resolved.minio_secret_key,
            bucket=resolved.minio_bucket,
            secure=resolved.minio_secure,
            object_prefix=resolved.minio_object_prefix,
        )
    else:
        object_storage = NoopObjectStorageSink()

    if resolved.search_index_provider == "opensearch":
        search_index = OpenSearchIndexSink(
            client=httpx.Client(timeout=30.0),
            base_url=resolved.opensearch_url,
            index_name=resolved.opensearch_index,
            username=resolved.opensearch_username,
            password=resolved.opensearch_password,
        )
    else:
        search_index = NoopSearchIndexSink()

    return WorkerSinks(object_storage=object_storage, search_index=search_index)
