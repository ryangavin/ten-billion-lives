# Local benchmark baseline

- Revision: `551f0b008c2d83a3c0d7451c9b16b80edcc38b35`
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
| simulationCellsPerSecond      | 706217677.53 |
| snapshotSerializeMiBPerSecond |       361.56 |
| replaySnapshotsPerSecond      |      1494.57 |
| identitiesPerSecond           | 561324726.35 |
| baselineFrameTimeP95Ms        |        84.45 |
| browserMemoryMiB              |        14.50 |
| startupMs                     |       953.66 |

## Render tiers

| Tier     | Manifestations | p50 frame ms | p95 frame ms |
| -------- | -------------: | -----------: | -----------: |
| fallback |          25000 |         7.25 |         9.25 |
| baseline |         250000 |        77.76 |        84.45 |
| showcase |        1000000 |       314.73 |       328.90 |

The CPU workloads use the current production-compatible typed-array/integer seams. They are scaffold workloads, not final world-kernel claims, and must be replaced in-place as #6–#14 add production layouts. The 250k/60 FPS and 256 MiB figures remain aspirations; the regression command enforces only coarse catastrophic limits to avoid noisy M0 micro-thresholds.
