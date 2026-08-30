# Issue #23 evidence

Revision `a526ad6` and the subsequent evidence harness validate the complete local compatibility scope without adding a server or remote browser service.

## Results

- Playwright: 31 cases; 23 applicable passes and 8 intentional project-specific skips. Chromium passed 12/12 applicable checks, WebKit 10/10, and mobile-touch Chromium 1/1.
- axe-core 4.13.0: 40 rule passes, zero violations, and zero serious/critical findings on the complete person/two-observer state. Two checks required manual review; the retained ARIA transcript and inspected screenshots provide that review surface.
- Keyboard: focus progressed from Enter Harbor Street to Meet a resident to the updated Dara Grove journey heading. Reduced-motion semantic transition duration was 0 ms, with CSS animation and transition suppression.
- Touch: selected and inspected person `person_27yi09s_1obkbba`, exposed the local deep link, honestly disclosed unavailable clipboard permission, opened the link, and exited follow mode to Planet.
- Resilience: one simulated context loss, tab switch/resume, and portrait/landscape resize preserved state `b2007dbd631d0474`, manifestation `0b21e681edada68a`, event `b0bd84480511f52f`, and the two-observer semantic match.
- Scaling/contrast: forced colors plus 200% root text at 390 px retained a 390 px document width with no horizontal overflow.
- Fallback: 25,000 Canvas manifestations rendered at 0.73 ms p95 over 60 frames, below the 33.33 ms budget.
- Browser availability: Chromium 151 and WebKit 26.5 were installed and passed. Firefox was not installed locally and is explicitly not claimed as validated.

## Artifacts

- `browser-matrix.json`: versions, availability, focus sequence, touch result, semantic recovery transcript, and fallback performance.
- `axe-report.json`: axe engine/environment and severity results.
- `screen-reader-transcript.yml`: inspected accessible tree for the complete person/two-observer state.
- `playwright-summary.json`: all desktop and mobile project cases.
- `keyboard-resume.webm` (4.92 s, SHA-256 `807094c10cb8fcf055d1490f89cf64730c83f6c2fc310ae8e72d17a83b886228`) and `keyboard-resume.png`.
- `touch-follow-exit.webm` (4.12 s, SHA-256 `0acb3b9755ed6990b1de63b47e99612af1af78f10cfbc75404df1e6709c73c69`) and `touch-follow-exit.png`.
- `forced-colors-200-percent.png` and `webkit-fallback.png`.

All four retained screenshots were visually inspected. They show meaningful text and controls alongside the Canvas visualization; none is a blank-canvas fallback.
