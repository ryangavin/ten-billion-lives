import { manifestPlaceholder } from "../packages/manifest/src/placeholder.ts";
import {
  createPlaceholderSnapshot,
  replayPlaceholder,
} from "../packages/sim/src/snapshot.ts";

const snapshot = replayPlaceholder(createPlaceholderSnapshot(), 0);
const person = manifestPlaceholder({
  seed: snapshot.seed,
  checkpoint: snapshot,
  region: "brindle-bay/harbor-street",
  tick: snapshot.tick,
  lod: "person",
});

console.log(
  JSON.stringify({
    stateHash: snapshot.stateHash,
    eventHash: snapshot.eventHash,
    traceHash: person.traceHash,
    personId: person.personId,
  }),
);
