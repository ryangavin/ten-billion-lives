# Local world and replay formats

This contract freezes the formats consumed by the local manifestation layer after the M1 gate. They are local persistence formats, not wire protocols. They do not define servers, peers, synchronization, deployment, or compatibility with any remote service.

## Frozen versions

| Format                  | Version | Authority                                                               |
| ----------------------- | ------: | ----------------------------------------------------------------------- |
| Fictional world         |       1 | seed plus canonical world hash; static geography is regenerated locally |
| Sparse kernel event log |       1 | ordered `[version, id, tick, type, targetId]` rows                      |
| Local checkpoint        |       1 | canonical JSON encoded as UTF-8                                         |

The exported `WORLD_FORMAT_VERSION`, `EVENT_FORMAT_VERSION`, and `LOCAL_CHECKPOINT_VERSION` constants are semantic inputs. Changing one requires new golden fixtures and an explicit migration.

## Checkpoint contents

A version-1 checkpoint stores:

- schema and all three format versions;
- world seed and canonical world hash;
- field tick, canonical field hash, and dynamic integer activity/flow rows in authoritative cell order;
- sparse influences, active cell identities, and the last ordered flux ledger;
- sparse route command/events in `(tick, id)` order;
- canonical event and complete kernel hashes.

Static geography, cohorts, capacities, amenities, and neighbor identities are regenerated from the stored seed. Restore verifies their world hash, rebuilds the dynamic field state, recomputes every semantic hash, and rejects a mismatch. Person records, camera state, rendered pixels, wall-clock values, and locale-formatted text are never stored.

The serializer writes object fields and row arrays in a fixed order and emits no whitespace. Decimal strings encode authoritative nonnegative integers. The format is byte-stable for the same semantic state.

## Event ordering

Events are sparse commands, not a continuous traveler log. Version 1 supports `route-close` and `route-open`. Each event has a unique nonempty ID, nonnegative integer tick, and nonempty target edge identity. Inputs must already be ordered by tick and then ID; readers reject out-of-order or duplicate inputs rather than silently sorting them.

## Failure and migration policy

Readers fail closed with actionable errors for malformed UTF-8/JSON, unknown schema, unsupported versions or event types, invalid decimal integers, incorrect row shape/order/count, and world/field/event/kernel hash mismatch.

Version-1 readers never guess at later formats and never silently coerce them. A future version must add a deterministic, offline, one-version-at-a-time migration with before/after fixtures and hash evidence. Original inputs remain unchanged until the migrated output validates. Until such a migration exists, unsupported versions are rejected. There is no downgrade promise.

Small event and hash fixtures are committed under `packages/sim/fixtures`. Full baseline checkpoints are generated locally by the documented replay command so large state artifacts do not live in Git.
