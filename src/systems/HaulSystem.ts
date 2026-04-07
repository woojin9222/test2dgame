/**
 * HaulSystem — 맵에 떨어진 아이템을 창고로 운반하는 시스템
 *
 * 흐름:
 *   DroppedItem 스폰 → HaulSystem이 Haul 작업 생성
 *   → 콜로니스트가 아이템 위치로 이동 → 픽업 → 창고로 이동 → 보관
 */
import { defineQuery, IWorld, removeEntity } from 'bitecs'
import { Position, IsDroppedItem, DroppedItem, ColonistState, JobWorker, IsColonist } from '../ecs/components'
import { gfxMap, world, pathMap, pathIdx } from '../ecs/world'
import { ColonistStateId, ItemKind, JobTypeId } from '../types'
import { GameTime } from '../managers/GameTime'
import { JobQueue } from '../managers/JobQueue'
import { BuildingManager } from '../managers/BuildingManager'
import { WorldMap } from '../managers/WorldMap'

const droppedQ  = defineQuery([IsDroppedItem, Position, DroppedItem])
const colonistQ = defineQuery([IsColonist, Position, ColonistState, JobWorker])

/** eid → true: already has a haul job pending */
const _hasPendingHaul = new Set<number>()

/** eid → target item eid (colonist carrying an item) */
export const carryingItem = new Map<number, number>()
/** eid → destination world pos */
export const carryDest = new Map<number, { wx: number; wy: number }>()

export function haulSystem(
  ecsWorld: IWorld,
  time: GameTime,
  delta: number,
  jobQueue: JobQueue,
  buildingMgr: BuildingManager,
  worldMap: WorldMap,
  onItemDelivered: (kind: ItemKind, amount: number) => void,
): void {
  const mult = time.multiplier
  if (mult === 0) return

  // 1. 창고가 없으면 아무것도 안 함
  if (buildingMgr.stockpileTiles.size === 0) return

  // 2. 아직 haul 작업이 없는 드롭 아이템에 작업 생성
  const itemEids = droppedQ(ecsWorld)
  for (const itemEid of itemEids) {
    if (_hasPendingHaul.has(itemEid)) continue

    const stockpile = buildingMgr.findNearestStockpile(
      Position.x[itemEid],
      Position.y[itemEid],
    )
    if (!stockpile) continue

    const { tx, ty } = worldMap.worldToTile(Position.x[itemEid], Position.y[itemEid])
    jobQueue.addJob(JobTypeId.Haul, tx, ty, itemEid)
    _hasPendingHaul.add(itemEid)
  }

  // 3. Working 상태인 콜로니스트 중 haul 작업 중인 것 처리
  const colonistEids = colonistQ(ecsWorld)
  for (const cEid of colonistEids) {
    if (ColonistState.state[cEid] !== ColonistStateId.Working) continue

    const jobId = JobWorker.jobId[cEid]
    if (jobId === -1) continue

    const job = [...(jobQueue as any)._all.values()].find((j: any) => j.id === jobId)
    if (!job || job.type !== JobTypeId.Haul) continue

    const itemEid = job.targetEid

    // 아이템이 이미 없어진 경우
    if (DroppedItem.amount[itemEid] === undefined || DroppedItem.amount[itemEid] <= 0) {
      jobQueue.complete(job)
      JobWorker.jobId[cEid] = -1
      ColonistState.state[cEid] = ColonistStateId.Idle
      _hasPendingHaul.delete(itemEid)
      continue
    }

    // 콜로니스트가 아이템 위치에 도달했으므로 픽업 처리
    if (!carryingItem.has(cEid)) {
      // 픽업
      carryingItem.set(cEid, itemEid)
      const stockpile = buildingMgr.findNearestStockpile(
        Position.x[cEid],
        Position.y[cEid],
      )
      if (stockpile) {
        carryDest.set(cEid, stockpile)
        // 창고로 이동할 새 경로 설정 (JobSystem이 처리)
        job.wx = stockpile.wx
        job.wy = stockpile.wy
        const { tx, ty } = worldMap.worldToTile(stockpile.wx, stockpile.wy)
        job.tx = tx
        job.ty = ty
        // 콜로니스트를 다시 Moving 상태로 (창고로 이동)
        ColonistState.state[cEid] = ColonistStateId.Moving
        const path = worldMap.findPath(Position.x[cEid], Position.y[cEid], stockpile.wx, stockpile.wy)
        if (path.length > 0) {
          pathMap.set(cEid, path)
          pathIdx.set(cEid, 0)
        }
      }
      continue
    }

    // 창고에 도착 → 아이템 전달
    const kind   = DroppedItem.kind[itemEid] as ItemKind
    const amount = DroppedItem.amount[itemEid]
    onItemDelivered(kind, amount)

    // 아이템 엔티티 제거
    const gfx = gfxMap.get(itemEid)
    if (gfx) { gfx.destroy(); gfxMap.delete(itemEid) }
    removeEntity(world, itemEid)
    _hasPendingHaul.delete(itemEid)

    carryingItem.delete(cEid)
    carryDest.delete(cEid)
    jobQueue.complete(job)
    JobWorker.jobId[cEid] = -1
    ColonistState.state[cEid] = ColonistStateId.Idle
  }
}

export function cleanupHaulTracking(itemEid: number): void {
  _hasPendingHaul.delete(itemEid)
}
