"""Registry for additional OpenAI-compatible API providers via environment variables.

Register providers in `.env` with::

    QUORUM_EXTRA_PROVIDERS=groq,deepseek,together,mistral
    GROQ_API_KEY=gsk_...
    GROQ_BASE_URL=https://api.groq.com/openai/v1
    GROQ_MODELS=llama-3.3-70b-versatile

Models are referenced as ``groq:llama-3.3-70b-versatile`` in discussions (like ``ollama:``).
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from .config import _get_active_env_file
from .providers import format_display_name

PROVIDER_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")

# Sensible defaults when {KEY}_BASE_URL is omitted
DEFAULT_BASE_URLS: dict[str, str] = {
    "groq": "https://api.groq.com/openai/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "together": "https://api.together.xyz/v1",
    "mistral": "https://api.mistral.ai/v1",
    "cerebras": "https://api.cerebras.ai/v1",
    "fireworks": "https://api.fireworks.ai/inference/v1",
    "perplexity": "https://api.perplexity.ai",
    "qwencloud": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    "github": "https://models.github.ai/inference",
    "openai_compat": "http://localhost:8080/v1",
}


@dataclass(frozen=True)
class ExtraProviderConfig:
    """Resolved configuration for one extra OpenAI-compatible provider."""

    key: str
    base_url: str
    api_key: str | None
    models: list[tuple[str, str]]  # (prefixed_model_id, display_name)


def parse_extra_provider_keys(raw: str) -> list[str]:
    """Parse QUORUM_EXTRA_PROVIDERS CSV into validated lowercase keys."""
    keys: list[str] = []
    for part in raw.split(","):
        key = part.strip().lower()
        if not key:
            continue
        if not PROVIDER_KEY_PATTERN.match(key):
            continue
        if key in keys:
            continue
        keys.append(key)
    return keys


def _env_name(provider_key: str, suffix: str) -> str:
    return f"{provider_key.upper().replace('-', '_')}_{suffix}"


def _lookup_env(name: str) -> str | None:
    """Read from process env first, then the active local/global .env file."""
    val = os.environ.get(name)
    if val is not None:
        return val

    env_file = _get_active_env_file()
    if not env_file.exists():
        return None

    prefix = f"{name}="
    for line in env_file.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or not stripped.startswith(prefix):
            continue
        return stripped[len(prefix):].strip().strip('"').strip("'")
    return None


def _parse_models_csv(models_str: str, provider_key: str) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    prefix = f"{provider_key}:"
    for entry in models_str.split(","):
        entry = entry.strip()
        if not entry:
            continue
        if "|" in entry:
            model_part, display = entry.split("|", 1)
            model_part = model_part.strip()
            display = display.strip()
        else:
            model_part = entry
            display = format_display_name(model_part.split(":")[-1])

        if model_part.startswith(prefix):
            model_id = model_part
        elif ":" in model_part and model_part.split(":", 1)[0] != provider_key:
            # Different provider prefix — keep as-is for advanced routing
            model_id = model_part
        else:
            bare = model_part.split(":", 1)[-1] if model_part.startswith(prefix) else model_part
            model_id = f"{prefix}{bare}"

        entries.append((model_id, display))
    return entries


def load_extra_provider(provider_key: str) -> ExtraProviderConfig | None:
    """Load one extra provider from environment variables."""
    env_base = _env_name(provider_key, "BASE_URL")
    env_models = _env_name(provider_key, "MODELS")
    env_key = _env_name(provider_key, "API_KEY")

    models_str = (_lookup_env(env_models) or "").strip()
    if not models_str:
        return None

    base_url = (_lookup_env(env_base) or "").strip() or DEFAULT_BASE_URLS.get(provider_key, "")
    if not base_url:
        return None

    api_key = _lookup_env(env_key)
    models = _parse_models_csv(models_str, provider_key)
    if not models:
        return None

    return ExtraProviderConfig(
        key=provider_key,
        base_url=base_url.rstrip("/"),
        api_key=api_key,
        models=models,
    )


def discover_extra_providers(extra_providers_csv: str = "") -> dict[str, ExtraProviderConfig]:
    """Discover all configured extra providers."""
    raw = extra_providers_csv or (_lookup_env("QUORUM_EXTRA_PROVIDERS") or "")
    keys = parse_extra_provider_keys(raw)
    result: dict[str, ExtraProviderConfig] = {}
    for key in keys:
        cfg = load_extra_provider(key)
        if cfg:
            result[key] = cfg
    return result


def is_extra_provider(provider_key: str) -> bool:
    return bool(PROVIDER_KEY_PATTERN.match(provider_key))


def resolve_extra_provider_model(model_id: str) -> tuple[str, str] | None:
    """If model_id uses an extra provider prefix, return (provider_key, api_model_id)."""
    if not model_id or ":" not in model_id:
        return None
    prefix, rest = model_id.split(":", 1)
    if prefix == "ollama" or not rest:
        return None
    if not is_extra_provider(prefix):
        return None
    return prefix, rest


def strip_extra_provider_prefix(model_id: str) -> str:
    """Return API model name without provider prefix."""
    resolved = resolve_extra_provider_model(model_id)
    if resolved:
        return resolved[1]
    return model_id
