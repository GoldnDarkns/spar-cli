#!/usr/bin/env python3
"""Brief SPAR cloud test — compare frontier/API models vs offline Ollama run.

Runs a shortened pipeline (Layer 0 + Round 1 + optional 1 live debate round)
using Quorum's pooled API clients. Configure providers in `.env` — see
`.env.spar-free.example` and `config/spar_cloud_models.json`.

Usage:
    uv run python examples/spar_cloud_brief_test.py --list-providers
    uv run python examples/spar_cloud_brief_test.py --validate-preset multi-provider-free
    uv run python examples/spar_cloud_brief_test.py --preset multi-provider-free
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

from quorum.clients.types import SystemMessage, UserMessage
from quorum.config import get_settings
from quorum.extra_providers import DEFAULT_BASE_URLS, discover_extra_providers
from quorum.methods.spar import _parse_json_response
from quorum.methods.spar_layer0 import (
    build_agent_system_prompt,
    resolve_master_context,
    run_layer0_pipeline,
)
from quorum.models import get_pooled_client, validate_model
from quorum.providers import list_all_models_sync

PROMPTS = ROOT / "research" / "prompts"
OUTPUT = ROOT / "research" / "spar_outputs"
CLOUD_CONFIG = ROOT / "config" / "spar_cloud_models.json"

LIBERATION_DAY_TASK = (
    "On April 2, 2025, the United States announced broad reciprocal tariffs under the "
    "'Liberation Day' trade policy package, with sector-specific rates on imports from "
    "major trading partners and immediate implementation timelines. Equity futures fell "
    "sharply overnight; the VIX rose; USD strengthened; bond yields moved lower on "
    "growth concerns. Knowledge cutoff: April 2, 2025, 09:00 ET (before cash equity open)."
)

AGENTS = [
    ("Political", "political_geopolitical", "agent1_political_geopolitical.txt", "POLITICAL"),
    ("Economic", "economic_fiscal_market", "agent2_economic_fiscal_market.txt", "ECONOMIC"),
    ("Environmental", "environmental_technology", "agent3_environmental_technology.txt", "ENVIRONMENTAL"),
    ("Social", "social_behavioural", "agent4_social_behavioural.txt", "SOCIAL"),
    ("DevilsAdvocate", "devils_advocate", "agent5_devils_advocate.txt", "DEVILS_ADVOCATE"),
]


def load_prompt(name: str) -> str:
    path = PROMPTS / name
    if not path.exists():
        raise FileNotFoundError(f"Missing prompt: {path}")
    return path.read_text(encoding="utf-8")


def load_cloud_preset(preset: str) -> dict[str, str]:
    raw = json.loads(CLOUD_CONFIG.read_text(encoding="utf-8"))
    presets = raw.get("presets", {})
    if preset not in presets:
        known = ", ".join(sorted(presets))
        raise ValueError(f"Unknown preset '{preset}'. Choose: {known}")
    roles = presets[preset].get("roles", {})
    if len(roles) < 6:
        raise ValueError(f"Preset '{preset}' needs 6 role models (incl. Moderator)")
    return roles


async def validate_preset(preset: str, timeout: float) -> int:
    """Ping every model in a preset. Returns 0 if all OK, 1 if any fail."""
    roles = load_cloud_preset(preset)
    raw = json.loads(CLOUD_CONFIG.read_text(encoding="utf-8"))
    desc = raw["presets"][preset].get("description", "")

    print(f"=== Validate preset: {preset} ===")
    if desc:
        print(desc)
    print()
    print("Role assignment:")
    for role, model_id in roles.items():
        print(f"  {role:16} -> {model_id}")
    print()

    failures = 0
    for role, model_id in roles.items():
        print(f"  Pinging {role} ({model_id})...", end=" ", flush=True)
        try:
            ok, err = await validate_model(model_id, timeout=timeout)
        except Exception as exc:
            ok, err = False, str(exc)
        if ok:
            print("OK")
        else:
            failures += 1
            print(f"FAIL — {err or 'unknown error'}")

    print()
    if failures:
        print(f"{failures} model(s) failed. Fix .env / Ollama before running the brief test.")
        return 1
    print("All 6 models reachable. Run: uv run python examples/spar_cloud_brief_test.py --preset", preset)
    return 0


async def chat_model(model_id: str, system: str, user: str, timeout: float) -> str:
    client = await get_pooled_client(model_id)
    response = await asyncio.wait_for(
        client.create(
            messages=[
                SystemMessage(content=system, source="system"),
                UserMessage(content=user, source="user"),
            ]
        ),
        timeout=timeout,
    )
    return response.content if hasattr(response, "content") else str(response)


def print_provider_status() -> None:
    settings = get_settings()
    print("Configured providers:", ", ".join(settings.available_providers) or "(none)")
    print()
    all_models = list_all_models_sync()
    for provider, models in sorted(all_models.items()):
        print(f"  [{provider}]")
        for m in models:
            print(f"    - {m.id}  ({m.display_name})")
    extra = discover_extra_providers(settings.quorum_extra_providers)
    if extra:
        print()
        print("Extra provider defaults (when BASE_URL omitted):")
        for key in extra:
            default = DEFAULT_BASE_URLS.get(key, "(set {KEY}_BASE_URL)")
            print(f"    {key}: {default}")


async def run_brief_test(
    preset: str,
    scenario: str,
    debate_rounds: int,
    timeout: float,
) -> Path:
    roles = load_cloud_preset(preset)
    task = LIBERATION_DAY_TASK if scenario == "liberation-day" else scenario

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    run_dir = OUTPUT / f"cloud_brief_{ts}"
    run_dir.mkdir(parents=True, exist_ok=True)

    print(f"=== SPAR Cloud Brief Test — preset: {preset} ===")
    print(f"Output: {run_dir}")
    print(f"Debate rounds after R1: {debate_rounds}")
    print()

    layer0 = run_layer0_pipeline(task, compact=True)
    (run_dir / "layer0.json").write_text(json.dumps(layer0.to_dict(), indent=2), encoding="utf-8")
    print(f"Layer 0: {len(layer0.activations)} channels ranked")

    master = resolve_master_context(task, PROMPTS)
    round1: dict[str, Any] = {}
    for role_key, agent_id, prompt_file, ipc_role in AGENTS:
        model_id = roles[role_key]
        agent_prompt = load_prompt(prompt_file)
        system = build_agent_system_prompt(
            master, layer0, role_key, agent_prompt, compact=True
        )
        user = (
            f"Scenario task:\n{task}\n\n"
            "Produce your Round 1 domain analysis as valid JSON only."
        )
        print(f"  Round 1 — {role_key} ({model_id})...")
        raw = await chat_model(model_id, system, user, timeout)
        (run_dir / f"{agent_id}_round1_raw.txt").write_text(raw, encoding="utf-8")
        parsed = _parse_json_response(raw)
        round1[agent_id] = parsed
        ok = "parse_error" not in parsed
        print(f"    {'OK' if ok else 'PARSE ERROR'}")

    (run_dir / "round1_all.json").write_text(json.dumps(round1, indent=2), encoding="utf-8")

    manifest = {
        "preset": preset,
        "scenario": scenario,
        "roles": roles,
        "debate_rounds_requested": debate_rounds,
        "providers": get_settings().available_providers,
        "timestamp": ts,
    }
    (run_dir / "cloud_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print()
    print("Done. Compare Round 1 JSON quality vs your offline Ollama artifacts.")
    print(f"Manifest: {run_dir / 'cloud_manifest.json'}")
    return run_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Brief SPAR cloud model comparison")
    parser.add_argument(
        "--preset",
        default="multi-provider-free",
        help="Preset from config/spar_cloud_models.json",
    )
    parser.add_argument("--scenario", default="liberation-day", choices=["liberation-day"])
    parser.add_argument("--debate-rounds", type=int, default=0, help="Live debate rounds after R1 (0 = R1 only)")
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument("--list-providers", action="store_true")
    parser.add_argument(
        "--validate-preset",
        metavar="PRESET",
        nargs="?",
        const="multi-provider-free",
        help="Ping all 6 models in preset (default: multi-provider-free)",
    )
    args = parser.parse_args()

    if args.list_providers:
        print_provider_status()
        return

    if args.validate_preset is not None:
        code = asyncio.run(validate_preset(args.validate_preset, args.timeout))
        raise SystemExit(code)

    if args.debate_rounds > 0:
        print("Note: live debate rounds > 0 not yet wired in brief test — running Round 1 only.")
        print("Use full Quorum UI /method spar for complete debate with cloud models.\n")

    asyncio.run(
        run_brief_test(
            preset=args.preset,
            scenario=args.scenario,
            debate_rounds=args.debate_rounds,
            timeout=args.timeout,
        )
    )


if __name__ == "__main__":
    main()
