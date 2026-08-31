# Claims and known limitations

The limitations are part of the product, because the interesting result depends on being precise about what is represented and what is computed.

## Claims

The validated local MVP claims:

- the baseline field total is exactly 10,000,000,000 at initialization and every implemented tick;
- the world, checkpoints, sparse events, and replay use versioned deterministic integer/canonical encodings;
- equal semantic inputs reconstruct equal person, household, relationship, itinerary, encounter, location, event, and manifestation values;
- camera movement, render quality, backend, and observation order do not change those semantics;
- two independently initialized local observers agree on semantic identity and events;
- the production browser journey, fallback, accessibility checks, and committed local performance budgets pass on the documented profiles.

## Non-claims

The MVP does not claim:

- ten billion independent minds, agents, processes, records, or conversational entities are running;
- a manifested person has an internal consciousness, private agent loop, or memory outside the deterministic query contract;
- the fictional population describes real people, demographics, places, cultures, histories, or policy outcomes;
- the software proves emergence as a law of physics, biology, sociology, consciousness, or metaphysics;
- weighted visible figures are one-to-one pixels for all represented people;
- WebGPU is available everywhere or pixels are identical across GPUs/browsers;
- the local observer link synchronizes remote users or supplies a network protocol.

## Model limitations

- The scenario is a single repeating fictional 24-hour day with 24 authoritative activity ticks. It has no aging, births, deaths, migration history, economics, interiors, editable society, or generational change.
- Geography, names, households, places, relationships, itineraries, and encounters are deliberately bounded procedural constructions. Coherence and replayability are tested; realism is not established.
- Lantern Tide and the closure branch are one peaceful signature event and one reversible route intervention, not a general event authoring system.
- Sparse events and analytical routes summarize behavior. They do not simulate every movement continuously.
- Stable IDs are meaningful only inside the versioned identity epoch, seed, and baseline/branch contract.

## Visual and browser limitations

- The renderer displays weighted deterministic tokens. The fallback tier uses 25,000, baseline 250,000, and optional showcase one million tokens; lowering density does not lower the represented population.
- Canvas is the guaranteed local fallback. WebGPU capability and performance vary by browser, hardware, and driver.
- Chromium 151, WebKit 26.5, and a Pixel 7 Chromium emulation were validated. Firefox was absent from the validation machine, explicitly unvalidated, and not counted as passing.
- Automated accessibility reported no serious or critical Axe findings in the canonical Chromium audit, but automation is not a substitute for evaluation with every assistive-technology/browser combination.
- Performance numbers describe the committed M1 Max profile; they are not promises for arbitrary hardware.

## Living-city target limitations

- The [living-city contract](LIVING_CITY.md) is the M4 target, not evidence that the target renderer is already implemented or that final visual quality has passed.
- Brindle Bay geometry is a compact seeded fictional projection. It is not real geography, a remote map, a navigation product, or an urban-planning model.
- Walking between hourly ticks uses an explicit presentation phase and pure route interpolation. It does not add authoritative minute ticks, persist continuous agent state, or claim physically realistic pedestrian behavior.
- Distant figures remain weighted manifestations. Recognizable silhouettes do not imply one visible figure per represented person, and a selected weight-one identity remains a reconstructed semantic query rather than a stored agent.
- Literal-figure density, frame, memory, upload, draw, picking, resize, and transition budgets remain uncommitted until issue #32 measures the bounded renderer spike on the named profile.

## Persistence and compatibility limitations

- Only local format version 1 is supported. Unknown, newer, malformed, or hash-invalid snapshots fail closed.
- No migration exists yet because there is no second format version. Any future migration must be offline, deterministic, explicit, and fixture-backed.
- Person links contain reconstruction inputs and remain local. They are not durable public URLs or shared sessions.

## Deferred networking and deployment

Servers, networking, remote synchronization, databases, accounts, CI, Pages, containers, deployment, cloud services, and production operations are not implemented. They are intentionally deferred until after the local MVP gate and have no runbook here.
