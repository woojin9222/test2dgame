// ─── Enums ────────────────────────────────────────────────────────────────────

export const enum TileType {
  Grass     = 0,
  Dirt      = 1,
  Stone     = 2,
  DeepStone = 3,
  Water     = 4,
}

export const enum ColonistStateId {
  Idle      = 0,
  Moving    = 1,
  Working   = 2,
  Eating    = 3,
  Sleeping  = 4,
  Wandering = 5,
}

export const enum ResourceTypeId {
  Tree = 0,
  Rock = 1,
}

export const enum JobTypeId {
  ChopTree = 0,
  MineRock = 1,
  Haul     = 2,
  Build    = 3,
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number
  y: number
}

export interface TileVec2 {
  tx: number
  ty: number
}

export interface JobEntry {
  id: number
  type: JobTypeId
  /** World-pixel location */
  wx: number
  wy: number
  /** Tile location */
  tx: number
  ty: number
  /** ECS entity id of the target resource */
  targetEid: number
  priority: number
  workRequired: number
  workDone: number
  assignedEid: number   // -1 = unassigned
}

export const STATE_NAMES: Record<ColonistStateId, string> = {
  [ColonistStateId.Idle]:      'Idle',
  [ColonistStateId.Moving]:    'Moving',
  [ColonistStateId.Working]:   'Working',
  [ColonistStateId.Eating]:    'Eating',
  [ColonistStateId.Sleeping]:  'Sleeping',
  [ColonistStateId.Wandering]: 'Wandering',
}

export const JOB_NAMES: Record<JobTypeId, string> = {
  [JobTypeId.ChopTree]: 'Chopping tree',
  [JobTypeId.MineRock]: 'Mining rock',
  [JobTypeId.Haul]:     'Hauling',
  [JobTypeId.Build]:    'Building',
}
