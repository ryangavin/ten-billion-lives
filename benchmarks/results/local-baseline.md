# Local benchmark baseline

- Revision: `e02cd1250bbe0a26f492a975f8ab9df803db3e35`
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
| simulationCellsPerSecond      | 624048868.08 |
| snapshotSerializeMiBPerSecond |       398.60 |
| replaySnapshotsPerSecond      |      2460.86 |
| identitiesPerSecond           | 510551569.28 |
| baselineFrameTimeP95Ms        |        89.00 |
| browserMemoryMiB              |         9.54 |
| startupMs                     |       493.82 |

## Render tiers

| Tier     | Manifestations | p50 frame ms | p95 frame ms |
| -------- | -------------: | -----------: | -----------: |
| fallback |          25000 |         7.63 |         9.95 |
| baseline |         250000 |        86.42 |        89.00 |
| showcase |        1000000 |       354.21 |       358.51 |

The CPU workloads use the current production-compatible typed-array/integer seams. They are scaffold workloads, not final world-kernel claims, and must be replaced in-place as #6–#14 add production layouts. The 250k/60 FPS and 256 MiB figures remain aspirations; the regression command enforces only coarse catastrophic limits to avoid noisy M0 micro-thresholds.
