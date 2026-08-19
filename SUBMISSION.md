# Course submission — SPAR

**Course:** AI in Finance  
**School:** SP Jain School of Global Management, Dubai  
**Group:** 3  
**Supervisor:** Dr. Guha  
**System:** SPAR (Scenario Planning via Agentic Reasoning)

## What to submit

This GitHub repository is the code and research artifact pack. It includes:

1. Runnable SPAR pipeline (`spar.bat` / `./spar`)
2. Agent prompts and master context (`research/prompts/`)
3. Architecture and checklist docs (`docs/`)
4. One sample offline run (`research/sample_outputs/offline_pilot/`)
5. Tests for DCS, artifacts, extra providers, and IPC

Live full-debate outputs (Liberation Day hybrid run, screenshots, HTML proof reports) live on the machine that ran them (`~/spar_outputs` or `C:\Users\<you>\spar_outputs`). Copy those into the submission zip if the marker needs the complete proof-of-work pack. They are **not** committed here (large, machine-specific, and sometimes contain model dumps).

## How a marker can run it

1. Install Python 3.11+ and Node.js 18+.
2. Run `install.bat` (Windows) or `./install.sh`.
3. Copy `.env.example` → `.env` and add at least one provider (Ollama is enough for an offline demo).
4. Start `spar.bat`, type `/method spar`, pick models, paste a shock scenario.

## Academic integrity

This project **forks and extends** Quorum. The README and NOTICE file credit the original authors. SPAR-specific layers, prompts, scoring, and Group 3 research documents are our work.
