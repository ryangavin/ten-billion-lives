# Local browser and accessibility support

Ten Billion Lives is a local browser application. The supported path is the production build launched on loopback with the repository commands below; no server protocol or remote service is involved.

## Validated local matrix

| Profile                        | Local result                                                                                                  | Rendering path                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Chromium 151 desktop           | Complete viewport-first journey, keyboard, context loss/resume, forced colors, 200% text, reduced motion      | WebGPU when initialization succeeds; complete Canvas fallback               |
| WebKit 26.5 desktop            | Complete viewport-first journey, keyboard, resize/orientation, context loss/resume                            | Complete Canvas fallback; WebGPU availability is not required               |
| Chromium 151 Pixel 7 emulation | Touch selection, person inspection, deep-link share/open, follow exit, no page scroll                         | 128-figure Canvas fallback profile                                          |
| Firefox                        | Not tested on this machine because neither a system Firefox app nor a Playwright Firefox browser is installed | Expected to use Canvas when WebGPU is unavailable; not claimed as validated |

Run the bounded matrix with:

```sh
pnpm test:e2e
pnpm evidence:compatibility
pnpm evidence:compatibility:playwright
```

## Fallback and recovery

The app probes WebGPU at runtime. Adapter, device, context, or initialization failure selects Canvas2D and leaves the complete planet-to-person journey available. The header discloses the active backend, and the reality budget discloses the active visual tier and reason. Rendering backend, frame rate, camera, and visual density never enter authoritative state or semantic hashes.

Canvas context-loss simulation, tab switching, resize, and orientation changes retain the selected person, state hash, manifestation hash, event hash, and two-observer match. The production living city uses 128 fallback, 256 baseline, or 512 showcase figures. All tiers reconstruct the same authoritative person and event result. The older planet tracer retains its separately documented token tiers.

## Input and accessibility behavior

- Native buttons, links, forms, headings, landmarks, labels, pressed states, and live status regions provide the textual experience independently of the canvas.
- Keyboard-triggered rerenders restore focus to the corresponding control or the updated journey heading. A visible high-contrast focus ring identifies keyboard position.
- Reduced-motion preference removes nonessential animation and transition duration while retaining all state changes and text.
- Forced-colors mode adds explicit structural borders and a system-color renderer HUD. Statuses use words and symbols, not color alone.
- The complete narrow touch journey supports entering a place, tapping the highlighted resident, opening/copying a local person link, and returning to Planet view. If clipboard permission is unavailable, the direct local link remains usable and the app says so.
- At a 390 px viewport with root text scaled to 200%, the tested person journey has no horizontal page overflow.

The retained issue #35 artifacts include the viewport-shell axe-core report, keyboard/touch transcripts, no-overflow metrics, forced-colors capture, and mobile/desktop screenshots. The #36 compatibility capture records 45 cases with 31 applicable passes, 14 declared project skips, zero unexpected results, zero retries, and zero flakes across Chromium, WebKit, and mobile Chromium.
