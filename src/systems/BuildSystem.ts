/**
 * BuildSystem — 콜로니스트가 청사진 건물을 완성시키는 시스템
 */
import { defineQuery, IWorld } from 'bitecs'
import { Position, ColonistState, JobWorker, IsColonist } from '../ecs/components'
import { Building } from '../ecs/components'
import { ColonistStateId } from '../types'
import { GameTime } from '../managers/GameTime'
import { JobQueue } from '../managers/JobQueue'
import { BuildingManager } from '../managers/BuildingManager'
import { JobTypeId } from '../types'

const workerQ = defineQuery([IsColonist, Position, ColonistState, JobWorker])

const BUILD_RATE = 20  // buildProgress units per second

export function buildSystem(
  ecsWorld: IWorld,
  time: GameTime,
  delta: number,
  jobQueue: JobQueue,
  buildingMgr: BuildingManager,
): void {
  const mult = time.multiplier
  if (mult === 0) return

  const dt   = delta * mult
  const eids = workerQ(ecsWorld)

  for (const eid of eids) {
    if (ColonistState.state[eid] !== ColonistStateId.Working) continue

    const jobId = JobWorker.jobId[eid]
    if (jobId === -1) continue

    // Find matching job
    const job = (jobQueue as any)._all.get(jobId) ??
                [...(jobQueue as any)._all.values()].find((j: any) => j.id === jobId)
    if (!job || job.type !== JobTypeId.Build) continue

    const targetEid = job.targetEid
    if (!buildingMgr.buildingEids.has(targetEid)) {
      // Building was removed
      jobQueue.complete(job)
      JobWorker.jobId[eid] = -1
      ColonistState.state[eid] = ColonistStateId.Idle
      continue
    }

    // Progress construction
    job.workDone += BUILD_RATE * dt
    Building.buildProgress[targetEid] = Math.min(100, (job.workDone / job.workRequired) * 100)

    if (job.workDone >= job.workRequired) {
      buildingMgr.finishBuilding(targetEid)
      jobQueue.complete(job)
      JobWorker.jobId[eid] = -1
      ColonistState.state[eid] = ColonistStateId.Idle
    }
  }
}
