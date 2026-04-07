/**
 * RenderSystem — ECS 데이터를 Phaser Graphics로 시각화
 * Bevy: fn render_system(query: Query<(&Position, &ColonistState, &Hunger, &Energy)>)
 */
import { defineQuery } from 'bitecs';
import { Position, ColonistState, Hunger, Energy, Resource, IsColonist, IsResource, } from '../ecs/components';
import { gfxMap, colorMap } from '../ecs/world';
const colonistQ = defineQuery([IsColonist, Position, ColonistState, Hunger, Energy]);
const resourceQ = defineQuery([IsResource, Position, Resource]);
// State indicator colors (hex)
const STATE_COLORS = {
    [0 /* ColonistStateId.Idle */]: 0xffffff,
    [1 /* ColonistStateId.Moving */]: 0x00eeff,
    [2 /* ColonistStateId.Working */]: 0xffee00,
    [3 /* ColonistStateId.Eating */]: 0xff8800,
    [4 /* ColonistStateId.Sleeping */]: 0x4488ff,
    [5 /* ColonistStateId.Wandering */]: 0x88ff88,
};
export function renderColonists(ecsWorld) {
    const eids = colonistQ(ecsWorld);
    for (const eid of eids) {
        const gfx = gfxMap.get(eid);
        if (!gfx)
            continue;
        const x = Position.x[eid];
        const y = Position.y[eid];
        const state = ColonistState.state[eid];
        const hunger = Hunger.value[eid];
        const energy = Energy.value[eid];
        const color = colorMap.get(eid) ?? 0x00ffff;
        gfx.clear();
        gfx.x = x;
        gfx.y = y;
        // Shadow
        gfx.fillStyle(0x000000, 0.25);
        gfx.fillEllipse(0, 9, 20, 7);
        // Body
        gfx.fillStyle(color, 1);
        gfx.fillCircle(0, 0, 10);
        gfx.lineStyle(1.5, 0xffffff, 1);
        gfx.strokeCircle(0, 0, 10);
        // State dot
        gfx.fillStyle(STATE_COLORS[state], 1);
        gfx.fillCircle(0, -14, 4);
        gfx.lineStyle(1, 0xffffff, 0.8);
        gfx.strokeCircle(0, -14, 4);
        // Hunger bar
        _bar(gfx, -12, 13, 24, 3, hunger / 100, hunger > 30 ? 0x33cc33 : 0xff2222);
        // Energy bar
        _bar(gfx, -12, 18, 24, 3, energy / 100, energy > 30 ? 0x2266ff : 0xff8800);
    }
}
export function renderResources(ecsWorld) {
    const eids = resourceQ(ecsWorld);
    for (const eid of eids) {
        const gfx = gfxMap.get(eid);
        if (!gfx)
            continue;
        const x = Position.x[eid];
        const y = Position.y[eid];
        const kind = Resource.kind[eid];
        const health = Resource.health[eid];
        const maxHealth = Resource.maxHealth[eid];
        const designated = Resource.designated[eid] === 1;
        gfx.clear();
        gfx.x = x;
        gfx.y = y;
        if (designated) {
            gfx.fillStyle(0xffff00, 0.3);
            gfx.fillCircle(0, 0, 16);
        }
        if (kind === 0 /* ResourceTypeId.Tree */) {
            _drawTree(gfx);
        }
        else {
            _drawRock(gfx);
        }
        // Health bar (only if damaged)
        if (health < maxHealth) {
            _bar(gfx, -12, 14, 24, 3, health / maxHealth, health / maxHealth > 0.5 ? 0x33cc33 : 0xff4444);
        }
    }
}
// ─── Drawing helpers ──────────────────────────────────────────────────────────
function _bar(gfx, bx, by, w, h, fill, color) {
    gfx.fillStyle(0x111111, 1);
    gfx.fillRect(bx, by, w, h);
    if (fill > 0) {
        gfx.fillStyle(color, 1);
        gfx.fillRect(bx, by, w * fill, h);
    }
}
function _drawTree(gfx) {
    // Trunk
    gfx.fillStyle(0x7a5230, 1);
    gfx.fillRect(-3, 2, 6, 9);
    // Canopy layers
    gfx.fillStyle(0x1a7a20, 1);
    gfx.fillCircle(-2, -5, 9);
    gfx.fillStyle(0x229932, 1);
    gfx.fillCircle(2, -7, 9);
    gfx.fillStyle(0x33cc44, 1);
    gfx.fillCircle(0, -9, 10);
    // Highlight
    gfx.fillStyle(0x55ee66, 0.6);
    gfx.fillCircle(-3, -12, 4);
}
function _drawRock(gfx) {
    gfx.fillStyle(0x888890, 1);
    gfx.fillTriangle(-11, 5, 0, -12, 13, 4);
    gfx.fillRect(-11, 4, 24, 5);
    // Shadow side
    gfx.fillStyle(0x555560, 1);
    gfx.fillTriangle(2, -12, 13, 4, 6, -2);
    // Highlight
    gfx.fillStyle(0xaaaacc, 0.7);
    gfx.fillCircle(-4, -5, 3);
}
