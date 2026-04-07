from __future__ import annotations

from app.decision.query_rewrite import QueryRewriteService


def test_query_rewrite_keeps_non_latin_query_as_single_token() -> None:
    result = QueryRewriteService().rewrite("退款多久到账？")

    assert result.normalized_query == "退款多久到账？"
    assert result.tokens == ("退款多久到账？",)
