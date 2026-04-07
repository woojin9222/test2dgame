/**
 * GameScene — 메인 게임 씬
 */
import Phaser from 'phaser'
import { removeEntity } from 'bitecs'

import { world, spawnColonist, spawnResource, spawnDroppedItem, gfxMap, nameMap, colorMap } from '../ecs/world'
import { Resource, IsResource, Position } from '../ecs/components'

import { WorldMap, TILE_SIZE, MAP_W, MAP_H, TILE_COLORS } from '../managers/WorldMap'
import { JobQueue } from '../managers/JobQueue'
import { GameTime } from '../managers/GameTime'
import { BuildingManager } from '../managers/BuildingManager'

import { needsSystem, recoverySystem } from '../systems/NeedsSystem'
import { movementSystem } from '../systems/MovementSystem'
import { aiSystem } from '../systems/AISystem'
import { jobSystem } from '../systems/JobSystem'
import { buildSystem } from '../systems/BuildSystem'
import { haulSystem, cleanupHaulTracking } from '../systems/HaulSystem'
import { renderColonists, renderResources, renderBuildings, renderDroppedItems } from '../systems/RenderSystem'

import { TileType, ResourceTypeId, JobTypeId, BuildingKind, ItemKind, BUILDING_DEFS } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

const NUM_TREES     = 200
const NUM_ROCKS     = 100
const NUM_COLONISTS = 3

const COLONIST_NAMES  = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank']
const COLONIST_COLORS = [0x00eeff, 0xffee00, 0xff88ff, 0xff8800, 0x88ff44, 0xff4444]

export class GameScene extends Phaser.Scene {
  // ─── Managers ────────────────────────────────────────────────────────────────
  worldMap!: WorldMap
  jobQueue!: JobQueue
  gameTime!: GameTime
  buildingMgr!: BuildingManager

  // ─── Phaser objects ──────────────────────────────────────────────────────────
  private _tileGfx!: Phaser.GameObjects.Graphics
  private _ghostGfx!: Phaser.GameObjects.Graphics  // 건축 미리보기

  // ─── Entity tracking ─────────────────────────────────────────────────────────
  private _resourceEids: Set<number> = new Set()
  private _colonistEids: number[] = []
  private _droppedEids: Set<number> = new Set()

  // ─── Camera ──────────────────────────────────────────────────────────────────
  private _panning = false
  private _panStart  = new Phaser.Math.Vector2()
  private _camStart  = new Phaser.Math.Vector2()

  // ─── Build mode ──────────────────────────────────────────────────────────────
  /** Currently selected building kind, or -1 = no build mode */
  activeBuildKind: number = -1
  private _dragStart: { tx: number; ty: number } | null = null
  private _dragging = false

  constructor() { super('Game') }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  create(): void {
    this.worldMap    = new WorldMap()
    this.jobQueue    = new JobQueue()
    this.gameTime    = new GameTime()
    this.buildingMgr = new BuildingManager(this.worldMap, this.jobQueue, this.gameTime)

    this._tileGfx = this.add.graphics()
    this._drawTiles()

    this._ghostGfx = this.add.graphics()
    this._ghostGfx.setDepth(10)

    this._spawnResources()
    this._spawnColonists()

    const cx = (MAP_W * TILE_SIZE) / 2
    const cy = (MAP_H * TILE_SIZE) / 2
    this.cameras.main.setZoom(1.6)
    this.cameras.main.centerOn(cx, cy)
    this.cameras.main.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE)

    this._setupInput()
    this.scene.launch('UI', { gameScene: this })
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000

    this.gameTime.tick(dt)

    // ── ECS Logic Systems ─────────────────────────────────────────────────────
    needsSystem(world, this.gameTime, dt)
    recoverySystem(world, this.gameTime, dt)
    aiSystem(world, this.gameTime, dt, this.jobQueue, this.worldMap)
    movementSystem(world, this.gameTime, dt, this.jobQueue)
    jobSystem(world, this.gameTime, dt, this.jobQueue, this.worldMap,
      (eid, itemKind, amount) => this._onResourceDied(eid, itemKind, amount))
    buildSystem(world, this.gameTime, dt, this.jobQueue, this.buildingMgr)
    haulSystem(world, this.gameTime, dt, this.jobQueue, this.buildingMgr, this.worldMap,
      (kind, amount) => this._onItemDelivered(kind, amount))

