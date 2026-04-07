from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from typing import BinaryIO

from fastapi import HTTPException
from minio import Minio

from app.core.config import get_settings


@dataclass(frozen=True, slots=True)
class StoredVideoObject:
    file_key: str
    file_name: str
    mime_type: str
    size: int


class VideoObjectStorage:
    def store(self, *, file_key: str, file_name: str, content_type: str, data: bytes) -> StoredVideoObject:
        raise NotImplementedError

    def open(self, file_key: str) -> tuple[BinaryIO, str]:
        raise NotImplementedError


class LocalVideoObjectStorage(VideoObjectStorage):
    def __init__(self, root: Path) -> None:
        self._root = root
        self._root.mkdir(parents=True, exist_ok=True)

    def store(self, *, file_key: str, file_name: str, content_type: str, data: bytes) -> StoredVideoObject:
        path = self._root / file_key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return StoredVideoObject(file_key=file_key, file_name=file_name, mime_type=content_type, size=len(data))

    def open(self, file_key: str) -> tuple[BinaryIO, str]:
        path = self._root / file_key
        if not path.exists():
            raise HTTPException(status_code=404, detail="recording file not found")
        return path.open("rb"), path.suffix.lower() or ".bin"


class MinioVideoObjectStorage(VideoObjectStorage):
    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str, secure: bool) -> None:
        self._bucket = bucket
        self._client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        if not self._client.bucket_exists(self._bucket):
            self._client.make_bucket(self._bucket)

    def store(self, *, file_key: str, file_name: str, content_type: str, data: bytes) -> StoredVideoObject:
        payload = BytesIO(data)
        self._client.put_object(
            self._bucket,
            file_key,
            payload,
            length=len(data),
            content_type=content_type,
        )
        return StoredVideoObject(file_key=file_key, file_name=file_name, mime_type=content_type, size=len(data))

    def open(self, file_key: str) -> tuple[BinaryIO, str]:
        try:
            response = self._client.get_object(self._bucket, file_key)
        except Exception as exc:  # pragma: no cover - MinIO error specifics vary
            raise HTTPException(status_code=404, detail="recording file not found") from exc
        return response, ""


@lru_cache
def get_video_object_storage() -> VideoObjectStorage:
    settings = get_settings()
    if settings.app_minio_endpoint and settings.app_minio_access_key and settings.app_minio_secret_key:
        return MinioVideoObjectStorage(
            endpoint=settings.app_minio_endpoint,
            access_key=settings.app_minio_access_key,
            secret_key=settings.app_minio_secret_key,
            bucket=settings.app_minio_bucket,
            secure=settings.app_minio_secure,
        )

    return LocalVideoObjectStorage(Path(settings.app_media_root).expanduser().resolve())
