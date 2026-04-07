/**
 * BuildingManager — 건물 배치, 타일 레이어 관리
 * 각 타일에 어떤 건물 EID가 있는지 추적합니다.
 */
import { removeEntity } from 'bitecs'
import { world, spawnBuilding, gfxMap } from '../ecs/world'
import { Building, Position } from '../ecs/components'
import { BuildingKind, BuildingDef, BUILDING_DEFS, ItemKind } from '../types'
import { WorldMap, TILE_SIZE, MAP_W, MAP_H } from './WorldMap'
import { JobQueue } from './JobQueue'
import { JobTypeId } from '../types'
import { GameTime } from './GameTime'

/** tile index → building eid (0 = empty) */
const NO_BUILDING = 0

export class BuildingManager {
  /** Flat array [ty * MAP_W + tx] → eid or 0 */
  private _tiles: Int32Array = new Int32Array(MAP_W * MAP_H)

  /** All building eids */
  readonly buildingEids: Set<number> = new Set()

  /** Stockpile tile set (tx,ty) → true */
  readonly stockpileTiles: Set<string> = new Set()

  private _worldMap: WorldMap
  private _jobQueue: JobQueue
  private _gameTime: GameTime

  constructor(worldMap: WorldMap, jobQueue: JobQueue, gameTime: GameTime) {
    this._worldMap = worldMap
    this._jobQueue = jobQueue
    this._gameTime = gameTime
  }

  // ─── Queries ──────────────────────────────────────────────────────────────────

  getAt(tx: number, ty: number): number {
    return this._tiles[ty * MAP_W + tx] ?? NO_BUILDING
  }

  isEmpty(tx: number, ty: number): boolean {
    return this.getAt(tx, ty) === NO_BUILDING
  }

  isStockpile(tx: number, ty: number): boolean {
    return this.stockpileTiles.has(`${tx},${ty}`)
  }

  /** Returns true if a building can be placed on this tile */
  canPlace(tx: number, ty: number, kind: BuildingKind): boolean {
    if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H) return false
    if (!this.isEmpty(tx, ty)) return false
    if (!this._worldMap.isWalkable(tx, ty)) return false
    return true
  }

  // ─── Placement ────────────────────────────────────────────────────────────────

  /**
   * Place a building blueprint (or instant for Stockpile).
   * Returns the new eid, or -1 if placement failed.
   */
  place(tx: number, ty: number, kind: BuildingKind): number {
    if (!this.canPlace(tx, ty, kind)) return -1

    const def = BUILDING_DEFS[kind]
    const { wx, wy } = this._worldMap.tileToWorld(tx, ty)

    // Check resources for instant builds
    if (!def.instantBuild) {
      if (this._gameTime.wood  < def.costWood)  return -1
      if (this._gameTime.stone < def.costStone) return -1
      this._gameTime.wood  -= def.costWood
      this._gameTime.stone -= def.costStone
    }

    const isInstant = def.instantBuild
    const eid = spawnBuilding(wx, wy, kind, isInstant, def.hp)

    this._tiles[ty * MAP_W + tx] = eid
    this.buildingEids.add(eid)

    if (kind === BuildingKind.Stockpile) {
      this.stockpileTiles.add(`${tx},${ty}`)
    }

    // 즉시 배치가 아닌 경우 → 경로탐색 차단 + 건설 작업 등록
    if (!isInstant) {
      this._worldMap.setBlocked(tx, ty, true)
      this._jobQueue.addJob(JobTypeId.Build, tx, ty, eid)
    } else {
      // Stockpile은 walkable 유지
    }

    return eid
  }

  /** Called by BuildSystem when construction completes */
  finishBuilding(eid: number): void {
    Building.isBuilt[eid] = 1
    Building.buildProgress[eid] = 100

    const kind = Building.kind[eid] as BuildingKind
    const def  = BUILDING_DEFS[kind]

    if (!def.walkable) {
      // 벽 등 → 경로탐색 계속 차단
    } else {
      // 바닥/문 → 통행 가능하게
      const { tx, ty } = this._worldMap.worldToTile(Position.x[eid], Position.y[eid])
      this._worldMap.setBlocked(tx, ty, false)
    }
  }

  /** Remove a building (deconstruct or destroy) */
  remove(tx: number, ty: number): void {
    const eid = this.getAt(tx, ty)
    if (eid === NO_BUILDING) return

    this._tiles[ty * MAP_W + tx] = NO_BUILDING
    this.buildingEids.delete(eid)
    this.stockpileTiles.delete(`${tx},${ty}`)

    // Unblock tile
    this._worldMap.setBlocked(tx, ty, false)
    this._jobQueue.cancelByTarget(eid)

    const gfx = gfxMap.get(eid)
    if (gfx) { gfx.destroy(); gfxMap.delete(eid) }
    removeEntity(world, eid)
  }

  /** Find nearest stockpile tile from world position, returns world coords or null */
  findNearestStockpile(wx: number, wy: number): { wx: number; wy: number } | null {
    let best: { wx: number; wy: number } | null = null
    let bestDist = Infinity

    for (const key of this.stockpileTiles) {
      const [tx, ty] = key.split(',').map(Number)
      const { wx: swx, wy: swy } = this._worldMap.tileToWorld(tx, ty)
      const d = Math.hypot(swx - wx, swy - wy)
      if (d < bestDist) { bestDist = d; best = { wx: swx, wy: swy } }
    }
    return best
  }
}
