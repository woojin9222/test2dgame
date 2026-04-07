/**
 * ECS World — entity factories and global ECS state
 */
import { createWorld, addEntity, addComponent } from 'bitecs';
import { Position, Hunger, Energy, Mood, ColonistState, JobWorker, IdleTimer, Resource, IsColonist, IsResource, } from './components';
export const world = createWorld();
// ─── Non-ECS side-data (Phaser can't live in TypedArrays) ────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const gfxMap = new Map(); // Phaser.GameObjects.Graphics
/** eid → path of world-pixel waypoints */
export const pathMap = new Map();
/** eid → current waypoint index */
export const pathIdx = new Map();
/** eid → display name (colonists) */
export const nameMap = new Map();
/** eid → hex color (colonists) */
export const colorMap = new Map();
// ─── Entity factories ─────────────────────────────────────────────────────────
export function spawnColonist(wx, wy, name, color) {
    const eid = addEntity(world);
    addComponent(world, Position, eid);
    addComponent(world, Hunger, eid);
    addComponent(world, Energy, eid);
    addComponent(world, Mood, eid);
    addComponent(world, ColonistState, eid);
    addComponent(world, JobWorker, eid);
    addComponent(world, IdleTimer, eid);
    addComponent(world, IsColonist, eid);
    Position.x[eid] = wx;
    Position.y[eid] = wy;
    Hunger.value[eid] = 100;
    Energy.value[eid] = 100;
    Mood.value[eid] = 75;
    ColonistState.state[eid] = 0 /* ColonistStateId.Idle */;
    JobWorker.jobId[eid] = -1;
    JobWorker.workTimer[eid] = 0;
    IdleTimer.elapsed[eid] = 0;
    nameMap.set(eid, name);
    colorMap.set(eid, color);
    return eid;
}
export function spawnResource(wx, wy, kind) {
    const eid = addEntity(world);
    addComponent(world, Position, eid);
    addComponent(world, Resource, eid);
    addComponent(world, IsResource, eid);
    Position.x[eid] = wx;
    Position.y[eid] = wy;
    Resource.kind[eid] = kind;
    const hp = kind === 0 /* ResourceTypeId.Tree */ ? 80 : 150;
    Resource.health[eid] = hp;
    Resource.maxHealth[eid] = hp;
    Resource.designated[eid] = 0;
    return eid;
}
