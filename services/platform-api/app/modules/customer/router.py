from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.modules.auth.dependencies import require_permissions
from app.modules.customer.crud import (
    create_blacklist_entry,
    create_customer_profile,
    create_tag,
    delete_blacklist_entry,
    delete_customer_profile,
    delete_tag,
    get_blacklist_entry,
    get_customer_profile,
    get_tag,
    list_blacklist_entries,
    list_customer_profiles,
    list_tags,
    update_blacklist_entry,
    update_customer_profile,
    update_tag,
)
from app.modules.customer.schemas import (
    BlacklistCreate,
    BlacklistListResponse,
    BlacklistRead,
    BlacklistUpdate,
    CustomerProfileCreate,
    CustomerProfileRead,
    CustomerProfileUpdate,
    TagCreate,
    TagRead,
    TagUpdate,
)

router = APIRouter(prefix="/customer", tags=["customer"])


@router.post("/tags", response_model=TagRead, status_code=status.HTTP_201_CREATED)
def post_tag(
    payload: TagCreate,
    _: object = Depends(require_permissions("customer.write")),
    db: Session = Depends(get_db),
) -> TagRead:
    return create_tag(db, payload)


@router.get("/tags", response_model=list[TagRead])
def get_tags(
    _: object = Depends(require_permissions("customer.read")),
    db: Session = Depends(get_db),
) -> list[TagRead]:
    return list_tags(db)


@router.get("/tags/{tag_id}", response_model=TagRead)
def get_tag_detail(
    tag_id: int,
    _: object = Depends(require_permissions("customer.read")),
    db: Session = Depends(get_db),
) -> TagRead:
    return get_tag(db, tag_id)


@router.patch("/tags/{tag_id}", response_model=TagRead)
def patch_tag(
    tag_id: int,
    payload: TagUpdate,
    _: object = Depends(require_permissions("customer.write")),
    db: Session = Depends(get_db),
) -> TagRead:
    return update_tag(db, tag_id, payload)


@router.delete("/tags/{tag_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_tag(
    tag_id: int,
    _: object = Depends(require_permissions("customer.write")),
    db: Session = Depends(get_db),
) -> Response:
    delete_tag(db, tag_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/profiles", response_model=CustomerProfileRead, status_code=status.HTTP_201_CREATED)
def post_profile(
    payload: CustomerProfileCreate,
    _: object = Depends(require_permissions("customer.write")),
    db: Session = Depends(get_db),
) -> CustomerProfileRead:
    return create_customer_profile(db, payload)


@router.get("/profiles", response_model=list[CustomerProfileRead])
def get_profiles(
    _: object = Depends(require_permissions("customer.read")),
    db: Session = Depends(get_db),
) -> list[CustomerProfileRead]:
    return list_customer_profiles(db)


@router.get("/profiles/{customer_id}", response_model=CustomerProfileRead)
def get_profile_detail(
    customer_id: int,
    _: object = Depends(require_permissions("customer.read")),
    db: Session = Depends(get_db),
) -> CustomerProfileRead:
    return get_customer_profile(db, customer_id)


@router.patch("/profiles/{customer_id}", response_model=CustomerProfileRead)
def patch_profile(
    customer_id: int,
    payload: CustomerProfileUpdate,
    _: object = Depends(require_permissions("customer.write")),
    db: Session = Depends(get_db),
) -> CustomerProfileRead:
    return update_customer_profile(db, customer_id, payload)


@router.delete("/profiles/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_profile(
    customer_id: int,
    _: object = Depends(require_permissions("customer.write")),
    db: Session = Depends(get_db),
) -> Response:
    delete_customer_profile(db, customer_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/blacklist", response_model=BlacklistRead, status_code=status.HTTP_201_CREATED)
def post_blacklist(
    payload: BlacklistCreate,
    _: object = Depends(require_permissions("customer.write")),
    db: Session = Depends(get_db),
) -> BlacklistRead:
    return create_blacklist_entry(db, payload)


@router.get("/blacklist", response_model=BlacklistListResponse)
def get_blacklist(
    _: object = Depends(require_permissions("customer.read")),
    db: Session = Depends(get_db),
) -> BlacklistListResponse:
    return BlacklistListResponse(items=list_blacklist_entries(db))


@router.get("/blacklist/{blacklist_id}", response_model=BlacklistRead)
def get_blacklist_detail(
    blacklist_id: int,
    _: object = Depends(require_permissions("customer.read")),
    db: Session = Depends(get_db),
) -> BlacklistRead:
    return get_blacklist_entry(db, blacklist_id)


@router.patch("/blacklist/{blacklist_id}", response_model=BlacklistRead)
def patch_blacklist(
    blacklist_id: int,
    payload: BlacklistUpdate,
    _: object = Depends(require_permissions("customer.write")),
    db: Session = Depends(get_db),
) -> BlacklistRead:
    return update_blacklist_entry(db, blacklist_id, payload)


@router.delete("/blacklist/{blacklist_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_blacklist(
    blacklist_id: int,
    _: object = Depends(require_permissions("customer.write")),
    db: Session = Depends(get_db),
) -> Response:
    delete_blacklist_entry(db, blacklist_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
