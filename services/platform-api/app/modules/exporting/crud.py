from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.conversation.models import Conversation
from app.modules.exporting.models import ExportTask
from app.modules.exporting.schemas import ExportTaskCreate
from app.modules.knowledge.models import KnowledgeDocument
from app.modules.service.models import LeaveMessage, Ticket


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _not_found(task_id: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"export task {task_id} not found")


def _load_task(db: Session, task_id: int) -> ExportTask:
    task = db.get(ExportTask, task_id)
    if task is None:
        raise _not_found(task_id)
    return task


def _count_rows(db: Session, source_kind: str) -> int:
    if source_kind == "tickets":
        stmt = select(func.count()).select_from(Ticket)
    elif source_kind == "leave_messages":
        stmt = select(func.count()).select_from(LeaveMessage)
    elif source_kind == "conversation_history":
        stmt = select(func.count()).select_from(Conversation)
    elif source_kind == "knowledge_documents":
        stmt = select(func.count()).select_from(KnowledgeDocument).where(KnowledgeDocument.status == "published")
    else:
        raise HTTPException(status_code=400, detail=f"unsupported export source kind: {source_kind}")

    return int(db.scalar(stmt) or 0)


def create_export_task(db: Session, data: ExportTaskCreate) -> ExportTask:
    task = ExportTask(name=data.name, source_kind=data.source_kind, format=data.format, status="pending")
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def list_export_tasks(db: Session) -> list[ExportTask]:
    stmt = select(ExportTask).order_by(ExportTask.updated_at.desc(), ExportTask.id.desc())
    return list(db.scalars(stmt).all())


def get_export_task(db: Session, task_id: int) -> ExportTask:
    return _load_task(db, task_id)


def execute_export_task(db: Session, task_id: int) -> ExportTask:
    task = _load_task(db, task_id)
    if task.status == "completed":
        raise HTTPException(status_code=409, detail="export task is already completed")
    if task.status == "running":
        raise HTTPException(status_code=409, detail="export task is already running")

    task.status = "running"
    task.started_at = task.started_at or _utcnow()
    task.row_count = _count_rows(db, task.source_kind)
    task.last_error = None
    db.commit()
    db.refresh(task)
    return task


def complete_export_task(db: Session, task_id: int, download_url: str) -> ExportTask:
    task = _load_task(db, task_id)
    if task.status == "completed":
        raise HTTPException(status_code=409, detail="export task is already completed")

    if task.row_count is None:
        task.row_count = _count_rows(db, task.source_kind)

    now = _utcnow()
    task.status = "completed"
    task.started_at = task.started_at or now
    task.completed_at = now
    task.download_url = download_url
    task.last_error = None
    db.commit()
    db.refresh(task)
    return task


def build_download_payload(db: Session, task_id: int, download_url: str) -> dict[str, object]:
    task = _load_task(db, task_id)
    if task.status != "completed":
        raise HTTPException(status_code=409, detail="export task must be completed before download")
    return {
        "task_id": task.id,
        "name": task.name,
        "source_kind": task.source_kind,
        "format": task.format,
        "status": task.status,
        "row_count": int(task.row_count or 0),
        "download_url": download_url,
        "generated_at": task.completed_at or task.updated_at,
    }
