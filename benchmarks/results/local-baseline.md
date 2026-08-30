# Local benchmark baseline

- Revision: `8ba96464fcfd7c17b7726d37663a5c146adb7d74`
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
| simulationCellsPerSecond      | 658883378.87 |
| snapshotSerializeMiBPerSecond |       435.68 |
| replaySnapshotsPerSecond      |      2465.96 |
| identitiesPerSecond           | 545504335.12 |
| baselineFrameTimeP95Ms        |        87.99 |
| browserMemoryMiB              |         9.54 |
| startupMs                     |       166.48 |

## Render tiers

| Tier     | Manifestations | p50 frame ms | p95 frame ms |
| -------- | -------------: | -----------: | -----------: |
| fallback |          25000 |         7.58 |         9.50 |
| baseline |         250000 |        82.79 |        87.99 |
| showcase |        1000000 |       335.89 |       344.76 |

The CPU workloads use the current production-compatible typed-array/integer seams. They are scaffold workloads, not final world-kernel claims, and must be replaced in-place as #6–#14 add production layouts. The 250k/60 FPS and 256 MiB figures remain aspirations; the regression command enforces only coarse catastrophic limits to avoid noisy M0 micro-thresholds.
