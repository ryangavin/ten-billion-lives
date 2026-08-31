# Progress

- Current issue: none — M4 planning is complete; #29 is the next unblocked issue and has not been started.
- Last green commit: `8bc6b55` (completed local MVP recovery record; main clean and synchronized after #27 closure).
- Evidence produced: The local MVP remains complete at `docs/evidence/issue-27/INDEX.md`. GitHub milestone `M4 — Living City`, phase label `phase:visualization`, and issues #29–#37 define the visualization work. `GOAL.md` now carries mandatory per-increment inner loops, clean-clone outer loops, gate-specific exit matrices, and full-rerun-on-failure rules inspired by gates #5, #10, and #16; #33 and #36 are explicitly labeled gates in GitHub.
- Next action: feed `GOAL.md` to a fresh agent with `/goal`; inspect live state, post the #29 start comment, and freeze the living-city visual/time/architecture contract before starting implementation waves.
- Decisions: Keep 24 authoritative hourly ticks and derive continuous walking from explicit presentation phase. Use a visually dominant 2.5D Brindle Bay city. Parallel wave 1 is #30/#31/#32 after #29; #32 is the bounded walking skeleton; #33 runs a fresh-clone integration outer loop; parallel wave 2 is #34/#35; #36 runs the browser/performance/30-minute-soak hardening loop; #37 independently repeats everything. Any gate failure is fixed in its owning issue and forces a complete gate rerun from a new clone. Issue #28 remains deferred and untouched.
- Blockers: none. Server deployment is outside the local-MVP goal.
