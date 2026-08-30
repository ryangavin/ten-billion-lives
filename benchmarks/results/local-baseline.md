# Local benchmark baseline

Revision: `b4c3c010279781b1470b470a0195c15101d6ad1b`  
Seed: `ten-billion-lives/benchmark/v1`  
Profile: `apple-m1-max-32gb-chromium`  
Browser: 151.0.7922.34

## Capability

- WebGPU navigator: true
- WebGPU adapter: false
- Selected profile: **fallback**
- Canvas2D fallback: available

## Metrics

| Metric                        |       Result |
| ----------------------------- | -----------: |
| simulationCellsPerSecond      | 651694220.01 |
| snapshotSerializeMiBPerSecond |       414.04 |
| replaySnapshotsPerSecond      |      2532.15 |
| identitiesPerSecond           | 499106100.97 |
| baselineFrameTimeP95Ms        |        88.08 |
| browserMemoryMiB              |         9.54 |
| startupMs                     |        57.88 |

## Render tiers

| Tier     | Manifestations | p50 frame ms | p95 frame ms |
| -------- | -------------: | -----------: | -----------: |
| fallback |          25000 |         7.62 |         9.80 |
| baseline |         250000 |        86.33 |        88.08 |
| showcase |        1000000 |       352.69 |       354.43 |

The CPU workloads use the current production-compatible typed-array/integer seams. They are scaffold workloads, not final world-kernel claims, and must be replaced in-place as #6–#14 add production layouts. The 250k/60 FPS and 256 MiB figures remain aspirations; the regression command enforces only coarse catastrophic limits to avoid noisy M0 micro-thresholds.
