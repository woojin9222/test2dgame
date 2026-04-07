/**
 * RenderSystem — ECS 데이터를 Phaser Graphics로 시각화
 * Bevy: fn render_system(query: Query<(&Position, &ColonistState, &Hunger, &Energy)>)
 */
import { defineQuery, IWorld } from 'bitecs'
import {
  Position, ColonistState, JobWorker,
  Hunger, Energy, Resource,
  Building, DroppedItem,
  IsColonist, IsResource, IsBuilding, IsDroppedItem,
} from '../ecs/components'
import { gfxMap, nameMap, colorMap } from '../ecs/world'
import { ColonistStateId, ResourceTypeId, BuildingKind, ItemKind, BUILDING_DEFS } from '../types'
import { TILE_SIZE } from '../managers/WorldMap'

const colonistQ  = defineQuery([IsColonist,    Position, ColonistState, Hunger, Energy])
const resourceQ  = defineQuery([IsResource,    Position, Resource])
const buildingQ  = defineQuery([IsBuilding,    Position, Building])
const droppedQ   = defineQuery([IsDroppedItem, Position, DroppedItem])

// State indicator colors (hex)
const STATE_COLORS: Record<ColonistStateId, number> = {
  [ColonistStateId.Idle]:      0xffffff,
  [ColonistStateId.Moving]:    0x00eeff,
  [ColonistStateId.Working]:   0xffee00,
  [ColonistStateId.Eating]:    0xff8800,
  [ColonistStateId.Sleeping]:  0x4488ff,
  [ColonistStateId.Wandering]: 0x88ff88,
}

export function renderColonists(ecsWorld: IWorld): void {
  const eids = colonistQ(ecsWorld)

  for (const eid of eids) {
    const gfx = gfxMap.get(eid)
    if (!gfx) continue

    const x = Position.x[eid]
    const y = Position.y[eid]
    const state  = ColonistState.state[eid] as ColonistStateId
    const hunger = Hunger.value[eid]
    const energy = Energy.value[eid]
    const color  = colorMap.get(eid) ?? 0x00ffff

    gfx.clear()
    gfx.x = x
    gfx.y = y

    // Shadow
    gfx.fillStyle(0x000000, 0.25)
    gfx.fillEllipse(0, 9, 20, 7)

    // Body
    gfx.fillStyle(color, 1)
    gfx.fillCircle(0, 0, 10)
    gfx.lineStyle(1.5, 0xffffff, 1)
    gfx.strokeCircle(0, 0, 10)

    // State dot
    gfx.fillStyle(STATE_COLORS[state], 1)
    gfx.fillCircle(0, -14, 4)
    gfx.lineStyle(1, 0xffffff, 0.8)
    gfx.strokeCircle(0, -14, 4)

    // Hunger bar
    _bar(gfx, -12, 13, 24, 3, hunger / 100,
      hunger > 30 ? 0x33cc33 : 0xff2222)

    // Energy bar
    _bar(gfx, -12, 18, 24, 3, energy / 100,
      energy > 30 ? 0x2266ff : 0xff8800)
  }
}

export function renderResources(ecsWorld: IWorld): void {
  const eids = resourceQ(ecsWorld)

  for (const eid of eids) {
    const gfx = gfxMap.get(eid)
    if (!gfx) continue

    const x = Position.x[eid]
    const y = Position.y[eid]
    const kind       = Resource.kind[eid] as ResourceTypeId
    const health     = Resource.health[eid]
    const maxHealth  = Resource.maxHealth[eid]
    const designated = Resource.designated[eid] === 1

    gfx.clear()
    gfx.x = x
    gfx.y = y

    if (designated) {
      gfx.fillStyle(0xffff00, 0.3)
      gfx.fillCircle(0, 0, 16)
    }

    if (kind === ResourceTypeId.Tree) {
      _drawTree(gfx)
    } else {
      _drawRock(gfx)
    }

    // Health bar (only if damaged)
    if (health < maxHealth) {
      _bar(gfx, -12, 14, 24, 3, health / maxHealth,
        health / maxHealth > 0.5 ? 0x33cc33 : 0xff4444)
    }
  }
}

// ─── Buildings ────────────────────────────────────────────────────────────────

export function renderBuildings(ecsWorld: IWorld): void {
  const eids = buildingQ(ecsWorld)
  for (const eid of eids) {
    const gfx = gfxMap.get(eid)
    if (!gfx) continue

    gfx.clear()
    gfx.x = Position.x[eid]
    gfx.y = Position.y[eid]

    const kind      = Building.kind[eid] as BuildingKind
    const isBuilt   = Building.isBuilt[eid] === 1
    const progress  = Building.buildProgress[eid] / 100
    const alpha     = isBuilt ? 1.0 : 0.45 + progress * 0.3

    _drawBuilding(gfx, kind, isBuilt, alpha, progress)
  }
}

