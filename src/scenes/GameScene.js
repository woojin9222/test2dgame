/**
 * GameScene — 메인 게임 씬
 *
 * 매 프레임:
 *   1. ECS systems 실행 (순수 로직, Phaser 무관)
 *   2. Render systems 실행 (ECS 데이터 → Phaser Graphics)
 */
import Phaser from 'phaser';
import { removeEntity } from 'bitecs';
import { world, spawnColonist, spawnResource, gfxMap } from '../ecs/world';
import { Resource, Position } from '../ecs/components';
import { WorldMap, TILE_SIZE, MAP_W, MAP_H, TILE_COLORS } from '../managers/WorldMap';
import { JobQueue } from '../managers/JobQueue';
import { GameTime } from '../managers/GameTime';
import { needsSystem, recoverySystem } from '../systems/NeedsSystem';
import { movementSystem } from '../systems/MovementSystem';
import { aiSystem } from '../systems/AISystem';
import { jobSystem } from '../systems/JobSystem';
import { renderColonists, renderResources } from '../systems/RenderSystem';
// ─── Scene constants ──────────────────────────────────────────────────────────
const NUM_TREES = 200;
const NUM_ROCKS = 100;
const NUM_COLONISTS = 3;
const COLONIST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
const COLONIST_COLORS = [0x00eeff, 0xffee00, 0xff88ff, 0xff8800, 0x88ff44, 0xff4444];
export class GameScene extends Phaser.Scene {
    // Managers (Bevy Resources)
    worldMap;
    jobQueue;
    gameTime;
    // Phaser render layer for tiles
    _tileGfx;
    // Resource entity ids
    _resourceEids = new Set();
    // Colonist entity ids
    _colonistEids = [];
    // Camera pan state
    _panning = false;
    _panStart = new Phaser.Math.Vector2();
    _camStart = new Phaser.Math.Vector2();
    constructor() { super('Game'); }
    create() {
        // Init managers
        this.worldMap = new WorldMap();
        this.jobQueue = new JobQueue();
        this.gameTime = new GameTime();
        // Draw static tile layer
        this._tileGfx = this.add.graphics();
        this._drawTiles();
        // Spawn resource nodes
        this._spawnResources();
        // Spawn colonists
        this._spawnColonists();
        // Camera setup
        const cx = (MAP_W * TILE_SIZE) / 2;
        const cy = (MAP_H * TILE_SIZE) / 2;
        this.cameras.main.setZoom(1.6);
        this.cameras.main.centerOn(cx, cy);
        this.cameras.main.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);
        // Input
        this._setupInput();
        // Launch UI scene on top
        this.scene.launch('UI', { gameScene: this });
    }
    update(_time, delta) {
        const dt = delta / 1000; // ms → seconds
        this.gameTime.tick(dt);
        // ── ECS Systems (logic, no rendering) ────────────────────────────────────
        needsSystem(world, this.gameTime, dt);
        recoverySystem(world, this.gameTime, dt);
        aiSystem(world, this.gameTime, dt, this.jobQueue, this.worldMap);
        movementSystem(world, this.gameTime, dt, this.jobQueue);
        jobSystem(world, this.gameTime, dt, this.jobQueue, this.worldMap, (eid) => {
            this._onResourceDied(eid);
        });
        // ── Render Systems ────────────────────────────────────────────────────────
        renderResources(world);
        renderColonists(world);
    }
    // ─── World drawing ────────────────────────────────────────────────────────────
    _drawTiles() {
        const g = this._tileGfx;
        for (let ty = 0; ty < MAP_H; ty++) {
            for (let tx = 0; tx < MAP_W; tx++) {
                const tile = this.worldMap.getTile(tx, ty);
                g.fillStyle(TILE_COLORS[tile], 1);
                g.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                // Grid lines
                g.lineStyle(1, 0x000000, 0.07);
                g.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            }
        }
    }
    // ─── Spawn helpers ────────────────────────────────────────────────────────────
    _spawnResources() {
        let trees = 0, rocks = 0, attempts = 0;
        while ((trees < NUM_TREES || rocks < NUM_ROCKS) && attempts < 10000) {
            attempts++;
            const tx = Math.floor(Math.random() * MAP_W);
            const ty = Math.floor(Math.random() * MAP_H);
            const tile = this.worldMap.getTile(tx, ty);
            if (trees < NUM_TREES && tile === 0 /* TileType.Grass */ && this.worldMap.isWalkable(tx, ty)) {
                this._makeResource(tx, ty, 0 /* ResourceTypeId.Tree */);
                trees++;
            }
            else if (rocks < NUM_ROCKS &&
                (tile === 2 /* TileType.Stone */ || tile === 3 /* TileType.DeepStone */) &&
                this.worldMap.isWalkable(tx, ty)) {
                this._makeResource(tx, ty, 1 /* ResourceTypeId.Rock */);
                rocks++;
            }
        }
    }
    _makeResource(tx, ty, kind) {
        const { wx, wy } = this.worldMap.tileToWorld(tx, ty);
        const eid = spawnResource(wx, wy, kind);
        const gfx = this.add.graphics();
        gfxMap.set(eid, gfx);
        this._resourceEids.add(eid);
        // Block pathfinding tile
        this.worldMap.setBlocked(tx, ty, true);
    }
    _spawnColonists() {
        const cx = Math.floor(MAP_W / 2);
        const cy = Math.floor(MAP_H / 2);
        for (let i = 0; i < NUM_COLONISTS; i++) {
            let tx = cx + Math.round((Math.random() - 0.5) * 6);
            let ty = cy + Math.round((Math.random() - 0.5) * 6);
            if (!this.worldMap.isWalkable(tx, ty)) {
                tx = cx;
                ty = cy;
            }
            const { wx, wy } = this.worldMap.tileToWorld(tx, ty);
            const name = COLONIST_NAMES[i % COLONIST_NAMES.length];
            const color = COLONIST_COLORS[i % COLONIST_COLORS.length];
            const eid = spawnColonist(wx, wy, name, color);
            const gfx = this.add.graphics();
            gfxMap.set(eid, gfx);
            this._colonistEids.push(eid);
        }
    }
    // ─── Input ────────────────────────────────────────────────────────────────────
    // 롱프레스 상태 (모바일 지정용)
    _longPressTimer = null;
    _longPressPointer = null;
    _didLongPress = false;
    _touchPanActive = false;
    _touchPanStart = new Phaser.Math.Vector2();
    _touchCamStart = new Phaser.Math.Vector2();
    _setupInput() {
        const cam = this.cameras.main;
        const isMobile = !this.sys.game.device.os.desktop;
        this.input.on('pointerdown', (p) => {
            // ── PC ──────────────────────────────────────────────
            if (!isMobile) {
                if (p.middleButtonDown()) {
                    this._panning = true;
                    this._panStart.set(p.x, p.y);
                    this._camStart.set(cam.scrollX, cam.scrollY);
                }
                if (p.rightButtonDown())
                    this._onRightClick(p);
                if (p.leftButtonDown())
                    this._onLeftClick(p);
                return;
            }
            // ── 모바일 ──────────────────────────────────────────
            this._didLongPress = false;
            if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
                // 두 손가락 = 패닝
                this._touchPanActive = true;
                this._touchPanStart.set(p.x, p.y);
                this._touchCamStart.set(cam.scrollX, cam.scrollY);
                this._cancelLongPress();
                return;
            }
            // 롱프레스 타이머 (600ms)
            this._longPressPointer = p;
            this._longPressTimer = this.time.addEvent({
                delay: 600,
                callback: () => {
                    this._didLongPress = true;
                    if (this._longPressPointer)
                        this._onRightClick(this._longPressPointer);
                    // 진동 피드백 (지원 기기)
                    if (navigator.vibrate)
                        navigator.vibrate(40);
                },
            });
        });
        this.input.on('pointermove', (p) => {
            // PC 패닝
            if (this._panning) {
                const dx = (p.x - this._panStart.x) / cam.zoom;
                const dy = (p.y - this._panStart.y) / cam.zoom;
                cam.setScroll(this._camStart.x - dx, this._camStart.y - dy);
            }
            // 모바일 한 손가락 패닝
            if (isMobile && p.isDown && !this._touchPanActive) {
                const dx = (p.x - (this._longPressPointer?.x ?? p.x)) / cam.zoom;
                const dy = (p.y - (this._longPressPointer?.y ?? p.y)) / cam.zoom;
                // 많이 움직이면 롱프레스 취소
                if (Math.abs(dx) + Math.abs(dy) > 10)
                    this._cancelLongPress();
                cam.setScroll(this._touchCamStart.x - dx, this._touchCamStart.y - dy);
            }
        });
        this.input.on('pointerup', (p) => {
            if (!p.middleButtonDown())
                this._panning = false;
            this._touchPanActive = false;
            if (isMobile && !this._didLongPress) {
                this._cancelLongPress();
                // 짧게 탭 = 선택
                this._onLeftClick(p);
            }
        });
        // 핀치 줌 (모바일)
        if (isMobile) {
            let _lastDist = 0;
            this.input.on('pointermove', () => {
                if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
                    const dx = this.input.pointer1.x - this.input.pointer2.x;
                    const dy = this.input.pointer1.y - this.input.pointer2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (_lastDist > 0) {
                        const z = Phaser.Math.Clamp(cam.zoom * (dist / _lastDist), 0.3, 4);
                        cam.setZoom(z);
                    }
                    _lastDist = dist;
                }
                else {
                    _lastDist = 0;
                }
            });
        }
        // 스크롤 줌 (PC)
        this.input.on('wheel', (_p, _gos, _dx, dy) => {
            const z = Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.3, 4);
            cam.setZoom(z);
        });
        // WASD
        this.events.on('update', (_t, delta) => {
            this._cameraKeys(delta / 1000);
        });
    }
    _cancelLongPress() {
        if (this._longPressTimer) {
            this._longPressTimer.remove();
            this._longPressTimer = null;
        }
        this._longPressPointer = null;
    }
    _cameraKeys(dt) {
        const keys = this.input.keyboard;
        if (!keys)
            return;
        const speed = 400 / this.cameras.main.zoom;
        const cam = this.cameras.main;
        if (keys.addKey('W').isDown || keys.addKey('UP').isDown)
            cam.scrollY -= speed * dt;
        if (keys.addKey('S').isDown || keys.addKey('DOWN').isDown)
            cam.scrollY += speed * dt;
        if (keys.addKey('A').isDown || keys.addKey('LEFT').isDown)
            cam.scrollX -= speed * dt;
        if (keys.addKey('D').isDown || keys.addKey('RIGHT').isDown)
            cam.scrollX += speed * dt;
    }
    _onRightClick(p) {
        const wx = p.worldX;
        const wy = p.worldY;
        // Find nearest resource node within click radius
        let bestDist = 22;
        let bestEid = -1;
        for (const eid of this._resourceEids) {
            const dx = Position.x[eid] - wx;
            const dy = Position.y[eid] - wy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < bestDist) {
                bestDist = d;
                bestEid = eid;
            }
        }
        if (bestEid === -1)
            return;
        const isDesignated = Resource.designated[bestEid] === 1;
        if (isDesignated) {
            // Cancel
            Resource.designated[bestEid] = 0;
            this.jobQueue.cancelByTarget(bestEid);
        }
        else {
            // Designate
            Resource.designated[bestEid] = 1;
            const { tx, ty } = this.worldMap.worldToTile(Position.x[bestEid], Position.y[bestEid]);
            const kind = Resource.kind[bestEid];
            const jobType = kind === 0 /* ResourceTypeId.Tree */ ? 0 /* JobTypeId.ChopTree */ : 1 /* JobTypeId.MineRock */;
            this.jobQueue.addJob(jobType, tx, ty, bestEid);
        }
    }
    _onLeftClick(_p) {
        const wx = _p.worldX;
        const wy = _p.worldY;
        // 모바일 지정 모드: 탭이 지정 역할
        if (window.__designateMode) {
            this._onRightClick(_p);
            return;
        }
        let bestDist = 15;
        let bestEid = -1;
        for (const eid of this._colonistEids) {
            const dx = Position.x[eid] - wx;
            const dy = Position.y[eid] - wy;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < bestDist) {
                bestDist = d;
                bestEid = eid;
            }
        }
        this.events.emit('colonist-selected', bestEid);
    }
    _onResourceDied(eid) {
        const gfx = gfxMap.get(eid);
        if (gfx) {
            gfx.destroy();
            gfxMap.delete(eid);
        }
        this._resourceEids.delete(eid);
        removeEntity(world, eid);
    }
    // ─── Public getters (for UIScene) ────────────────────────────────────────────
    get colonistEids() { return this._colonistEids; }
}
