# Local browser and accessibility support

Ten Billion Lives is a local browser application. The supported path is the production build launched on loopback with the repository commands below; no server protocol or remote service is involved.

## Validated local matrix

| Profile                        | Local result                                                                                                  | Rendering path                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Chromium 151 desktop           | Complete journey, keyboard, context loss/resume, forced colors, 200% text, reduced motion                     | WebGPU when initialization succeeds; complete Canvas fallback               |
| WebKit 26.5 desktop            | Complete journey, keyboard, resize/orientation, context loss/resume                                           | Complete Canvas fallback; WebGPU availability is not required               |
| Chromium 151 Pixel 7 emulation | Touch selection, person inspection, deep-link share/open, follow exit                                         | 25,000-token Canvas fallback profile                                        |
| Firefox                        | Not tested on this machine because neither a system Firefox app nor a Playwright Firefox browser is installed | Expected to use Canvas when WebGPU is unavailable; not claimed as validated |

Run the bounded matrix with:

```sh
pnpm test:e2e
pnpm evidence:compatibility
pnpm evidence:compatibility:playwright
```

## Fallback and recovery

The app probes WebGPU at runtime. Adapter, device, context, or initialization failure selects Canvas2D and leaves the complete planet-to-person journey available. The header discloses the active backend, and the reality budget discloses the active visual tier and reason. Rendering backend, frame rate, camera, and visual density never enter authoritative state or semantic hashes.

Canvas context-loss simulation, tab switching, resize, and orientation changes retain the selected person, state hash, manifestation hash, event hash, and two-observer match. Lower-capability devices may select 25,000 visual tokens; the canonical baseline uses 250,000. Both reconstruct the same semantic result.

## Input and accessibility behavior

- Native buttons, links, forms, headings, landmarks, labels, pressed states, and live status regions provide the textual experience independently of the canvas.
- Keyboard-triggered rerenders restore focus to the corresponding control or the updated journey heading. A visible high-contrast focus ring identifies keyboard position.
- Reduced-motion preference removes nonessential animation and transition duration while retaining all state changes and text.
- Forced-colors mode adds explicit structural borders and a system-color renderer HUD. Statuses use words and symbols, not color alone.
- The complete narrow touch journey supports entering a place, tapping the highlighted resident, opening/copying a local person link, and returning to Planet view. If clipboard permission is unavailable, the direct local link remains usable and the app says so.
- At a 390 px viewport with root text scaled to 200%, the tested person journey has no horizontal page overflow.

The retained issue #23 artifacts include the axe-core report, ARIA transcript, browser matrix, recordings, screenshots, and fallback frame sample.