    // ── Render Systems ────────────────────────────────────────────────────────
    renderBuildings(world)
    renderDroppedItems(world)
    renderResources(world)
    renderColonists(world)

    // ── Build mode ghost preview ──────────────────────────────────────────────
    this._updateGhost()
  }

  // ─── World rendering ─────────────────────────────────────────────────────────

  private _drawTiles(): void {
    const g = this._tileGfx
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        const tile = this.worldMap.getTile(tx, ty)
        g.fillStyle(TILE_COLORS[tile], 1)
        g.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)
        g.lineStyle(1, 0x000000, 0.07)
        g.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      }
    }
  }

  // ─── Spawn helpers ────────────────────────────────────────────────────────────

  private _spawnResources(): void {
    let trees = 0, rocks = 0, attempts = 0
    while ((trees < NUM_TREES || rocks < NUM_ROCKS) && attempts < 10000) {
      attempts++
      const tx = Math.floor(Math.random() * MAP_W)
      const ty = Math.floor(Math.random() * MAP_H)
      const tile = this.worldMap.getTile(tx, ty)

      if (trees < NUM_TREES && tile === TileType.Grass && this.worldMap.isWalkable(tx, ty)) {
        this._makeResource(tx, ty, ResourceTypeId.Tree); trees++
      } else if (rocks < NUM_ROCKS &&
        (tile === TileType.Stone || tile === TileType.DeepStone) &&
        this.worldMap.isWalkable(tx, ty)) {
        this._makeResource(tx, ty, ResourceTypeId.Rock); rocks++
      }
    }
  }

  private _makeResource(tx: number, ty: number, kind: ResourceTypeId): void {
    const { wx, wy } = this.worldMap.tileToWorld(tx, ty)
    const eid = spawnResource(wx, wy, kind)
    gfxMap.set(eid, this.add.graphics())
    this._resourceEids.add(eid)
    this.worldMap.setBlocked(tx, ty, true)
  }

  private _spawnColonists(): void {
    const cx = Math.floor(MAP_W / 2)
    const cy = Math.floor(MAP_H / 2)
    for (let i = 0; i < NUM_COLONISTS; i++) {
      let tx = cx + Math.round((Math.random() - 0.5) * 6)
      let ty = cy + Math.round((Math.random() - 0.5) * 6)
      if (!this.worldMap.isWalkable(tx, ty)) { tx = cx; ty = cy }
      const { wx, wy } = this.worldMap.tileToWorld(tx, ty)
      const eid = spawnColonist(wx, wy, COLONIST_NAMES[i % COLONIST_NAMES.length], COLONIST_COLORS[i % COLONIST_COLORS.length])
      gfxMap.set(eid, this.add.graphics())
      this._colonistEids.push(eid)
    }
  }

  // ─── Build mode ──────────────────────────────────────────────────────────────

  enterBuildMode(kind: BuildingKind): void {
    this.activeBuildKind = kind
    this.events.emit('build-mode-changed', kind)
  }

  exitBuildMode(): void {
    this.activeBuildKind = -1
    this._dragStart = null
    this._dragging  = false
    this._ghostGfx.clear()
    this.events.emit('build-mode-changed', -1)
  }

  private _getDragTiles(from: { tx: number; ty: number }, to: { tx: number; ty: number }): { tx: number; ty: number }[] {
    const tiles: { tx: number; ty: number }[] = []
    const dx = Math.sign(to.tx - from.tx)
    const dy = Math.sign(to.ty - from.ty)

    if (Math.abs(to.tx - from.tx) >= Math.abs(to.ty - from.ty)) {
      // Horizontal drag
      let tx = from.tx
      while (tx !== to.tx + dx) { tiles.push({ tx, ty: from.ty }); tx += dx || 1 }
    } else {
      // Vertical drag
      let ty = from.ty
      while (ty !== to.ty + dy) { tiles.push({ tx: from.tx, ty }); ty += dy || 1 }
    }
    if (tiles.length === 0) tiles.push(from)
    return tiles
  }

  private _updateGhost(): void {
    if (this.activeBuildKind === -1) return
    this._ghostGfx.clear()

    const mouse  = this.input.activePointer
    const worldX = mouse.worldX
    const worldY = mouse.worldY
    const { tx: curTx, ty: curTy } = this.worldMap.worldToTile(worldX, worldY)

    const from = this._dragStart ?? { tx: curTx, ty: curTy }
    const tiles = this._getDragTiles(from, { tx: curTx, ty: curTy })

    const kind = this.activeBuildKind as BuildingKind

    for (const { tx, ty } of tiles) {
      const canPlace = this.buildingMgr.canPlace(tx, ty, kind)
      const color    = canPlace ? 0x44ff88 : 0xff4444
      const alpha    = 0.45

      this._ghostGfx.fillStyle(color, alpha)
      this._ghostGfx.fillRect(
        tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE
      )
      this._ghostGfx.lineStyle(2, color, 0.8)
      this._ghostGfx.strokeRect(
        tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE
      )
    }
  }

  private _confirmBuild(from: { tx: number; ty: number }, to: { tx: number; ty: number }): void {
    const kind  = this.activeBuildKind as BuildingKind
    const tiles = this._getDragTiles(from, to)

    for (const { tx, ty } of tiles) {
      const eid = this.buildingMgr.place(tx, ty, kind)
      if (eid !== -1) {
        gfxMap.set(eid, this.add.graphics())
        this.buildingMgr.buildingEids.add(eid)
      }
    }
  }

  // ─── Input ────────────────────────────────────────────────────────────────────

  private _longPressTimer: Phaser.Time.TimerEvent | null = null
  private _longPressPointer: Phaser.Input.Pointer | null = null
  private _didLongPress = false
  private _touchPanActive = false
  private _touchPanStart  = new Phaser.Math.Vector2()
  private _touchCamStart  = new Phaser.Math.Vector2()

  private _setupInput(): void {
    const cam      = this.cameras.main
    const isMobile = !this.sys.game.device.os.desktop

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!isMobile) {
        if (p.middleButtonDown()) {
          this._panning = true
          this._panStart.set(p.x, p.y)
          this._camStart.set(cam.scrollX, cam.scrollY)
        }
        if (p.rightButtonDown()) {
          if (this.activeBuildKind !== -1) { this.exitBuildMode(); return }
          this._onRightClick(p)
        }
        if (p.leftButtonDown()) {
          if (this.activeBuildKind !== -1) {
            const { tx, ty } = this.worldMap.worldToTile(p.worldX, p.worldY)
            this._dragStart = { tx, ty }
            this._dragging  = true
          } else {
            this._onLeftClick(p)
          }
        }
        return
      }

      // Mobile
      this._didLongPress = false
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        this._touchPanActive = true
        this._touchPanStart.set(p.x, p.y)
        this._touchCamStart.set(cam.scrollX, cam.scrollY)
        this._cancelLongPress()
        return
      }
      this._longPressPointer = p
      this._longPressTimer = this.time.addEvent({
        delay: 600,
        callback: () => {
          this._didLongPress = true
          if (this._longPressPointer) this._onRightClick(this._longPressPointer)
          if (navigator.vibrate) navigator.vibrate(40)
        },
      })
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this._panning) {
        const dx = (p.x - this._panStart.x) / cam.zoom
        const dy = (p.y - this._panStart.y) / cam.zoom
        cam.setScroll(this._camStart.x - dx, this._camStart.y - dy)
      }
      if (isMobile && p.isDown && !this._touchPanActive) {
        const dx = (p.x - (this._longPressPointer?.x ?? p.x)) / cam.zoom
        const dy = (p.y - (this._longPressPointer?.y ?? p.y)) / cam.zoom
        if (Math.abs(dx) + Math.abs(dy) > 10) this._cancelLongPress()
        cam.setScroll(this._touchCamStart.x - dx, this._touchCamStart.y - dy)
      }
    })

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!p.middleButtonDown()) this._panning = false
      this._touchPanActive = false

      // Build drag confirm
      if (this._dragging && this._dragStart) {
        const { tx, ty } = this.worldMap.worldToTile(p.worldX, p.worldY)
        this._confirmBuild(this._dragStart, { tx, ty })
        this._dragStart = null
        this._dragging  = false
      }

      if (isMobile && !this._didLongPress) {
        this._cancelLongPress()
        this._onLeftClick(p)
      }
    })

    // Pinch zoom (mobile)
    if (isMobile) {
      let _lastDist = 0
      this.input.on('pointermove', () => {
        if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
          const dx = this.input.pointer1.x - this.input.pointer2.x
          const dy = this.input.pointer1.y - this.input.pointer2.y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (_lastDist > 0) cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dist / _lastDist), 0.3, 4))
          _lastDist = dist
        } else { _lastDist = 0 }
      })
    }

    this.input.on('wheel', (_p: any, _gos: any, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.3, 4))
    })

    // R key: ESC exits build mode
    this.input.keyboard?.addKey('ESC').on('down', () => this.exitBuildMode())

    this.events.on('update', (_t: number, delta: number) => this._cameraKeys(delta / 1000))
  }

  private _cancelLongPress(): void {
    if (this._longPressTimer) { this._longPressTimer.remove(); this._longPressTimer = null }
    this._longPressPointer = null
  }

  private _cameraKeys(dt: number): void {
    const keys = this.input.keyboard
    if (!keys) return
    const speed = 400 / this.cameras.main.zoom
    const cam   = this.cameras.main
    if (keys.addKey('W').isDown || keys.addKey('UP').isDown)    cam.scrollY -= speed * dt
    if (keys.addKey('S').isDown || keys.addKey('DOWN').isDown)  cam.scrollY += speed * dt
    if (keys.addKey('A').isDown || keys.addKey('LEFT').isDown)  cam.scrollX -= speed * dt
    if (keys.addKey('D').isDown || keys.addKey('RIGHT').isDown) cam.scrollX += speed * dt
  }

  private _onRightClick(p: Phaser.Input.Pointer): void {
    const wx = p.worldX, wy = p.worldY

    // 건물 철거 (건축 모드 아닐 때)
    if (this.activeBuildKind === -1) {
      const { tx, ty } = this.worldMap.worldToTile(wx, wy)
      if (!this.buildingMgr.isEmpty(tx, ty)) {
        this.buildingMgr.remove(tx, ty)
        return
      }
    }

    // 자원 지정
    let bestDist = 22, bestEid = -1
    for (const eid of this._resourceEids) {
      const d = Math.hypot(Position.x[eid] - wx, Position.y[eid] - wy)
      if (d < bestDist) { bestDist = d; bestEid = eid }
    }
    if (bestEid === -1) return

    if (Resource.designated[bestEid] === 1) {
      Resource.designated[bestEid] = 0
      this.jobQueue.cancelByTarget(bestEid)
    } else {
      Resource.designated[bestEid] = 1
      const { tx, ty } = this.worldMap.worldToTile(Position.x[bestEid], Position.y[bestEid])
      const kind = Resource.kind[bestEid] as ResourceTypeId
      this.jobQueue.addJob(kind === ResourceTypeId.Tree ? JobTypeId.ChopTree : JobTypeId.MineRock, tx, ty, bestEid)
    }
  }

  private _onLeftClick(p: Phaser.Input.Pointer): void {
    const wx = p.worldX, wy = p.worldY

    if ((window as any).__designateMode) { this._onRightClick(p); return }

    let bestDist = 15, bestEid = -1
    for (const eid of this._colonistEids) {
      const d = Math.hypot(Position.x[eid] - wx, Position.y[eid] - wy)
      if (d < bestDist) { bestDist = d; bestEid = eid }
    }
    this.events.emit('colonist-selected', bestEid)
  }

  // ─── Callbacks ────────────────────────────────────────────────────────────────

  private _onResourceDied(eid: number, itemKind: ItemKind, amount: number): void {
    const gfx = gfxMap.get(eid)
    if (gfx) { gfx.destroy(); gfxMap.delete(eid) }
    this._resourceEids.delete(eid)
    removeEntity(world, eid)

    // 창고가 있으면 DroppedItem 스폰, 없으면 바로 집계
    if (this.buildingMgr.stockpileTiles.size > 0) {
      const wx = Position.x[eid] || 0
      const wy = Position.y[eid] || 0
      this._spawnDroppedItem(wx || (MAP_W / 2 * TILE_SIZE), wy || (MAP_H / 2 * TILE_SIZE), itemKind, amount)
    } else {
      this._onItemDelivered(itemKind, amount)
    }
  }

  private _spawnDroppedItem(wx: number, wy: number, kind: ItemKind, amount: number): void {
    const eid = spawnDroppedItem(wx, wy, kind, amount)
    gfxMap.set(eid, this.add.graphics())
    this._droppedEids.add(eid)
  }

  private _onItemDelivered(kind: ItemKind, amount: number): void {
    switch (kind) {
      case ItemKind.Wood:  this.gameTime.addResource('wood',  amount); break
      case ItemKind.Stone: this.gameTime.addResource('stone', amount); break
      case ItemKind.Food:  this.gameTime.addResource('food',  amount); break
    }
  }

  // ─── Public getters ───────────────────────────────────────────────────────────

  get colonistEids(): number[] { return this._colonistEids }
}
