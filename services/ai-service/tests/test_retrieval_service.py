from __future__ import annotations

import httpx

from app.core.config import Settings
from app.decision.retrieval import RetrievalService
from app.decision.types import RewriteResult


def test_retrieval_uses_opensearch_hits_when_configured() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/knowledge/_search"
        return httpx.Response(
            200,
            json={
                "hits": {
                    "total": {"value": 1},
                    "hits": [
                        {
                            "_id": "doc-runtime-1-faq-1",
                            "_score": 7.8,
                            "_source": {
                                "document_id": "doc-runtime-1",
                                "title": "退款规则说明",
                                "content": "一般情况下，原路退款会在 1 到 3 个工作日内到账。",
                                "metadata": {"question": "订单退款什么时候到账？"},
                                "tags": ["退款", "账期"],
                            },
                        }
                    ],
                }
            },
        )

    settings = Settings(
        opensearch_url="http://127.0.0.1:9200",
        opensearch_index="knowledge",
    )
    service = RetrievalService(settings=settings, client=httpx.Client(transport=httpx.MockTransport(handler)))

    summary = service.retrieve(
        RewriteResult(
            original_query="订单退款什么时候到账？",
            normalized_query="订单退款什么时候到账？",
            tokens=("订单", "退款", "什么时候", "到账"),
        )
    )

    assert summary.matched_count == 1
    assert summary.top_score == 1.0
    assert summary.matched_documents[0].document.title == "退款规则说明"
    assert "退款" in summary.matched_documents[0].matched_terms
    assert "1 到 3 个工作日内到账" in summary.matched_documents[0].document.answer


def test_retrieval_falls_back_when_opensearch_returns_no_hits() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"hits": {"total": {"value": 0}, "hits": []}})

    settings = Settings(
        opensearch_url="http://127.0.0.1:9200",
        opensearch_index="knowledge",
    )
    service = RetrievalService(settings=settings, client=httpx.Client(transport=httpx.MockTransport(handler)))

    summary = service.retrieve(
        RewriteResult(
            original_query="How does the default provider get selected?",
            normalized_query="how does the default provider get selected",
            tokens=("default", "provider", "selected"),
        )
    )

    assert summary.matched_count >= 1
    assert summary.matched_documents[0].document.id == "provider-selection"


def test_retrieval_falls_back_when_opensearch_request_fails() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom")

    settings = Settings(
        opensearch_url="http://127.0.0.1:9200",
        opensearch_index="knowledge",
    )
    service = RetrievalService(settings=settings, client=httpx.Client(transport=httpx.MockTransport(handler)))

    summary = service.retrieve(
        RewriteResult(
            original_query="How does the default provider get selected?",
            normalized_query="how does the default provider get selected",
            tokens=("default", "provider", "selected"),
        )
    )

    assert summary.matched_count >= 1
    assert summary.matched_documents[0].document.id == "provider-selection"


def test_retrieval_ignores_irrelevant_opensearch_hits_without_overlap() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "hits": {
                    "total": {"value": 1},
                    "hits": [
                        {
                            "_id": "doc-runtime-2-faq-1",
                            "_score": 12.0,
                            "_source": {
                                "document_id": "doc-runtime-2",
                                "title": "发票补开说明",
                                "content": "请提供订单号、发票抬头、税号和收件邮箱。",
                                "metadata": {"question": "补开发票需要什么材料？"},
                                "tags": ["发票", "财务"],
                            },
                        }
                    ],
                }
            },
        )

    settings = Settings(
        opensearch_url="http://127.0.0.1:9200",
        opensearch_index="knowledge",
    )
    service = RetrievalService(settings=settings, client=httpx.Client(transport=httpx.MockTransport(handler)))

    summary = service.retrieve(
        RewriteResult(
            original_query="你们总部停车场收费标准是什么？",
            normalized_query="你们总部停车场收费标准是什么？",
            tokens=("总部", "停车场", "收费标准"),
        )
    )

    assert summary.matched_count == 0
    assert summary.matched_documents == ()
