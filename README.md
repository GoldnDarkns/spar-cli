# SPAR

<p align="center">
  <img src="docs/demo.gif" alt="SPAR multi-LLM debate in the terminal" width="700">
</p>

<p align="center">
  <strong>Scenario Planning via Agentic Reasoning</strong><br>
  Multi-LLM debate for geopolitical financial stress testing.
</p>

<p align="center">
  Five specialist models debate a shock. A separate validator synthesises consensus and dissent.
  A factor model turns that into sector P&amp;L, VaR, and a hedge overlay.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-BSL_1.1-blue.svg" alt="License"></a>
  <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/python-3.11+-blue.svg" alt="Python 3.11+"></a>
  <img src="https://img.shields.io/badge/course-SP%20Jain%20AI%20in%20Finance-6f42c1.svg" alt="SP Jain">
  <img src="https://img.shields.io/badge/group-3-informational.svg" alt="Group 3">
</p>

**SP Jain School of Global Management — AI in Finance — Group 3 — Dr. Guha**  
Course submission, 2026.

This codebase started as a fork of [Quorum](https://github.com/Detrol/quorum-cli) (terminal multi-model debate). It has been rebuilt around **SPAR**: channel-first Layer 0 evidence, live sequential debate, DCS explore/exploit, plausibility gating, and Layer 3 portfolio quantification. Upstream credit: [NOTICE.md](NOTICE.md).

---

## Why SPAR exists

Single-prompt “what happens to markets?” answers are brittle. SPAR forces **structured disagreement** across domains, then scores whether the debate should continue, whether the scenario is plausible, and what a $10M book should do.

| Layer | What it does |
|-------|----------------|
| **0** | Shock profiler + transmission-channel evidence (not analogue-first matching) |
| **1** | Five agents debate: Political, Economic, Environmental/Tech, Social, Devil's Advocate |
| **1b** | **DCS** (Debate Continuation Score) chooses EXPLORE vs EXPLOIT |
| **2** | Fresh-session validator → consensus JSON, minority dissent, plausibility gate |
| **3** | Pure Python factor model → heatmap, VaR, ES, GLD/TLT hedge, portfolio P&amp;L |

**Research question:** does *model* diversity (Approach B) beat *persona* diversity on one model (Approach A), on top of the same debate structure?

---

## Sample outputs (offline pilot)

Charts from `research/sample_outputs/offline_pilot/`:

<p align="center">
  <img src="research/sample_outputs/offline_pilot/_report_charts/heatmap.png" alt="Sector P&amp;L heatmap" width="720">
</p>

<p align="center">
  <img src="research/sample_outputs/offline_pilot/_report_charts/sp500_forecasts.png" alt="S&amp;P 500 agent forecasts" width="720">
</p>

<p align="center">
  <img src="research/sample_outputs/offline_pilot/_report_charts/consensus.png" alt="Consensus vs actual" width="480">
  <img src="research/sample_outputs/offline_pilot/_report_charts/confidence.png" alt="Agent confidence" width="480">
</p>

Full architecture HTML: [research/SPAR.html](research/SPAR.html) · prompts: [research/spar-prompts.html](research/spar-prompts.html) · dashboard: [research/spar-overhaul-dashboard.html](research/spar-overhaul-dashboard.html)

---

## Quick start

**Requirements:** Python 3.11+, Node.js 18+, optional [Ollama](https://ollama.com) for local models.

### Windows

```cmd
install.bat
copy .env.example .env
notepad .env
spar.bat
```

### Linux / macOS

```bash
./install.sh
cp .env.example .env
nano .env
./spar
```

In the terminal UI:

```
/method spar
```

Select **six** models (five specialists + validator), then paste a shock. Liberation Day example:

```
On April 2, 2025, the United States announced broad reciprocal tariffs under the
"Liberation Day" trade policy package, with sector-specific rates on imports from
major trading partners and immediate implementation timelines. Equity futures fell
sharply overnight; the VIX rose; USD strengthened; bond yields moved lower on
growth concerns. Knowledge cutoff: April 2, 2025, 09:00 ET (before cash equity open).
```

`quorum.bat` / `./quorum` still launch the same UI (engine package name).

---

## How a SPAR run works

```mermaid
flowchart TD
  shock[Shock scenario] --> L0[Layer 0 channel evidence]
  L0 --> R1[Round 1 independent JSON]
  R1 --> live[Live sequential debate]
  live --> DCS{DCS vs tau}
  DCS -->|explore| live
  DCS -->|exploit or cap| L2[Validator consensus + dissent]
  L2 --> gate{Plausibility gate}
  gate -->|pass| L3[Layer 3 VaR and hedge]
  gate -->|fail| human[Human review]
```

**DCS (paper form):** `DCS = 0.40×DS + 0.40×IG + 0.20×(1−RE)`  
The current prototype uses a close operational proxy (see `src/quorum/methods/spar_dcs.py`). Threshold τ = 0.35, max 5 live rounds.

**Plausibility:** moderator score blended with Fed FSR alignment (`config/spar_fsr_benchmark.json`). Gate τ = 60.

---

## Repository layout

```
.github/            CI, code of conduct, security policy
config/             SPAR model presets, FSR excerpts, Layer 3 factors
docs/               Overhaul notes, ADRs, API protocol, demo.gif
examples/           Offline Ollama pilot + cloud API brief test
frontend/           Terminal UI (Ink / React)
research/           Prompts, research HTML, sample run
scripts/            Report generators
src/quorum/         Runtime engine (package name kept for compatibility)
tests/              SPAR, DCS, providers, IPC tests
```

| Path | Role |
|------|------|
| [research/prompts/](research/prompts/) | Master context + 5 agents + validator |
| [research/README.md](research/README.md) | Research file index |
| [docs/SPAR_Offline_Workflow_And_Changes.md](docs/SPAR_Offline_Workflow_And_Changes.md) | What changed vs original Quorum |
| [docs/SPAR_Research_Implementation_Checklist.md](docs/SPAR_Research_Implementation_Checklist.md) | Implementation checklist |
| [SUBMISSION.md](SUBMISSION.md) | What to hand in to the course |
| [NOTICE.md](NOTICE.md) | Upstream Quorum attribution |

New live artifacts write to `research/spar_outputs/` (gitignored) or `QUORUM_REPORT_DIR`.

---

## Configuration

Copy `.env.example` → `.env`. **Never commit keys.**

```env
QUORUM_EXECUTION_MODE=sequential
QUORUM_MODEL_TIMEOUT=180
QUORUM_REPORT_DIR=~/spar_outputs
OLLAMA_BASE_URL=http://localhost:11434
```

| File | Use |
|------|-----|
| [`.env.spar-offline.example`](.env.spar-offline.example) | Local Ollama stack |
| [`.env.spar-free.example`](.env.spar-free.example) | Hybrid cloud + Granite |
| [`config/spar_offline_models.json`](config/spar_offline_models.json) | Offline role map |
| [`config/spar_cloud_models.json`](config/spar_cloud_models.json) | Cloud / hybrid presets |

---

## Other debate methods

The original engine still supports: Standard, Socratic, Advocate, Oxford, Delphi, Trade-off, Brainstorm. SPAR is the research method (`/method spar`).

---

## Tests and pilots

```bash
uv run pytest
uv run python examples/spar_ollama_pilot.py --help
uv run python examples/spar_cloud_brief_test.py --list-providers
```

---

## Course documents

| Document | Location |
|----------|----------|
| Architecture + DCS math | [research/SPAR.html](research/SPAR.html) |
| Presentation | [research/spar-presentation.html](research/spar-presentation.html) |
| Prompt specs | [research/spar-prompts.html](research/spar-prompts.html) |
| Research proposal | [research/SPAR_Research_Proposal.docx](research/SPAR_Research_Proposal.docx) |
| Overhaul write-up | [docs/SPAR_Overhaul_And_Updates.pdf](docs/SPAR_Overhaul_And_Updates.pdf) |

---

## License

Original Quorum engine: **Business Source License 1.1** (Andreas Thun / Detrol) — see [LICENSE](LICENSE).  
SPAR research layers, prompts, and Group 3 documents are academic course work. See [NOTICE.md](NOTICE.md).
