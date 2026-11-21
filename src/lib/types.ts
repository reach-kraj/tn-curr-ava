/** Compact dataset written by scripts/build-data.ts to public/data/tn.json. */
export type Ring = [number, number][];

/** [code, name, lon, lat, trainsStopping] */
export type StationRow = [string, string, number, number, number];

/**
 * [number, name, originCode, destCode, originDepMin, daysMask, startYmd, endYmd, destArrMin]
 * Times are minutes from 00:00 on the day the train leaves its origin (can exceed 1440).
 * daysMask: bit 0 = Monday … bit 6 = Sunday, for the origin date.
 */
export type TrainRow = [string, string, string, string, number, number, string, string, number | null];

/** [trainIndex, arrMin (-1 at origin), depMin (-1 at destination)] */
export type StopRow = [number, number, number];

export interface Dataset {
  feed: string;
  s: StationRow[];
  o: Record<string, string>;
  t: TrainRow[];
  st: Record<string, StopRow[]>;
  /** rail links between stations (map era; not shipped to the site) */
  e?: [number, number][];
  /** Tamil Nadu outline: also used by the in-browser sync to decide which stations are in Tamil Nadu */
  b: Ring[];
  /** neighbouring state outlines (map era; not shipped to the site) */
  nb?: { n: string; r: Ring }[];
}

export interface Station {
  i: number;
  code: string;
  name: string;
  lon: number;
  lat: number;
  n: number;
}

export interface TrainStop {
  station: Station;
  arr: number;
  dep: number;
}
