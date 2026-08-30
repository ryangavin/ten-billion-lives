# Progress

- Current issue: #10 — M1 snapshot, event, replay, and frozen world-kernel gate.
- Last green commit: `8b574c3` (#9 closed with deterministic day, intervention, browser, visual, and performance evidence).
- Evidence produced: #10 focused suite has 5 green falsifiers: byte-stable checkpoint restore; identical genesis/tick-3/tick-9/tick-17 replay suffixes; independent full-day state/event hashes; actionable corrupt/truncated/version/order failures; and explicit world/event/checkpoint version 1. Local-only format and fail-closed migration policy documented.
- Next action: run the full root check and commit the checkpoint kernel, then add golden fixtures, replay CLI/transcripts, snapshot/load/replay benchmark, and browser restore diagnostics before the clean-checkout outer loop.
- Decisions: serialize only authoritative dynamic field rows plus seed/version/hash metadata; regenerate and verify static world data on restore; keep transport events as a sparse ordered local log; reject rather than guess migrations; design no network/deployment format.
- Blockers: none. Server deployment is outside the local-MVP goal.
