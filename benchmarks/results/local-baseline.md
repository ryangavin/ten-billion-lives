# Local benchmark baseline

Revision: `3c80c122665242f1a49f5d40f3a6b056314a818c`  
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
| simulationCellsPerSecond      | 639245681.77 |
| snapshotSerializeMiBPerSecond |       422.07 |
| replaySnapshotsPerSecond      |      2448.13 |
| identitiesPerSecond           | 540613596.43 |
| baselineFrameTimeP95Ms        |        88.68 |
| browserMemoryMiB              |         9.54 |
| startupMs                     |        58.02 |

## Render tiers

| Tier     | Manifestations | p50 frame ms | p95 frame ms |
| -------- | -------------: | -----------: | -----------: |
| fallback |          25000 |         7.80 |        10.11 |
| baseline |         250000 |        85.60 |        88.68 |
| showcase |        1000000 |       349.57 |       356.55 |

The CPU workloads use the current production-compatible typed-array/integer seams. They are scaffold workloads, not final world-kernel claims, and must be replaced in-place as #6–#14 add production layouts. The 250k/60 FPS and 256 MiB figures remain aspirations; the regression command enforces only coarse catastrophic limits to avoid noisy M0 micro-thresholds.
