from app.tasks import InMemorySearchIndexSink, chunk_build, document_parse, search_index


def test_document_parse_preserves_faq_items() -> None:
    result = document_parse(
        {
            "id": "doc-1",
            "tenant_id": "tenant-1",
            "type": "faq",
            "title": "Payments",
            "category": "billing",
            "tags": ["billing", "payments"],
            "language": "zh-CN",
            "channels": ["web", "h5"],
            "version": 5,
            "publish_version": 3,
            "content": [
                {"question": "How do I pay?", "answer": "Use a card."},
                {"question": "Where is the invoice?", "answer": "In billing."},
            ],
        }
    )

    assert result["document_id"] == "doc-1"
    assert result["tenant_id"] == "tenant-1"
    assert result["type"] == "faq"
    assert result["category"] == "billing"
    assert result["tags"] == ["billing", "payments"]
    assert result["language"] == "zh-CN"
    assert result["channels"] == ["web", "h5"]
    assert result["version"] == 5
    assert result["publish_version"] == 3
    assert result["faq_items"][0]["question"] == "How do I pay?"


def test_document_parse_can_normalize_raw_faq_text() -> None:
    result = document_parse(
        {
            "id": "doc-import-faq",
            "tenant_id": "tenant-import",
            "type": "faq",
            "title": "退款 FAQ",
            "category": "after-sale",
            "tags": ["refund"],
            "language": "zh-CN",
            "channels": ["web"],
            "content": "Q: 退款多久到账？\nA: 一般 1 到 3 个工作日到账。\n\nQ: 发票怎么处理？\nA: 联系客服补开发票。",
        }
    )

    assert [item["question"] for item in result["faq_items"]] == ["退款多久到账？", "发票怎么处理？"]
    assert result["faq_items"][1]["answer"] == "联系客服补开发票。"


def test_document_parse_can_normalize_markdown_sections() -> None:
    result = document_parse(
        {
            "id": "doc-import-article",
            "tenant_id": "tenant-import",
            "type": "article",
            "title": "售后说明",
            "category": "after-sale",
            "tags": ["policy"],
            "language": "zh-CN",
            "channels": ["web"],
            "content": "# 退款说明\n支持七天无理由退款。\n## 到账时效\n原路退款一般 1 到 3 个工作日到账。",
        }
    )

    assert result["sections"][0]["title_path"] == ["退款说明"]
    assert result["sections"][0]["content"] == "支持七天无理由退款。"
    assert result["sections"][1]["title_path"] == ["退款说明", "到账时效"]
    assert "到账" in result["sections"][1]["keywords"]


def test_chunk_build_emits_slice_metadata_for_article_sections() -> None:
    chunks = chunk_build(
        {
            "document_id": "doc-2",
            "tenant_id": "tenant-2",
            "publish_version": 4,
            "type": "article",
            "title": "Limits",
            "category": "policy",
            "tags": ["quota"],
            "language": "en-US",
            "channels": ["web"],
            "version": 6,
            "sections": [
                {"title_path": ["Getting started"], "content": "Welcome", "keywords": ["intro"]},
                {
                    "title_path": ["Getting started", "Limits"],
                    "content": "Daily limit applies",
                    "keywords": ["quota"],
                },
            ],
        }
    )

    assert chunks[0]["document_id"] == "doc-2"
    assert chunks[0]["tenant_id"] == "tenant-2"
    assert chunks[0]["publish_version"] == 4
    assert chunks[0]["metadata"]["slice_type"] == "article_section"
    assert chunks[1]["title_path"] == ["Getting started", "Limits"]
    assert chunks[1]["document_type"] == "article"
    assert chunks[1]["category"] == "policy"
    assert chunks[1]["tags"] == ["quota"]
    assert chunks[1]["language"] == "en-US"
    assert chunks[1]["channels"] == ["web"]
    assert chunks[1]["version"] == 6


def test_search_index_wraps_chunks_with_document_metadata() -> None:
    index = search_index(
        {
            "document_id": "doc-3",
            "title": "FAQ",
            "tenant_id": "tenant-1",
            "category": "support",
            "tags": ["faq"],
            "language": "zh-CN",
            "channels": ["web"],
            "version": 2,
            "publish_version": 2,
            "chunks": [
                {
                    "id": "chunk-1",
                    "document_id": "doc-3",
                    "tenant_id": "tenant-1",
                    "publish_version": 2,
                    "title_path": ["FAQ"],
                    "content": "Answer",
                    "keywords": ["faq"],
                    "metadata": {"slice_type": "faq_item"},
                }
            ],
        }
    )

    assert index["document_id"] == "doc-3"
    assert index["documents"][0]["chunk_id"] == "chunk-1"
    assert index["documents"][0]["metadata"]["tenant_id"] == "tenant-1"
    assert index["documents"][0]["category"] == "support"
    assert index["documents"][0]["tags"] == ["faq"]


def test_search_index_can_use_in_memory_sink() -> None:
    sink = InMemorySearchIndexSink()
    payload = search_index(
        {
            "document_id": "doc-4",
            "title": "FAQ",
            "tenant_id": "tenant-4",
            "category": "support",
            "tags": ["billing"],
            "language": "zh-CN",
            "channels": ["web"],
            "version": 1,
            "publish_version": 1,
            "chunks": [
                {
                    "id": "chunk-4",
                    "document_id": "doc-4",
                    "tenant_id": "tenant-4",
                    "publish_version": 1,
                    "title_path": ["退款"],
                    "content": "1-3 个工作日到账",
                    "keywords": ["refund"],
                    "metadata": {"slice_type": "faq_item"},
                }
            ],
        },
        sink=sink,
    )

    assert sink.documents[0]["chunk_id"] == "chunk-4"
    assert payload["sink"]["indexed_count"] == 1
    assert payload["sink"]["provider"] == "in_memory"
