/**
 * NeedsSystem — 배고픔/체력/기분 감소 및 임계치 처리
 * Bevy: fn needs_system(mut query: Query<(&mut Hunger, &mut Energy, &mut ColonistState)>)
 */
import { defineQuery } from 'bitecs';
import { Hunger, Energy, Mood, ColonistState, IdleTimer, IsColonist } from '../ecs/components';
const colonistQ = defineQuery([IsColonist, Hunger, Energy, Mood, ColonistState]);
const HUNGER_DRAIN = 0.06; // per second at 1x speed
const ENERGY_DRAIN = 0.04;
export function needsSystem(ecsWorld, time, delta) {
    const mult = time.multiplier;
    if (mult === 0)
        return;
    const dt = delta * mult;
    const eids = colonistQ(ecsWorld);
    for (const eid of eids) {
        Hunger.value[eid] = Math.max(0, Hunger.value[eid] - HUNGER_DRAIN * dt);
        Energy.value[eid] = Math.max(0, Energy.value[eid] - ENERGY_DRAIN * dt);
        // Mood drifts toward average need satisfaction
        const sat = (Hunger.value[eid] + Energy.value[eid]) / 200;
        Mood.value[eid] += (sat * 100 - Mood.value[eid]) * 0.01 * dt;
        const state = ColonistState.state[eid];
        // Critical hunger → force eat (unless already eating/sleeping)
        if (Hunger.value[eid] < 15 && state !== 3 /* ColonistStateId.Eating */) {
            ColonistState.state[eid] = 3 /* ColonistStateId.Eating */;
            IdleTimer.elapsed[eid] = 0;
        }
        // Critical energy → force sleep (if not critical hunger too)
        else if (Energy.value[eid] < 15 && state !== 4 /* ColonistStateId.Sleeping */ && Hunger.value[eid] > 30) {
            ColonistState.state[eid] = 4 /* ColonistStateId.Sleeping */;
            IdleTimer.elapsed[eid] = 0;
        }
    }
}
/** Recovery while eating / sleeping */
export function recoverySystem(ecsWorld, time, delta) {
    const mult = time.multiplier;
    if (mult === 0)
        return;
    const dt = delta * mult;
    const eids = colonistQ(ecsWorld);
    for (const eid of eids) {
        const state = ColonistState.state[eid];
        if (state === 3 /* ColonistStateId.Eating */) {
            Hunger.value[eid] = Math.min(100, Hunger.value[eid] + 22 * dt);
            if (Hunger.value[eid] >= 90)
                ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
        }
        if (state === 4 /* ColonistStateId.Sleeping */) {
            Energy.value[eid] = Math.min(100, Energy.value[eid] + 16 * dt);
            if (Energy.value[eid] >= 90)
                ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
        }
    }
}
