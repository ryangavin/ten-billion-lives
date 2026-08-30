# Local benchmark baseline

- Revision: `e5d291976b8eb5b926e07ba1bc26e0d3a425aa6b`
- Seed: `ten-billion-lives/benchmark/v1`
- Profile: `apple-m1-max-32gb-chromium`
- Browser: 151.0.7922.34

## Capability

- WebGPU navigator: true
- WebGPU adapter: false
- Selected profile: **fallback**
- Canvas2D fallback: available

## Metrics

| Metric                        |       Result |
| ----------------------------- | -----------: |
| simulationCellsPerSecond      | 596064045.48 |
| snapshotSerializeMiBPerSecond |       438.28 |
| replaySnapshotsPerSecond      |      2466.28 |
| identitiesPerSecond           | 567590363.22 |
| baselineFrameTimeP95Ms        |        87.94 |
| browserMemoryMiB              |        14.50 |
| startupMs                     |      1008.32 |

## Render tiers

| Tier     | Manifestations | p50 frame ms | p95 frame ms |
| -------- | -------------: | -----------: | -----------: |
| fallback |          25000 |         7.69 |         8.96 |
| baseline |         250000 |        82.62 |        87.94 |
| showcase |        1000000 |       338.56 |       345.11 |

The CPU workloads use the current production-compatible typed-array/integer seams. They are scaffold workloads, not final world-kernel claims, and must be replaced in-place as #6–#14 add production layouts. The 250k/60 FPS and 256 MiB figures remain aspirations; the regression command enforces only coarse catastrophic limits to avoid noisy M0 micro-thresholds.
