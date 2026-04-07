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

export const enum BuildingKind {
  Wall      = 0,   // Stone 4개, walkable=false
  Floor     = 1,   // Wood 2개
  Door      = 2,   // Wood 3개, walkable=true
  Stockpile = 3,   // 무료, 즉시 배치
  Container = 4,   // Wood 5개, 아이템 저장
}

export const enum ItemKind {
  Wood  = 0,
  Stone = 1,
  Food  = 2,
}

// 건물 회전 방향 (컨베이어용, 미래 확장)
export const enum Rotation {
  Right = 0,
  Down  = 1,
  Left  = 2,
  Up    = 3,
}

/** 건물 종류별 메타데이터 */
export interface BuildingDef {
  kind: BuildingKind
  label: string
  emoji: string
  costWood: number
  costStone: number
  walkable: boolean
  instantBuild: boolean  // true = 자재 없이 즉시 배치 (Stockpile)
  hp: number
}

export const BUILDING_DEFS: Record<BuildingKind, BuildingDef> = {
  [BuildingKind.Wall]: {
    kind: BuildingKind.Wall, label: '벽', emoji: '🧱',
    costWood: 0, costStone: 4, walkable: false, instantBuild: false, hp: 200,
  },
  [BuildingKind.Floor]: {
    kind: BuildingKind.Floor, label: '바닥', emoji: '🟫',
    costWood: 2, costStone: 0, walkable: true, instantBuild: false, hp: 50,
  },
  [BuildingKind.Door]: {
    kind: BuildingKind.Door, label: '문', emoji: '🚪',
    costWood: 3, costStone: 0, walkable: true, instantBuild: false, hp: 80,
  },
  [BuildingKind.Stockpile]: {
    kind: BuildingKind.Stockpile, label: '창고', emoji: '📦',
    costWood: 0, costStone: 0, walkable: true, instantBuild: true, hp: 1,
  },
  [BuildingKind.Container]: {
    kind: BuildingKind.Container, label: '보관함', emoji: '🗃️',
    costWood: 5, costStone: 0, walkable: false, instantBuild: false, hp: 60,
  },
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
  [JobTypeId.ChopTree]: '나무 베기',
  [JobTypeId.MineRock]: '채굴',
  [JobTypeId.Haul]:     '운반',
  [JobTypeId.Build]:    '건설',
}
