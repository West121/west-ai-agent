from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.dependencies import require_permissions
from app.modules.knowledge.crud import (
    create_knowledge_document,
    get_knowledge_document,
    import_knowledge_document,
    list_knowledge_documents,
    publish_knowledge_document_version,
    rebuild_knowledge_document_index,
    submit_knowledge_document_for_review,
)
from app.modules.knowledge.schemas import (
    KnowledgeDocumentCreate,
    KnowledgeDocumentImportRequest,
    KnowledgeDocumentRead,
    KnowledgeIndexTaskResultRead,
    PublishVersionRequest,
)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.post("/documents", response_model=KnowledgeDocumentRead, status_code=201)
def post_document(
    payload: KnowledgeDocumentCreate,
    _: object = Depends(require_permissions("knowledge.write")),
    db: Session = Depends(get_db),
) -> KnowledgeDocumentRead:
    return create_knowledge_document(db, payload)


@router.post("/documents/import", response_model=KnowledgeDocumentRead, status_code=201)
def post_import_document(
    payload: KnowledgeDocumentImportRequest,
    _: object = Depends(require_permissions("knowledge.write")),
    db: Session = Depends(get_db),
) -> KnowledgeDocumentRead:
    return import_knowledge_document(db, payload)


@router.get("/documents", response_model=list[KnowledgeDocumentRead])
def get_documents(
    _: object = Depends(require_permissions("knowledge.read")),
    db: Session = Depends(get_db),
) -> list[KnowledgeDocumentRead]:
    return list_knowledge_documents(db)


@router.get("/documents/{document_id}", response_model=KnowledgeDocumentRead)
def get_document_detail(
    document_id: int,
    _: object = Depends(require_permissions("knowledge.read")),
    db: Session = Depends(get_db),
) -> KnowledgeDocumentRead:
    return get_knowledge_document(db, document_id)


@router.post("/documents/{document_id}/submit-review", response_model=KnowledgeDocumentRead)
def post_submit_review(
    document_id: int,
    _: object = Depends(require_permissions("knowledge.write")),
    db: Session = Depends(get_db),
) -> KnowledgeDocumentRead:
    return submit_knowledge_document_for_review(db, document_id)


@router.post("/documents/{document_id}/publish-version", response_model=KnowledgeDocumentRead)
def post_publish_version(
    document_id: int,
    payload: PublishVersionRequest,
    _: object = Depends(require_permissions("knowledge.write")),
    db: Session = Depends(get_db),
) -> KnowledgeDocumentRead:
    return publish_knowledge_document_version(db, document_id, payload)


@router.post("/documents/{document_id}/rebuild-index", response_model=KnowledgeIndexTaskResultRead)
def post_rebuild_index(
    document_id: int,
    _: object = Depends(require_permissions("knowledge.write")),
    db: Session = Depends(get_db),
) -> KnowledgeIndexTaskResultRead:
    return rebuild_knowledge_document_index(db, document_id)
