from __future__ import annotations

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.dependencies import require_permissions
from app.modules.exporting.crud import (
    build_download_payload,
    complete_export_task,
    create_export_task,
    execute_export_task,
    get_export_task,
    list_export_tasks,
)
from app.modules.exporting.schemas import ExportDownloadRead, ExportTaskCreate, ExportTaskRead

router = APIRouter(prefix="/exporting", tags=["exporting"])


@router.post("/tasks", response_model=ExportTaskRead, status_code=status.HTTP_201_CREATED)
def post_export_task(
    payload: ExportTaskCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("export.write")),
) -> ExportTaskRead:
    return create_export_task(db, payload)


@router.get("/tasks", response_model=list[ExportTaskRead])
def get_export_tasks(
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("export.read")),
) -> list[ExportTaskRead]:
    return list_export_tasks(db)


@router.get("/tasks/{task_id}", response_model=ExportTaskRead)
def get_export_task_detail(
    task_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("export.read")),
) -> ExportTaskRead:
    return get_export_task(db, task_id)


@router.post("/tasks/{task_id}/execute", response_model=ExportTaskRead)
def post_execute_export_task(
    task_id: int,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("export.write")),
) -> ExportTaskRead:
    return execute_export_task(db, task_id)


@router.post("/tasks/{task_id}/complete", response_model=ExportTaskRead)
def post_complete_export_task(
    task_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("export.write")),
) -> ExportTaskRead:
    download_url = str(request.url_for("download_export_task", task_id=task_id))
    return complete_export_task(db, task_id, download_url)


@router.get("/tasks/{task_id}/download", name="download_export_task", response_model=ExportDownloadRead)
def get_export_task_download(
    task_id: int,
    request: Request,
    db: Session = Depends(get_db),
    _: object = Depends(require_permissions("export.read")),
) -> ExportDownloadRead:
    download_url = str(request.url_for("download_export_task", task_id=task_id))
    payload = build_download_payload(db, task_id, download_url)
    return ExportDownloadRead(**payload)
