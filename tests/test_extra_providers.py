"""Tests for QUORUM_EXTRA_PROVIDERS registry."""

from __future__ import annotations

import os
from unittest.mock import patch

from quorum.extra_providers import (
    discover_extra_providers,
    load_extra_provider,
    parse_extra_provider_keys,
    resolve_extra_provider_model,
    strip_extra_provider_prefix,
)
from quorum.providers import get_provider_for_model, list_all_models_sync


def test_parse_extra_provider_keys():
    assert parse_extra_provider_keys("groq, deepseek,together") == ["groq", "deepseek", "together"]
    assert parse_extra_provider_keys("bad key,groq") == ["groq"]


def test_load_extra_provider_with_prefix():
    env = {
        "GROQ_API_KEY": "gsk_" + "x" * 48,
        "GROQ_MODELS": "llama-3.3-70b-versatile|Llama 3.3 70B",
    }
    with patch.dict(os.environ, env, clear=False):
        cfg = load_extra_provider("groq")
    assert cfg is not None
    assert cfg.base_url == "https://api.groq.com/openai/v1"
    assert cfg.models[0][0] == "groq:llama-3.3-70b-versatile"


def test_resolve_and_strip_prefix():
    assert resolve_extra_provider_model("groq:llama-3.3-70b-versatile") == (
        "groq",
        "llama-3.3-70b-versatile",
    )
    assert resolve_extra_provider_model("ollama:llama3") is None
    assert strip_extra_provider_prefix("deepseek:deepseek-chat") == "deepseek-chat"


@patch.dict(
    os.environ,
    {
        "QUORUM_EXTRA_PROVIDERS": "groq,deepseek",
        "GROQ_API_KEY": "gsk_" + "a" * 48,
        "GROQ_MODELS": "llama-3.3-70b-versatile",
        "DEEPSEEK_API_KEY": "sk-" + "b" * 48,
        "DEEPSEEK_MODELS": "deepseek-chat",
    },
    clear=False,
)
def test_provider_routing_for_extra_providers():
    from quorum.config import get_settings

    get_settings.cache_clear()
    try:
        assert get_provider_for_model("groq:llama-3.3-70b-versatile") == "groq"
        assert get_provider_for_model("deepseek:deepseek-chat") == "deepseek"
        models = list_all_models_sync()
        assert "groq" in models
        assert "deepseek" in models
        assert discover_extra_providers()["groq"].models[0][0].startswith("groq:")
    finally:
        get_settings.cache_clear()


def test_discover_skips_incomplete_provider():
    with patch.dict(
        os.environ,
        {"QUORUM_EXTRA_PROVIDERS": "notarealhost", "NOTAREALHOST_API_KEY": "sk-test"},
        clear=False,
    ):
        assert "notarealhost" not in discover_extra_providers("notarealhost")
