import {
  CanonicalWriter,
  fnv1a64,
  largestRemainder,
  randomU32,
} from "./deterministic.js";

export const BASELINE_WORLD_SEED = "ten-billion-lives/baseline/v1" as const;
export const WORLD_LEVEL = 5 as const;
export const WORLD_POPULATION = 10_000_000_000n;

export type Biome =
  | "ocean"
  | "tundra"
  | "boreal"
  | "grassland"
  | "woodland"
  | "desert"
  | "rainforest";

export interface CellBounds {
  readonly northMicrodegrees: number;
  readonly southMicrodegrees: number;
  readonly westMicrodegrees: number;
  readonly eastMicrodegrees: number;
}

export interface WorldCell {
  readonly id: string;
  readonly level: typeof WORLD_LEVEL;
  readonly row: number;
  readonly column: number;
  readonly bounds: CellBounds;
  readonly elevationMeters: number;
  readonly temperatureCentiC: number;
  readonly moisturePermille: number;
  readonly biome: Biome;
  readonly land: boolean;
  readonly population: bigint;
  readonly regionId: string;
  readonly displayName: string;
}

export interface Settlement {
  readonly id: string;
  readonly name: string;
  readonly cellId: string;
  readonly row: number;
  readonly column: number;
  readonly population: bigint;
  readonly neighborhoodIds: readonly string[];
  readonly transportAnchorId: string;
}

export interface Region {
  readonly id: string;
  readonly name: string;
  readonly cellId: string;
  readonly population: bigint;
}

export interface FictionalWorld {
  readonly schemaVersion: 1;
  readonly seed: string;
  readonly level: typeof WORLD_LEVEL;
  readonly rows: number;
  readonly columns: number;
  readonly totalPopulation: typeof WORLD_POPULATION;
  readonly cells: readonly WorldCell[];
  readonly regions: readonly Region[];
  readonly settlements: readonly Settlement[];
  readonly neighborhoodIds: readonly string[];
  readonly transportAnchorIds: readonly string[];
  readonly worldHash: string;
}

interface CellDraft extends Omit<WorldCell, "population"> {
  readonly habitability: bigint;
}

function dimensions(level: number): { rows: number; columns: number } {
  if (!Number.isInteger(level) || level < 0 || level > WORLD_LEVEL)
    throw new RangeError("cell level out of range");
  return { rows: 2 ** level, columns: 2 ** (level + 1) };
}

function parseCellId(id: string): {
  level: number;
  row: number;
  column: number;
} {
  const match = /^L(\d+)\/(\d+)\/(\d+)$/.exec(id);
  if (!match) throw new RangeError(`malformed cell id: ${id}`);
  const level = Number(match[1]);
  const row = Number(match[2]);
  const column = Number(match[3]);
  const size = dimensions(level);
  if (row < 0 || row >= size.rows || column < 0 || column >= size.columns)
    throw new RangeError(`cell id out of bounds: ${id}`);
  return { level, row, column };
}

function cellId(level: number, row: number, column: number): string {
  return `L${level}/${row}/${column}`;
}

function seedWord(seed: string): bigint {
  return fnv1a64(new TextEncoder().encode(seed));
}

function noise(
  seed: bigint,
  level: number,
  row: number,
  column: number,
): number {
  const { columns } = dimensions(level);
  const counter = BigInt(level * 1_000_000 + row * columns + column);
  return randomU32("world/geography", seed, counter);
}

function nameFrom(seed: bigint, domain: string, ordinal: number): string {
  const starts = ["br", "d", "f", "l", "m", "n", "s", "v", "w", "z"];
  const middles = ["a", "e", "i", "o", "u", "ae", "ia", "ou"];
  const ends = ["la", "len", "mere", "na", "ra", "rin", "sa", "vale", "wen"];
  const word = randomU32(domain, seed, BigInt(ordinal));
  const start = starts[word % starts.length] ?? "m";
  const middle = middles[(word >>> 8) % middles.length] ?? "a";
  const end = ends[(word >>> 16) % ends.length] ?? "ra";
  const raw = `${start}${middle}${end}`;
  return `${raw[0]?.toUpperCase() ?? "A"}${raw.slice(1)}`;
}

