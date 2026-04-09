from app.nlu.entity_normalizer import EntityNormalizer


def test_entity_normalizer_maps_business_aliases() -> None:
    normalizer = EntityNormalizer()
    result = normalizer.normalize("爱疯16破 去国金店做 apple care 返修")
    assert result.text == "iPhone 16 Pro 去Apple Store 浦东国金店做 AppleCare+ 维修"
    assert result.replacements["爱疯16破"] == "iPhone 16 Pro"
    assert result.replacements["国金店"] == "Apple Store 浦东国金店"
    assert result.replacements["apple care"] == "AppleCare+"
