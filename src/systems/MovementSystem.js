/**
 * MovementSystem — A* 경로를 따라 이동, 도착 시 상태 전환
 * Bevy: fn movement_system(mut query: Query<(&mut Position, &mut Path, &ColonistState)>)
 */
import { defineQuery } from 'bitecs';
import { Position, ColonistState, JobWorker, IdleTimer, IsColonist } from '../ecs/components';
import { pathMap, pathIdx } from '../ecs/world';
const movingQ = defineQuery([IsColonist, Position, ColonistState]);
const SPEED = 80; // px / second
export function movementSystem(ecsWorld, time, delta, jobQueue) {
    const mult = time.multiplier;
    if (mult === 0)
        return;
    const dt = delta * mult;
    const move = SPEED * dt;
    const eids = movingQ(ecsWorld);
    for (const eid of eids) {
        const state = ColonistState.state[eid];
        const isMoving = state === 1 /* ColonistStateId.Moving */;
        const isWandering = state === 5 /* ColonistStateId.Wandering */;
        if (!isMoving && !isWandering)
            continue;
        const path = pathMap.get(eid);
        if (!path || path.length === 0) {
            _arrive(eid, isMoving, jobQueue);
            continue;
        }
        let idx = pathIdx.get(eid) ?? 0;
        if (idx >= path.length) {
            _arrive(eid, isMoving, jobQueue);
            continue;
        }
        const wp = path[idx];
        const dx = wp.x - Position.x[eid];
        const dy = wp.y - Position.y[eid];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 3) {
            idx++;
            pathIdx.set(eid, idx);
            if (idx >= path.length) {
                _arrive(eid, isMoving, jobQueue);
            }
        }
        else {
            const step = Math.min(move, dist);
            Position.x[eid] += (dx / dist) * step;
            Position.y[eid] += (dy / dist) * step;
        }
    }
}
function _arrive(eid, wasMovingToJob, jobQueue) {
    pathMap.delete(eid);
    pathIdx.delete(eid);
    if (wasMovingToJob) {
        const jobId = JobWorker.jobId[eid];
        if (jobId !== -1) {
            ColonistState.state[eid] = 2 /* ColonistStateId.Working */;
        }
        else {
            ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
        }
    }
    else {
        // Wander done → idle
        ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
        IdleTimer.elapsed[eid] = 0;
    }
}
