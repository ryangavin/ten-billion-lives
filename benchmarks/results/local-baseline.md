# Local benchmark baseline

- Revision: `22561b1e02e645cfda91785c00750b9561cb6cdd`
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
| simulationCellsPerSecond      | 648291996.51 |
| snapshotSerializeMiBPerSecond |       434.56 |
| replaySnapshotsPerSecond      |      2574.20 |
| identitiesPerSecond           | 507356671.74 |
| baselineFrameTimeP95Ms        |        90.10 |
| browserMemoryMiB              |        14.50 |
| startupMs                     |       301.09 |

## Render tiers

| Tier     | Manifestations | p50 frame ms | p95 frame ms |
| -------- | -------------: | -----------: | -----------: |
| fallback |          25000 |         8.13 |        10.23 |
| baseline |         250000 |        88.58 |        90.10 |
| showcase |        1000000 |       362.64 |       370.38 |

The CPU workloads use the current production-compatible typed-array/integer seams. They are scaffold workloads, not final world-kernel claims, and must be replaced in-place as #6–#14 add production layouts. The 250k/60 FPS and 256 MiB figures remain aspirations; the regression command enforces only coarse catastrophic limits to avoid noisy M0 micro-thresholds.