function createDraft(seed: bigint, row: number, column: number): CellDraft {
  const { rows, columns } = dimensions(WORLD_LEVEL);
  const coarse = noise(seed, 2, row >> 3, column >> 3) % 2_001;
  const medium = noise(seed, 4, row >> 1, column >> 1) % 1_201;
  const fine = noise(seed, WORLD_LEVEL, row, column) % 801;
  const latitudeDistance = Math.abs(rows - 1 - row * 2);
  const elevationMeters =
    coarse - 900 + medium - 600 + fine - 400 - latitudeDistance * 8;
  const land = elevationMeters >= -240;
  const moisturePermille = land
    ? noise(seed, WORLD_LEVEL, row, column + columns) % 1_001
    : 1_000;
  const temperatureCentiC = Math.trunc(
    3_100 - latitudeDistance * 175 - Math.max(0, elevationMeters) / 4,
  );
  const biome: Biome = !land
    ? "ocean"
    : temperatureCentiC < -200
      ? "tundra"
      : temperatureCentiC < 700
        ? "boreal"
        : moisturePermille < 180
          ? "desert"
          : moisturePermille < 430
            ? "grassland"
            : temperatureCentiC > 2_200 && moisturePermille > 700
              ? "rainforest"
              : "woodland";
  const latitudeWeight = BigInt(Math.max(1, rows - latitudeDistance));
  const climateWeight = BigInt(
    Math.trunc(Math.max(1, 1_100 - Math.abs(1_650 - temperatureCentiC) / 3)),
  );
  const habitability = land
    ? latitudeWeight * climateWeight + BigInt(moisturePermille + 1)
    : 0n;
  const northMicrodegrees = 90_000_000 - row * (180_000_000 / rows);
  const southMicrodegrees = northMicrodegrees - 180_000_000 / rows;
  const westMicrodegrees = -180_000_000 + column * (360_000_000 / columns);
  const eastMicrodegrees = westMicrodegrees + 360_000_000 / columns;
  const regionRow = row >> 3;
  const regionColumn = column >> 3;
  return Object.freeze({
    id: cellId(WORLD_LEVEL, row, column),
    level: WORLD_LEVEL,
    row,
    column,
    bounds: Object.freeze({
      northMicrodegrees,
      southMicrodegrees,
      westMicrodegrees,
      eastMicrodegrees,
    }),
    elevationMeters: Math.trunc(elevationMeters),
    temperatureCentiC,
    moisturePermille,
    biome,
    land,
    regionId: `region-${regionRow}-${regionColumn}`,
    displayName: `Field ${row.toString(36).toUpperCase()}-${column.toString(36).toUpperCase()}`,
    habitability,
  });
}

export function generateWorld(
  seed: string = BASELINE_WORLD_SEED,
): FictionalWorld {
  if (seed.length === 0) throw new RangeError("world seed must not be empty");
  const numericSeed = seedWord(seed);
  const { rows, columns } = dimensions(WORLD_LEVEL);
  const drafts: CellDraft[] = [];
  for (let row = 0; row < rows; row += 1)
    for (let column = 0; column < columns; column += 1)
      drafts.push(createDraft(numericSeed, row, column));

  const rankedSettlementDrafts = drafts
    .filter((cell) => cell.land)
    .map((cell) => ({
      cell,
      priority:
        cell.habitability * 1_000_000n +
        BigInt(
          randomU32(
            "world/settlement-priority",
            numericSeed,
            BigInt(cell.row * columns + cell.column),
          ),
        ),
    }))
    .sort((left, right) =>
      left.priority === right.priority
        ? left.cell.id < right.cell.id
          ? -1
          : left.cell.id > right.cell.id
            ? 1
            : 0
        : left.priority > right.priority
          ? -1
          : 1,
    );
  const inhabitedRows = Array.from(
    new Set(rankedSettlementDrafts.map(({ cell }) => cell.row)),
  ).sort((left, right) => left - right);
  const latitudeDrafts = inhabitedRows.flatMap((row) => {
    const candidate = rankedSettlementDrafts.find(
      ({ cell }) => cell.row === row,
    );
    return candidate ? [candidate] : [];
  });
  const representedRegions = Array.from(
    new Set(rankedSettlementDrafts.map(({ cell }) => cell.regionId)),
  ).sort();
  const latitudeIds = new Set(latitudeDrafts.map(({ cell }) => cell.id));
  const regionalDrafts = representedRegions.flatMap((regionId) => {
    const candidate = rankedSettlementDrafts.find(
      ({ cell }) => cell.regionId === regionId && !latitudeIds.has(cell.id),
    );
    return candidate ? [candidate] : [];
  });
  const selectedIds = new Set(
    [...latitudeDrafts, ...regionalDrafts].map(({ cell }) => cell.id),
  );
  const settlementDrafts = [
    ...latitudeDrafts,
    ...regionalDrafts,
    ...rankedSettlementDrafts.filter(({ cell }) => !selectedIds.has(cell.id)),
  ].slice(0, 64);
  const settlementCells = new Set(settlementDrafts.map(({ cell }) => cell.id));
  const weights = drafts.map((cell) =>
    cell.land
      ? cell.habitability + (settlementCells.has(cell.id) ? 250_000n : 0n)
      : 0n,
  );
  const population = largestRemainder(WORLD_POPULATION, weights);
  const cells = Object.freeze(
    drafts.map((draft, index) =>
      Object.freeze({
        id: draft.id,
        level: draft.level,
        row: draft.row,
        column: draft.column,
        bounds: draft.bounds,
        elevationMeters: draft.elevationMeters,
        temperatureCentiC: draft.temperatureCentiC,
        moisturePermille: draft.moisturePermille,
        biome: draft.biome,
        land: draft.land,
        population: population[index] ?? 0n,
        regionId: draft.regionId,
        displayName: draft.displayName,
      }),
    ),
  );
  const settlements = Object.freeze(
    settlementDrafts.map(({ cell }, index) => {
      const id = `settlement-${index.toString().padStart(2, "0")}`;
      return Object.freeze({
        id,
        name: `${nameFrom(numericSeed, "world/settlement-name", index)} ${index.toString(36).toUpperCase()}`,
        cellId: cell.id,
        row: cell.row,
        column: cell.column,
        population: population[cell.row * columns + cell.column] ?? 0n,
        neighborhoodIds: Object.freeze([`${id}/harbor`, `${id}/garden`]),
        transportAnchorId: `anchor-${id}`,
      });
    }),
  );
  const regionKeys = Array.from(
    new Set(cells.map((cell) => cell.regionId)),
  ).sort();
  const regions = Object.freeze(
    regionKeys.map((id, index) => {
      const [row, column] = id.split("-").slice(1).map(Number);
      const regionCell = cellId(2, row ?? 0, column ?? 0);
      const regionPopulation = cells
        .filter((cell) => cell.regionId === id)
        .reduce((sum, cell) => sum + cell.population, 0n);
      return Object.freeze({
        id,
        name: `${nameFrom(numericSeed, "world/region-name", index)} Reach`,
        cellId: regionCell,
        population: regionPopulation,
      });
    }),
  );
  const writer = new CanonicalWriter("fictional-world", 1)
    .text(seed)
    .u32(WORLD_LEVEL)
    .u64(WORLD_POPULATION);
  for (const cell of cells)
    writer
      .text(cell.id)
      .i32(cell.elevationMeters)
      .i32(cell.temperatureCentiC)
      .u32(cell.moisturePermille)
      .text(cell.biome)
      .u64(cell.population)
      .text(cell.regionId);
  for (const settlement of settlements)
    writer
      .text(settlement.id)
      .text(settlement.name)
      .text(settlement.cellId)
      .u64(settlement.population);
  const worldHash = fnv1a64(writer.bytes()).toString(16).padStart(16, "0");
  return Object.freeze({
    schemaVersion: 1,
    seed,
    level: WORLD_LEVEL,
    rows,
    columns,
    totalPopulation: WORLD_POPULATION,
    cells,
    regions,
    settlements,
    neighborhoodIds: Object.freeze(
      settlements.flatMap((settlement) => settlement.neighborhoodIds),
    ),
    transportAnchorIds: Object.freeze(
      settlements.map((settlement) => settlement.transportAnchorId),
    ),
    worldHash,
  });
}

