# Notice

## Upstream engine

SPAR's terminal UI and multi-model orchestration are derived from **Quorum**:

- Project: [Detrol/quorum-cli](https://github.com/Detrol/quorum-cli)
- Licensor: Andreas Thun
- License: Business Source License 1.1 (`LICENSE`)

The Python package remains named `quorum` so existing IPC, tests, and the frontend continue to work. Launchers `spar` / `spar.bat` are the SPAR entry points; `quorum` / `quorum.bat` still work.

## SPAR research layer

Group 3 (SP Jain School of Global Management, AI in Finance, 2026) added:

- SPAR debate method (`/method spar`)
- Layer 0 channel-first evidence pipeline
- Live sequential debate + DCS controller
- Plausibility gate and FSR alignment
- Layer 3 factor model, VaR, hedge overlay
- Agent prompts, master context, and research reports under `research/`

Those additions are academic course work, not a claim of authorship over the original Quorum product.
