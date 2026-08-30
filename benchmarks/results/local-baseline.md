# Local benchmark baseline

- Revision: `8145a582c96ffa33d52ba88c16e40b54a3e3edc9`
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
| simulationCellsPerSecond      | 664496831.43 |
| snapshotSerializeMiBPerSecond |       430.29 |
| replaySnapshotsPerSecond      |      2487.39 |
| identitiesPerSecond           | 495396773.18 |
| baselineFrameTimeP95Ms        |        92.61 |
| browserMemoryMiB              |         9.54 |
| startupMs                     |       461.22 |

## Render tiers

| Tier     | Manifestations | p50 frame ms | p95 frame ms |
| -------- | -------------: | -----------: | -----------: |
| fallback |          25000 |         7.72 |         9.02 |
| baseline |         250000 |        86.73 |        92.61 |
| showcase |        1000000 |       353.14 |       362.49 |

The CPU workloads use the current production-compatible typed-array/integer seams. They are scaffold workloads, not final world-kernel claims, and must be replaced in-place as #6–#14 add production layouts. The 250k/60 FPS and 256 MiB figures remain aspirations; the regression command enforces only coarse catastrophic limits to avoid noisy M0 micro-thresholds.
