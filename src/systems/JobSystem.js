/**
 * JobSystem — 작업 진행, 자원 채취, 완료 처리
 * Bevy: fn job_system(mut colonists: Query<...>, mut resources: Query<&mut Resource>)
 */
import { defineQuery } from 'bitecs';
import { Position, ColonistState, JobWorker, IsColonist, Resource, IsResource, } from '../ecs/components';
const workerQ = defineQuery([IsColonist, Position, ColonistState, JobWorker]);
const resourceQ = defineQuery([IsResource, Position, Resource]);
const WORK_RATE = 14; // units per second
/** jobId → JobEntry lookup (maintained externally via jobQueue._all) */
export function jobSystem(ecsWorld, time, delta, jobQueue, worldMap, onResourceDied) {
    const mult = time.multiplier;
    if (mult === 0)
        return;
    const dt = delta * mult;
    const eids = workerQ(ecsWorld);
    for (const eid of eids) {
        const state = ColonistState.state[eid];
        if (state !== 2 /* ColonistStateId.Working */)
            continue;
        const jobId = JobWorker.jobId[eid];
        if (jobId === -1) {
            ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
            continue;
        }
        // Find the job entry
        const job = [...jobQueue._all.values()].find((j) => j.id === jobId);
        if (!job) {
            // Job gone (maybe target already dead)
            JobWorker.jobId[eid] = -1;
            ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
            continue;
        }
        // Check target still alive
        const targetEid = job.targetEid;
        if (!isResourceAlive(ecsWorld, targetEid)) {
            jobQueue.complete(job);
            JobWorker.jobId[eid] = -1;
            ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
            continue;
        }
        // Deal work
        job.workDone += WORK_RATE * dt;
        // Damage the resource
        const dmg = Math.floor(WORK_RATE * dt);
        if (dmg > 0) {
            Resource.health[targetEid] = Math.max(0, Resource.health[targetEid] - dmg);
        }
        // Resource dead?
        if (Resource.health[targetEid] <= 0) {
            _harvestResource(ecsWorld, targetEid, time, worldMap);
            jobQueue.complete(job);
            JobWorker.jobId[eid] = -1;
            ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
            onResourceDied(targetEid);
            continue;
        }
        // Job complete (work threshold)?
        if (job.workDone >= job.workRequired) {
            _harvestResource(ecsWorld, targetEid, time, worldMap);
            jobQueue.complete(job);
            JobWorker.jobId[eid] = -1;
            ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
            onResourceDied(targetEid);
        }
    }
}
function isResourceAlive(ecsWorld, eid) {
    // Quick check: does it still have the Resource component data?
    return Resource.health[eid] > 0;
}
function _harvestResource(ecsWorld, eid, time, worldMap) {
    const kind = Resource.kind[eid];
    if (kind === 0 /* ResourceTypeId.Tree */) {
        const amount = 8 + Math.floor(Math.random() * 12);
        time.addResource('wood', amount);
    }
    else {
        const amount = 5 + Math.floor(Math.random() * 10);
        time.addResource('stone', amount);
    }
    // Free tile in worldMap
    const wx = Position.x[eid];
    const wy = Position.y[eid];
    const { tx, ty } = worldMap.worldToTile(wx, wy);
    worldMap.setBlocked(tx, ty, false);
}
