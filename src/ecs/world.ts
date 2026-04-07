/**
 * ECS World — entity factories and global ECS state
 */
import { createWorld, addEntity, addComponent, IWorld } from 'bitecs'
import {
  Position, Hunger, Energy, Mood,
  ColonistState, JobWorker, IdleTimer,
  Resource, IsColonist, IsResource,
} from './components'
import { ColonistStateId, ResourceTypeId } from '../types'

export const world: IWorld = createWorld()

// ─── Non-ECS side-data (Phaser can't live in TypedArrays) ────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const gfxMap = new Map<number, any>() // Phaser.GameObjects.Graphics

/** eid → path of world-pixel waypoints */
export const pathMap = new Map<number, { x: number; y: number }[]>()

/** eid → current waypoint index */
export const pathIdx = new Map<number, number>()

/** eid → display name (colonists) */
export const nameMap = new Map<number, string>()

/** eid → hex color (colonists) */
export const colorMap = new Map<number, number>()

// ─── Entity factories ─────────────────────────────────────────────────────────

export function spawnColonist(
  wx: number,
  wy: number,
  name: string,
  color: number,
): number {
  const eid = addEntity(world)

  addComponent(world, Position,       eid)
  addComponent(world, Hunger,         eid)
  addComponent(world, Energy,         eid)
  addComponent(world, Mood,           eid)
  addComponent(world, ColonistState,  eid)
  addComponent(world, JobWorker,      eid)
  addComponent(world, IdleTimer,      eid)
  addComponent(world, IsColonist,     eid)

  Position.x[eid]          = wx
  Position.y[eid]          = wy
  Hunger.value[eid]         = 100
  Energy.value[eid]         = 100
  Mood.value[eid]           = 75
  ColonistState.state[eid]  = ColonistStateId.Idle
  JobWorker.jobId[eid]      = -1
  JobWorker.workTimer[eid]  = 0
  IdleTimer.elapsed[eid]    = 0

  nameMap.set(eid, name)
  colorMap.set(eid, color)

  return eid
}

export function spawnResource(
  wx: number,
  wy: number,
  kind: ResourceTypeId,
): number {
  const eid = addEntity(world)

  addComponent(world, Position,    eid)
  addComponent(world, Resource,    eid)
  addComponent(world, IsResource,  eid)

  Position.x[eid]          = wx
  Position.y[eid]          = wy
  Resource.kind[eid]        = kind
  const hp = kind === ResourceTypeId.Tree ? 80 : 150
  Resource.health[eid]      = hp
  Resource.maxHealth[eid]   = hp
  Resource.designated[eid]  = 0

  return eid
}