function _drawBuilding(gfx: any, kind: BuildingKind, isBuilt: boolean, alpha: number, progress: number): void {
  const half = TILE_SIZE / 2

  switch (kind) {
    case BuildingKind.Wall:
      gfx.fillStyle(0x888899, alpha)
      gfx.fillRect(-half, -half, TILE_SIZE, TILE_SIZE)
      if (isBuilt) {
        gfx.fillStyle(0xaaaacc, 0.3)
        gfx.fillRect(-half, -half, TILE_SIZE, 4)
        gfx.lineStyle(1, 0x555566, 0.8)
        gfx.strokeRect(-half, -half, TILE_SIZE, TILE_SIZE)
      }
      break

    case BuildingKind.Floor:
      gfx.fillStyle(0xc8a060, alpha)
      gfx.fillRect(-half, -half, TILE_SIZE, TILE_SIZE)
      if (isBuilt) {
        gfx.lineStyle(1, 0x997744, 0.4)
        gfx.strokeRect(-half + 4, -half + 4, TILE_SIZE - 8, TILE_SIZE - 8)
      }
      break

    case BuildingKind.Door:
      gfx.fillStyle(0x8b5e2e, alpha)
      gfx.fillRect(-half, -half, 4, TILE_SIZE)
      gfx.fillRect(half - 4, -half, 4, TILE_SIZE)
      gfx.fillRect(-half, -half, TILE_SIZE, 4)
      gfx.fillStyle(0xd4882a, alpha * 0.7)
      gfx.fillRect(-half + 4, -half + 4, TILE_SIZE - 8, TILE_SIZE - 8)
      break

    case BuildingKind.Stockpile:
      gfx.fillStyle(0xddbb44, 0.25)
      gfx.fillRect(-half, -half, TILE_SIZE, TILE_SIZE)
      gfx.lineStyle(2, 0xddbb44, 0.6)
      gfx.strokeRect(-half + 1, -half + 1, TILE_SIZE - 2, TILE_SIZE - 2)
      break

    case BuildingKind.Container:
      gfx.fillStyle(0x6b4c2a, alpha)
      gfx.fillRect(-half + 2, -half + 2, TILE_SIZE - 4, TILE_SIZE - 4)
      gfx.fillStyle(0x9b7a4a, alpha)
      gfx.fillRect(-half + 2, -half + 2, TILE_SIZE - 4, 6)
      gfx.lineStyle(1, 0x4a3010, alpha)
      gfx.strokeRect(-half + 2, -half + 2, TILE_SIZE - 4, TILE_SIZE - 4)
      break
  }

  // 건설 중 → 파란 진행 바 (Stockpile 제외)
  if (!isBuilt && kind !== BuildingKind.Stockpile) {
    // 반투명 배경
    gfx.fillStyle(0x000000, 0.4)
    gfx.fillRect(-half, half - 6, TILE_SIZE, 5)
    // 진행량
    gfx.fillStyle(0x44aaff, 0.9)
    gfx.fillRect(-half, half - 6, TILE_SIZE * progress, 5)
    // 테두리
    gfx.lineStyle(1, 0x4488ff, 0.6)
    gfx.strokeRect(-half, -half, TILE_SIZE, TILE_SIZE)
  }
}

// ─── Dropped Items ────────────────────────────────────────────────────────────

export function renderDroppedItems(ecsWorld: IWorld): void {
  const eids = droppedQ(ecsWorld)
  for (const eid of eids) {
    const gfx = gfxMap.get(eid)
    if (!gfx) continue

    gfx.clear()
    gfx.x = Position.x[eid]
    gfx.y = Position.y[eid]

    const kind   = DroppedItem.kind[eid] as ItemKind
    const amount = DroppedItem.amount[eid]

    switch (kind) {
      case ItemKind.Wood:
        gfx.fillStyle(0x8b5e2e, 1)
        gfx.fillRect(-7, -4, 14, 8)
        gfx.fillStyle(0xc89050, 1)
        gfx.fillRect(-6, -5, 12, 3)
        break
      case ItemKind.Stone:
        gfx.fillStyle(0x777788, 1)
        gfx.fillCircle(0, 0, 7)
        gfx.fillStyle(0x9999aa, 0.6)
        gfx.fillCircle(-2, -2, 3)
        break
      case ItemKind.Food:
        gfx.fillStyle(0xdd4422, 1)
        gfx.fillCircle(0, 0, 6)
        gfx.fillStyle(0x44aa22, 1)
        gfx.fillRect(-1, -8, 2, 5)
        break
    }
  }
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

function _bar(
  gfx: any,
  bx: number, by: number,
  w: number, h: number,
  fill: number,
  color: number,
): void {
  gfx.fillStyle(0x111111, 1)
  gfx.fillRect(bx, by, w, h)
  if (fill > 0) {
    gfx.fillStyle(color, 1)
    gfx.fillRect(bx, by, w * fill, h)
  }
}

function _drawTree(gfx: any): void {
  // Trunk
  gfx.fillStyle(0x7a5230, 1)
  gfx.fillRect(-3, 2, 6, 9)
  // Canopy layers
  gfx.fillStyle(0x1a7a20, 1)
  gfx.fillCircle(-2, -5, 9)
  gfx.fillStyle(0x229932, 1)
  gfx.fillCircle(2, -7, 9)
  gfx.fillStyle(0x33cc44, 1)
  gfx.fillCircle(0, -9, 10)
  // Highlight
  gfx.fillStyle(0x55ee66, 0.6)
  gfx.fillCircle(-3, -12, 4)
}

function _drawRock(gfx: any): void {
  gfx.fillStyle(0x888890, 1)
  gfx.fillTriangle(-11, 5, 0, -12, 13, 4)
  gfx.fillRect(-11, 4, 24, 5)
  // Shadow side
  gfx.fillStyle(0x555560, 1)
  gfx.fillTriangle(2, -12, 13, 4, 6, -2)
  // Highlight
  gfx.fillStyle(0xaaaacc, 0.7)
  gfx.fillCircle(-4, -5, 3)
}
