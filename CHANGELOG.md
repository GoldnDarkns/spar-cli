# Changelog

SPAR research releases. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

The original Quorum engine changelog is archived at [docs/upstream/CHANGELOG-quorum.md](docs/upstream/CHANGELOG-quorum.md).

## [0.1.0] — 2026-08-19

Course submission snapshot (SP Jain AI in Finance, Group 3).

### Added

- SPAR method (`/method spar`): Layer 0 channel evidence, live sequential debate, DCS explore/exploit, plausibility gate, Layer 3 factor model and hedge overlay
- Research prompts and HTML under `research/`
- Hybrid and offline model presets (`config/spar_*.json`)
- Cloud brief test and extra OpenAI-compatible providers (Groq, Qwen Cloud, GitHub Models)
- Architecture diagrams (`docs/diagrams/`)
- Citation file (`CITATION.cff`)

### Notes

- Python package directory remains `src/quorum/` for engine compatibility
- DCS in code uses operational proxies (see README limitations), not the paper’s spaCy/Jaccard definitions 1:1
