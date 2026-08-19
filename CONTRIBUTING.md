# Contributing

This is an academic SPAR codebase (SP Jain Group 3). For course work, prefer issues in the Group 3 repo rather than the original Quorum project.

## Setup

```bash
./install.sh   # or install.bat on Windows
uv run pytest
```

## SPAR changes

Keep prompts in `research/prompts/`. Do not commit `.env`, `research/spar_outputs/`, or API keys.

The Python package folder remains `src/quorum/` (upstream engine). SPAR-specific logic lives mainly in `src/quorum/methods/spar*.py`.

See [NOTICE.md](NOTICE.md) before publishing anything that redistributes the original engine.