export function getCell(world: FictionalWorld, id: string): WorldCell {
  const parsed = parseCellId(id);
  if (parsed.level !== world.level)
    throw new RangeError("getCell requires a leaf cell id");
  const cell = world.cells[parsed.row * world.columns + parsed.column];
  if (!cell) throw new RangeError(`unknown cell: ${id}`);
  return cell;
}

export function parentOf(id: string): string {
  const { level, row, column } = parseCellId(id);
  if (level === 0) throw new RangeError("root cell has no parent");
  return cellId(level - 1, Math.floor(row / 2), Math.floor(column / 2));
}

export function childrenOf(id: string): readonly string[] {
  const { level, row, column } = parseCellId(id);
  if (level >= WORLD_LEVEL) throw new RangeError("leaf cell has no children");
  return Object.freeze([
    cellId(level + 1, row * 2, column * 2),
    cellId(level + 1, row * 2, column * 2 + 1),
    cellId(level + 1, row * 2 + 1, column * 2),
    cellId(level + 1, row * 2 + 1, column * 2 + 1),
  ]);
}

export function populationAt(world: FictionalWorld, id: string): bigint {
  const { level, row, column } = parseCellId(id);
  const scale = 2 ** (world.level - level);
  let total = 0n;
  for (let leafRow = row * scale; leafRow < (row + 1) * scale; leafRow += 1)
    for (
      let leafColumn = column * scale;
      leafColumn < (column + 1) * scale;
      leafColumn += 1
    )
      total +=
        world.cells[leafRow * world.columns + leafColumn]?.population ?? 0n;
  return total;
}

export function neighborsOf(
  world: FictionalWorld,
  id: string,
): Readonly<{ north: string; east: string; south: string; west: string }> {
  const { level, row, column } = parseCellId(id);
  if (level !== world.level)
    throw new RangeError("neighbors require a leaf cell id");
  const opposite = (column + world.columns / 2) % world.columns;
  return Object.freeze({
    north:
      row === 0 ? cellId(level, 0, opposite) : cellId(level, row - 1, column),
    east: cellId(level, row, (column + 1) % world.columns),
    south:
      row === world.rows - 1
        ? cellId(level, world.rows - 1, opposite)
        : cellId(level, row + 1, column),
    west: cellId(level, row, (column - 1 + world.columns) % world.columns),
  });
}
