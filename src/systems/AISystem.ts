/**
 * AISystem — 콜로니스트 의사결정 (Idle 상태에서 작업/배회 결정)
 * Bevy: fn ai_system(mut query: Query<...>, res: Res<JobQueue>, res2: Res<WorldMap>)
 */
import { defineQuery, IWorld } from 'bitecs'
import {
  Position, ColonistState, JobWorker, IdleTimer, IsColonist,
  Hunger, Energy,
} from '../ecs/components'
import { pathMap, pathIdx } from '../ecs/world'
import { ColonistStateId } from '../types'
import { GameTime } from '../managers/GameTime'
import { JobQueue } from '../managers/JobQueue'
import { WorldMap } from '../managers/WorldMap'

const idleQ = defineQuery([IsColonist, Position, ColonistState, JobWorker, IdleTimer])

const WANDER_AFTER = 3.5  // seconds idle before wandering
const JOB_POLL    = 0.5   // seconds between job polls

let _pollTimer = 0

export function aiSystem(
  ecsWorld: IWorld,
  time: GameTime,
  delta: number,
  jobQueue: JobQueue,
  worldMap: WorldMap,
): void {
  const mult = time.multiplier
  if (mult === 0) return

  const dt = delta * mult

  _pollTimer += dt
  const doPoll = _pollTimer >= JOB_POLL
  if (doPoll) _pollTimer = 0

  const eids = idleQ(ecsWorld)

  for (const eid of eids) {
    const state = ColonistState.state[eid] as ColonistStateId
    if (state !== ColonistStateId.Idle) continue

    IdleTimer.elapsed[eid] += dt

    // Skip if needs are critical (NeedsSystem handles state override)
    if (Hunger.value[eid] < 15 || Energy.value[eid] < 15) continue

    if (!doPoll) continue

    // Try to claim a job
    const job = jobQueue.claim(eid)
    if (job) {
      const wx = Position.x[eid]
      const wy = Position.y[eid]
      const path = worldMap.findPath(wx, wy, job.wx, job.wy)

      if (path.length === 0) {
        // Unreachable — return job and stay idle
        jobQueue.returnJob(job)
      } else {
        JobWorker.jobId[eid] = job.id
        pathMap.set(eid, path)
        pathIdx.set(eid, 0)
        ColonistState.state[eid] = ColonistStateId.Moving
        IdleTimer.elapsed[eid] = 0
      }
      continue
    }

    // No job → wander after timeout
    if (IdleTimer.elapsed[eid] >= WANDER_AFTER) {
      _startWander(eid, worldMap)
    }
  }
}

function _startWander(eid: number, worldMap: WorldMap): void {
  const wx = Position.x[eid]
  const wy = Position.y[eid]
  const { tx, ty } = worldMap.worldToTile(wx, wy)

  for (let attempt = 0; attempt < 12; attempt++) {
    const dtx = Math.round((Math.random() - 0.5) * 10)
    const dty = Math.round((Math.random() - 0.5) * 10)
    const ntx = tx + dtx, nty = ty + dty

    if (!worldMap.isWalkable(ntx, nty)) continue
    const { wx: twx, wy: twy } = worldMap.tileToWorld(ntx, nty)
    const path = worldMap.findPath(wx, wy, twx, twy)

    if (path.length > 0) {
      pathMap.set(eid, path)
      pathIdx.set(eid, 0)
      ColonistState.state[eid] = ColonistStateId.Wandering
      IdleTimer.elapsed[eid] = 0
      return
    }
  }
}
