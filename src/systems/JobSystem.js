/**
 * JobSystem — 자원 채취 작업 처리 (ChopTree, MineRock)
 * 완료 시 GameTime에 직접 집계하지 않고 DroppedItem을 맵에 스폰합니다.
 */
import { defineQuery } from 'bitecs';
import { Position, ColonistState, JobWorker, IsColonist, Resource, } from '../ecs/components';
const workerQ = defineQuery([IsColonist, Position, ColonistState, JobWorker]);
const WORK_RATE = 14; // units per second
export function jobSystem(ecsWorld, time, delta, jobQueue, worldMap, onResourceDied) {
    const mult = time.multiplier;
    if (mult === 0)
        return;
    const dt = delta * mult;
    const eids = workerQ(ecsWorld);
    for (const eid of eids) {
        if (ColonistState.state[eid] !== 2 /* ColonistStateId.Working */)
            continue;
        const jobId = JobWorker.jobId[eid];
        if (jobId === -1) {
            ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
            continue;
        }
        const job = [...jobQueue._all.values()].find((j) => j.id === jobId);
        if (!job) {
            JobWorker.jobId[eid] = -1;
            ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
            continue;
        }
        // Build/Haul 작업은 각자 시스템에서 처리
        if (job.type === 3 /* JobTypeId.Build */ || job.type === 2 /* JobTypeId.Haul */)
            continue;
        const targetEid = job.targetEid;
        if (Resource.health[targetEid] <= 0) {
            jobQueue.complete(job);
            JobWorker.jobId[eid] = -1;
            ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
            continue;
        }
        // Deal damage
        job.workDone += WORK_RATE * dt;
        const dmg = Math.floor(WORK_RATE * dt);
        if (dmg > 0)
            Resource.health[targetEid] = Math.max(0, Resource.health[targetEid] - dmg);
        const dead = Resource.health[targetEid] <= 0 || job.workDone >= job.workRequired;
        if (dead) {
            const { itemKind, amount } = _calcDrop(targetEid, worldMap);
            jobQueue.complete(job);
            JobWorker.jobId[eid] = -1;
            ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
            onResourceDied(targetEid, itemKind, amount);
        }
    }
}
function _calcDrop(eid, worldMap) {
    const kind = Resource.kind[eid];
    // Free tile
    const { tx, ty } = worldMap.worldToTile(Position.x[eid], Position.y[eid]);
    worldMap.setBlocked(tx, ty, false);
    if (kind === 0 /* ResourceTypeId.Tree */) {
        return { itemKind: 0 /* ItemKind.Wood */, amount: 8 + Math.floor(Math.random() * 12) };
    }
    else {
        return { itemKind: 1 /* ItemKind.Stone */, amount: 5 + Math.floor(Math.random() * 10) };
    }
}
