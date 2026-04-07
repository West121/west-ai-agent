from __future__ import annotations

import re

from app.decision.types import RewriteResult, STOPWORDS

_TOKEN_PATTERN = re.compile(r"[a-z0-9]+|[\u4e00-\u9fff]+")
_NORMALIZE_PATTERN = re.compile(r"[^\w\u4e00-\u9fff]+", re.UNICODE)


class QueryRewriteService:
    def rewrite(self, query: str) -> RewriteResult:
        normalized_query = " ".join(_NORMALIZE_PATTERN.sub(" ", query.strip().lower()).split())
        parsed_tokens = tuple(
            token
            for token in _TOKEN_PATTERN.findall(normalized_query)
            if token not in STOPWORDS
        )
        tokens = parsed_tokens or ((normalized_query,) if normalized_query else ())
        return RewriteResult(
            original_query=query,
            normalized_query=normalized_query,
            tokens=tokens,
        )
