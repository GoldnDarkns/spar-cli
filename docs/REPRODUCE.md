# Reproduce a SPAR run

## 1. Install

Windows: `install.bat`  
Linux/macOS: `./install.sh`

Python 3.11+, Node.js 18+. Copy `.env.example` → `.env` (never commit keys).

## 2. Offline smoke (no cloud keys)

Needs [Ollama](https://ollama.com) and at least `granite3.3:8b` (or any models in `.env.spar-offline.example`).

```bash
uv run pytest
uv run python examples/spar_ollama_pilot.py --help
./spar          # Windows: spar.bat
```

In the UI: `/method spar` → pick six models → paste the Liberation Day shock from the README.

## 3. Hybrid cloud brief (Layer 0 + Round 1 only)

```bash
uv run python examples/spar_cloud_brief_test.py --list-providers
uv run python examples/spar_cloud_brief_test.py --validate-preset multi-provider-free
uv run python examples/spar_cloud_brief_test.py --preset multi-provider-free
```

Writes `research/spar_outputs/cloud_brief_*` (gitignored).

## 4. Canonical sample artifacts in this repo

| Path | What it is |
|------|------------|
| `research/sample_outputs/offline_pilot/` | Early offline debate + charts |
| `research/sample_outputs/liberation_day_hybrid/` | Thin extract of the Jul 2026 hybrid UI run (DCS, gate, Layer 3, model map) |

Full live dumps (transcripts, screenshots) stay on the machine that ran them, typically `~/spar_outputs/run_*`.

## 5. Expected hybrid run (Liberation Day)

- **Scenario:** Liberation Day tariffs, knowledge cutoff 2 Apr 2025 09:00 ET  
- **Models:** see `research/sample_outputs/liberation_day_hybrid/model_manifest.json`  
- **DCS:** stayed ~0.63–0.67; Round 5 EXPLOIT because of the cap, not because DCS fell below 0.35  
- **Gate:** composite plausibility ~70 (pass)  
- **Layer 3:** consensus portfolio shock about −4.7%; 35% GLD/TLT hedge sleeve  

Scoring vs actual 3-day returns is in the README limitations section.
