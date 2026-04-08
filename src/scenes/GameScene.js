/**
 * GameScene — 메인 게임 씬
 */
import Phaser from 'phaser';
import { removeEntity } from 'bitecs';
import { world, spawnColonist, spawnResource, spawnDroppedItem, gfxMap, overlayMap } from '../ecs/world';
import { Resource, Position } from '../ecs/components';
import { WorldMap, TILE_SIZE, MAP_W, MAP_H, TILE_COLORS } from '../managers/WorldMap';
import { JobQueue } from '../managers/JobQueue';
import { GameTime } from '../managers/GameTime';
import { BuildingManager } from '../managers/BuildingManager';
import { needsSystem, recoverySystem } from '../systems/NeedsSystem';
import { movementSystem } from '../systems/MovementSystem';
import { aiSystem } from '../systems/AISystem';
import { jobSystem } from '../systems/JobSystem';
import { buildSystem } from '../systems/BuildSystem';
import { haulSystem } from '../systems/HaulSystem';
import { renderColonists, renderResources, renderBuildings, renderDroppedItems } from '../systems/RenderSystem';
// ─── Constants ────────────────────────────────────────────────────────────────
const NUM_TREES = 200;
const NUM_ROCKS = 100;
const NUM_COLONISTS = 3;
const COLONIST_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
const COLONIST_COLORS = [0x00eeff, 0xffee00, 0xff88ff, 0xff8800, 0x88ff44, 0xff4444];
export class GameScene extends Phaser.Scene {
    // ─── Managers ────────────────────────────────────────────────────────────────
    worldMap;
    jobQueue;
    gameTime;
    buildingMgr;
    // ─── Phaser objects ──────────────────────────────────────────────────────────
    _tileGfx;
    _ghostGfx; // 건축 미리보기
    _designGfx; // 지정 영역 선택
    // ─── Entity tracking ─────────────────────────────────────────────────────────
    _resourceEids = new Set();
    _colonistEids = [];
    _droppedEids = new Set();
    // ─── Camera ──────────────────────────────────────────────────────────────────
    _panning = false;
    _panStart = new Phaser.Math.Vector2();
    _camStart = new Phaser.Math.Vector2();
    // ─── Build mode ──────────────────────────────────────────────────────────────
    /** Currently selected building kind, or -1 = no build mode */
    activeBuildKind = -1;
    _dragStart = null;
    _dragging = false;
    // ─── Designate drag ──────────────────────────────────────────────────────────
    _designating = false;
    _designStart = null;
    constructor() { super('Game'); }
    // ─── Lifecycle ────────────────────────────────────────────────────────────────
    preload() {
        this.load.image('tree', 'assets/tree.png');
        this.load.image('rock', 'assets/rock.png');
        this.load.image('container', 'assets/container.png');
        this.load.image('stockpile', 'assets/stockpile.png');
        this.load.image('item_food', 'assets/item_food.png');
        this.load.image('item_wood', 'assets/item_wood.png');
        this.load.image('item_stone', 'assets/item_stone.png');
        this.load.image('wall', 'assets/wall.png');
        this.load.image('floor', 'assets/floor.png');
        this.load.image('colonist', 'assets/colonist.png');
        this.load.image('colonist2', 'assets/colonist2.png');
        this.load.image('colonist3', 'assets/colonist3.png');
        this.load.image('tile_grass', 'assets/tile_grass.png');
        this.load.image('tile_water', 'assets/tile_water.png');
        this.load.image('tile_stone_ground', 'assets/tile_stone_ground.png');
        this.load.image('tile_dirt', 'assets/tile_dirt.png');
    }
    create() {
        this.worldMap = new WorldMap();
        this.jobQueue = new JobQueue();
        this.gameTime = new GameTime();
        this.buildingMgr = new BuildingManager(this.worldMap, this.jobQueue, this.gameTime);
        this._tileGfx = this.add.graphics();
        this._drawTiles();
        this._ghostGfx = this.add.graphics();
        this._ghostGfx.setDepth(10);
        this._designGfx = this.add.graphics();
        this._designGfx.setDepth(9);
        this._spawnResources();
        this._spawnColonists();
        const cx = (MAP_W * TILE_SIZE) / 2;
        const cy = (MAP_H * TILE_SIZE) / 2;
        this.cameras.main.setZoom(1.6);
        this.cameras.main.centerOn(cx, cy);
        this.cameras.main.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);
        this._setupInput();
        this.scene.launch('UI', { gameScene: this });
    }
    update(_time, delta) {
        const dt = delta / 1000;
        this.gameTime.tick(dt);
        // ── ECS Logic Systems ─────────────────────────────────────────────────────
        needsSystem(world, this.gameTime, dt);
        recoverySystem(world, this.gameTime, dt);
        aiSystem(world, this.gameTime, dt, this.jobQueue, this.worldMap);
        movementSystem(world, this.gameTime, dt, this.jobQueue);
        jobSystem(world, this.gameTime, dt, this.jobQueue, this.worldMap, (eid, itemKind, amount) => this._onResourceDied(eid, itemKind, amount));
        buildSystem(world, this.gameTime, dt, this.jobQueue, this.buildingMgr);
        haulSystem(world, this.gameTime, dt, this.jobQueue, this.buildingMgr, this.worldMap, (kind, amount) => this._onItemDelivered(kind, amount));
        // ── Render Systems ────────────────────────────────────────────────────────
        renderBuildings(world);
        renderDroppedItems(world);
        renderResources(world);
        renderColonists(world);
        // ── Build mode ghost preview ──────────────────────────────────────────────
        this._updateGhost();
        this._updateDesignBox();
    }
    // ─── World rendering ─────────────────────────────────────────────────────────
    _drawTiles() {
        const TILE_KEYS = {
            [0 /* TileType.Grass */]: 'tile_grass',
            [1 /* TileType.Dirt */]: 'tile_dirt',
            [2 /* TileType.Stone */]: 'tile_stone_ground',
            [3 /* TileType.DeepStone */]: 'tile_stone_ground',
            [4 /* TileType.Water */]: 'tile_water',
        };
        // Check if tile textures are loaded; fallback to Graphics if not
        const hasSprites = this.textures.exists('tile_grass');
        if (hasSprites) {
            const rt = this.add.renderTexture(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);
            rt.setDepth(0);
            for (let ty = 0; ty < MAP_H; ty++) {
                for (let tx = 0; tx < MAP_W; tx++) {
                    const tile = this.worldMap.getTile(tx, ty);
                    rt.drawFrame(TILE_KEYS[tile], undefined, tx * TILE_SIZE, ty * TILE_SIZE);
                }
            }
            // DeepStone: darken with a tinted rect overlay
            const g = this._tileGfx;
            g.setDepth(0);
            for (let ty = 0; ty < MAP_H; ty++) {
                for (let tx = 0; tx < MAP_W; tx++) {
                    if (this.worldMap.getTile(tx, ty) === 3 /* TileType.DeepStone */) {
                        g.fillStyle(0x000000, 0.35);
                        g.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    }
                }
            }
        }
        else {
            // Fallback: colored rects
            const g = this._tileGfx;
            for (let ty = 0; ty < MAP_H; ty++) {
                for (let tx = 0; tx < MAP_W; tx++) {
                    const tile = this.worldMap.getTile(tx, ty);
                    g.fillStyle(TILE_COLORS[tile], 1);
                    g.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
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
        const key = kind === 0 /* ResourceTypeId.Tree */ ? 'tree' : 'rock';
        const spr = this.add.image(wx, wy, key).setDisplaySize(TILE_SIZE, TILE_SIZE);
        spr.setDepth(2);
        gfxMap.set(eid, spr);
        overlayMap.set(eid, this.add.graphics().setDepth(3));
        this._resourceEids.add(eid);
        this.worldMap.setBlocked(tx, ty, true);
    }
    _spawnColonists() {
        const cx = Math.floor(MAP_W / 2);
        const cy = Math.floor(MAP_H / 2);
        const charKeys = ['colonist', 'colonist2', 'colonist3'];
        for (let i = 0; i < NUM_COLONISTS; i++) {
            let tx = cx + Math.round((Math.random() - 0.5) * 6);
            let ty = cy + Math.round((Math.random() - 0.5) * 6);
            if (!this.worldMap.isWalkable(tx, ty)) {
                tx = cx;
                ty = cy;
            }
            const { wx, wy } = this.worldMap.tileToWorld(tx, ty);
            const color = COLONIST_COLORS[i % COLONIST_COLORS.length];
            const eid = spawnColonist(wx, wy, COLONIST_NAMES[i % COLONIST_NAMES.length], color);
            const key = charKeys[i % charKeys.length];
            const spr = this.add.image(wx, wy, key).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(4);
            spr.setTint(color);
            gfxMap.set(eid, spr);
            overlayMap.set(eid, this.add.graphics().setDepth(5));
            this._colonistEids.push(eid);
        }
    }
    // ─── Build mode ──────────────────────────────────────────────────────────────
    enterBuildMode(kind) {
        this.activeBuildKind = kind;
        this.events.emit('build-mode-changed', kind);
    }
    exitBuildMode() {
        this.activeBuildKind = -1;
        this._dragStart = null;
        this._dragging = false;
        this._ghostGfx.clear();
        this.events.emit('build-mode-changed', -1);
    }
    _getDragTiles(from, to) {
        const tiles = [];
        const dx = Math.sign(to.tx - from.tx);
        const dy = Math.sign(to.ty - from.ty);
        if (Math.abs(to.tx - from.tx) >= Math.abs(to.ty - from.ty)) {
            // Horizontal drag
            let tx = from.tx;
            while (tx !== to.tx + dx) {
                tiles.push({ tx, ty: from.ty });
                tx += dx || 1;
            }
        }
        else {
            // Vertical drag
            let ty = from.ty;
            while (ty !== to.ty + dy) {
                tiles.push({ tx: from.tx, ty });
                ty += dy || 1;
            }
        }
        if (tiles.length === 0)
            tiles.push(from);
        return tiles;
    }
    _updateGhost() {
        if (this.activeBuildKind === -1)
            return;
        this._ghostGfx.clear();
        const mouse = this.input.activePointer;
        const worldX = mouse.worldX;
        const worldY = mouse.worldY;
        const { tx: curTx, ty: curTy } = this.worldMap.worldToTile(worldX, worldY);
        const from = this._dragStart ?? { tx: curTx, ty: curTy };
        const tiles = this._getDragTiles(from, { tx: curTx, ty: curTy });
        const kind = this.activeBuildKind;
        for (const { tx, ty } of tiles) {
            const canPlace = this.buildingMgr.canPlace(tx, ty, kind);
            const color = canPlace ? 0x44ff88 : 0xff4444;
            const alpha = 0.45;
            this._ghostGfx.fillStyle(color, alpha);
            this._ghostGfx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            this._ghostGfx.lineStyle(2, color, 0.8);
            this._ghostGfx.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
    }
    _confirmBuild(from, to) {
        const kind = this.activeBuildKind;
        const tiles = this._getDragTiles(from, to);
        const SPRITE_KINDS = new Set([4 /* BuildingKind.Container */, 3 /* BuildingKind.Stockpile */, 0 /* BuildingKind.Wall */, 1 /* BuildingKind.Floor */]);
        const SPRITE_KEYS = {
            [4 /* BuildingKind.Container */]: 'container',
            [3 /* BuildingKind.Stockpile */]: 'stockpile',
            [0 /* BuildingKind.Wall */]: 'wall',
            [1 /* BuildingKind.Floor */]: 'floor',
        };
        for (const { tx, ty } of tiles) {
            const eid = this.buildingMgr.place(tx, ty, kind);
            if (eid !== -1) {
                if (SPRITE_KINDS.has(kind)) {
                    const spr = this.add.image(Position.x[eid], Position.y[eid], SPRITE_KEYS[kind]).setDisplaySize(TILE_SIZE, TILE_SIZE).setDepth(2);
                    gfxMap.set(eid, spr);
                    overlayMap.set(eid, this.add.graphics().setDepth(3));
                }
                else {
                    gfxMap.set(eid, this.add.graphics().setDepth(2));
                }
                this.buildingMgr.buildingEids.add(eid);
            }
        }
    }
    // ─── Input ────────────────────────────────────────────────────────────────────
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
            if (!isMobile) {
                if (p.middleButtonDown()) {
                    this._panning = true;
                    this._panStart.set(p.x, p.y);
                    this._camStart.set(cam.scrollX, cam.scrollY);
                }
                if (p.rightButtonDown()) {
                    if (this.activeBuildKind !== -1) {
                        this.exitBuildMode();
                        return;
                    }
                    // 드래그 지정 시작
                    this._designating = true;
                    this._designStart = { wx: p.worldX, wy: p.worldY };
                }
                if (p.leftButtonDown()) {
                    if (this.activeBuildKind !== -1) {
                        const { tx, ty } = this.worldMap.worldToTile(p.worldX, p.worldY);
                        this._dragStart = { tx, ty };
                        this._dragging = true;
                    }
                    else {
                        this._onLeftClick(p);
                    }
                }
                return;
            }
            // Mobile
            this._didLongPress = false;
            if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
                this._touchPanActive = true;
                this._touchPanStart.set(p.x, p.y);
                this._touchCamStart.set(cam.scrollX, cam.scrollY);
                this._cancelLongPress();
                return;
            }
            this._longPressPointer = p;
            this._longPressTimer = this.time.addEvent({
                delay: 600,
                callback: () => {
                    this._didLongPress = true;
                    if (this._longPressPointer)
                        this._onRightClick(this._longPressPointer);
                    if (navigator.vibrate)
                        navigator.vibrate(40);
                },
            });
        });
        this.input.on('pointermove', (p) => {
            if (this._panning) {
                const dx = (p.x - this._panStart.x) / cam.zoom;
                const dy = (p.y - this._panStart.y) / cam.zoom;
                cam.setScroll(this._camStart.x - dx, this._camStart.y - dy);
            }
            if (isMobile && p.isDown && !this._touchPanActive) {
                const dx = (p.x - (this._longPressPointer?.x ?? p.x)) / cam.zoom;
                const dy = (p.y - (this._longPressPointer?.y ?? p.y)) / cam.zoom;
                if (Math.abs(dx) + Math.abs(dy) > 10)
                    this._cancelLongPress();
                cam.setScroll(this._touchCamStart.x - dx, this._touchCamStart.y - dy);
            }
        });
        this.input.on('pointerup', (p) => {
            if (!p.middleButtonDown())
                this._panning = false;
            this._touchPanActive = false;
            // Build drag confirm
            if (this._dragging && this._dragStart) {
                const { tx, ty } = this.worldMap.worldToTile(p.worldX, p.worldY);
                this._confirmBuild(this._dragStart, { tx, ty });
                this._dragStart = null;
                this._dragging = false;
            }
            // Designate drag confirm (right-click up)
            if (this._designating && this._designStart) {
                const dx = Math.abs(p.worldX - this._designStart.wx);
                const dy = Math.abs(p.worldY - this._designStart.wy);
                if (dx < 8 && dy < 8) {
                    // Single click: point designation
                    this._onRightClick(p);
                }
                else {
                    // Area drag designation
                    this._confirmDesignate(this._designStart, { wx: p.worldX, wy: p.worldY });
                }
                this._designating = false;
                this._designStart = null;
                this._designGfx.clear();
            }
            if (isMobile && !this._didLongPress) {
                this._cancelLongPress();
                this._onLeftClick(p);
            }
        });
        // Pinch zoom (mobile)
        if (isMobile) {
            let _lastDist = 0;
            this.input.on('pointermove', () => {
                if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
                    const dx = this.input.pointer1.x - this.input.pointer2.x;
                    const dy = this.input.pointer1.y - this.input.pointer2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (_lastDist > 0)
                        cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dist / _lastDist), 0.3, 4));
                    _lastDist = dist;
                }
                else {
                    _lastDist = 0;
                }
            });
        }
        this.input.on('wheel', (_p, _gos, _dx, dy) => {
            cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.3, 4));
        });
        // R key: ESC exits build mode
        this.input.keyboard?.addKey('ESC').on('down', () => this.exitBuildMode());
        this.events.on('update', (_t, delta) => this._cameraKeys(delta / 1000));
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
    _updateDesignBox() {
        this._designGfx.clear();
        if (!this._designating || !this._designStart)
            return;
        const mx = this.input.activePointer.worldX;
        const my = this.input.activePointer.worldY;
        const x = Math.min(this._designStart.wx, mx);
        const y = Math.min(this._designStart.wy, my);
        const w = Math.abs(mx - this._designStart.wx);
        const h = Math.abs(my - this._designStart.wy);
        this._designGfx.fillStyle(0xff8800, 0.12);
        this._designGfx.fillRect(x, y, w, h);
        this._designGfx.lineStyle(1, 0xff8800, 0.7);
        this._designGfx.strokeRect(x, y, w, h);
    }
    _confirmDesignate(from, to) {
        const x1 = Math.min(from.wx, to.wx);
        const y1 = Math.min(from.wy, to.wy);
        const x2 = Math.max(from.wx, to.wx);
        const y2 = Math.max(from.wy, to.wy);
        for (const eid of this._resourceEids) {
            const rx = Position.x[eid];
            const ry = Position.y[eid];
            if (rx >= x1 && rx <= x2 && ry >= y1 && ry <= y2) {
                if (Resource.designated[eid] === 0) {
                    Resource.designated[eid] = 1;
                    const { tx, ty } = this.worldMap.worldToTile(rx, ry);
                    const kind = Resource.kind[eid];
                    this.jobQueue.addJob(kind === 0 /* ResourceTypeId.Tree */ ? 0 /* JobTypeId.ChopTree */ : 1 /* JobTypeId.MineRock */, tx, ty, eid);
                }
            }
        }
    }
    _onRightClick(p) {
        const wx = p.worldX, wy = p.worldY;
        // 건물 철거 (건축 모드 아닐 때)
        if (this.activeBuildKind === -1) {
            const { tx, ty } = this.worldMap.worldToTile(wx, wy);
            if (!this.buildingMgr.isEmpty(tx, ty)) {
                this.buildingMgr.remove(tx, ty);
                return;
            }
        }
        // 자원 지정
        let bestDist = 22, bestEid = -1;
        for (const eid of this._resourceEids) {
            const d = Math.hypot(Position.x[eid] - wx, Position.y[eid] - wy);
            if (d < bestDist) {
                bestDist = d;
                bestEid = eid;
            }
        }
        if (bestEid === -1)
            return;
        if (Resource.designated[bestEid] === 1) {
            Resource.designated[bestEid] = 0;
            this.jobQueue.cancelByTarget(bestEid);
        }
        else {
            Resource.designated[bestEid] = 1;
            const { tx, ty } = this.worldMap.worldToTile(Position.x[bestEid], Position.y[bestEid]);
            const kind = Resource.kind[bestEid];
            this.jobQueue.addJob(kind === 0 /* ResourceTypeId.Tree */ ? 0 /* JobTypeId.ChopTree */ : 1 /* JobTypeId.MineRock */, tx, ty, bestEid);
        }
    }
    _onLeftClick(p) {
        const wx = p.worldX, wy = p.worldY;
        if (window.__designateMode) {
            this._onRightClick(p);
            return;
        }
        let bestDist = 15, bestEid = -1;
        for (const eid of this._colonistEids) {
            const d = Math.hypot(Position.x[eid] - wx, Position.y[eid] - wy);
            if (d < bestDist) {
                bestDist = d;
                bestEid = eid;
            }
        }
        this.events.emit('colonist-selected', bestEid);
    }
    // ─── Callbacks ────────────────────────────────────────────────────────────────
    _onResourceDied(eid, itemKind, amount) {
        const gfx = gfxMap.get(eid);
        if (gfx) {
            gfx.destroy();
            gfxMap.delete(eid);
        }
        const overlay = overlayMap.get(eid);
        if (overlay) {
            overlay.destroy();
            overlayMap.delete(eid);
        }
        this._resourceEids.delete(eid);
        removeEntity(world, eid);
        // 창고가 있으면 DroppedItem 스폰, 없으면 바로 집계
        if (this.buildingMgr.stockpileTiles.size > 0) {
            const wx = Position.x[eid] || 0;
            const wy = Position.y[eid] || 0;
            this._spawnDroppedItem(wx || (MAP_W / 2 * TILE_SIZE), wy || (MAP_H / 2 * TILE_SIZE), itemKind, amount);
        }
        else {
            this._onItemDelivered(itemKind, amount);
        }
    }
    _spawnDroppedItem(wx, wy, kind, amount) {
        const eid = spawnDroppedItem(wx, wy, kind, amount);
        const ITEM_KEYS = {
            [2 /* ItemKind.Food */]: 'item_food',
            [0 /* ItemKind.Wood */]: 'item_wood',
            [1 /* ItemKind.Stone */]: 'item_stone',
        };
        const key = ITEM_KEYS[kind];
        if (key) {
            const spr = this.add.image(wx, wy, key).setDisplaySize(10, 10).setDepth(2);
            gfxMap.set(eid, spr);
        }
        else {
            gfxMap.set(eid, this.add.graphics().setDepth(2));
        }
        this._droppedEids.add(eid);
    }
    _onItemDelivered(kind, amount) {
        switch (kind) {
            case 0 /* ItemKind.Wood */:
                this.gameTime.addResource('wood', amount);
                break;
            case 1 /* ItemKind.Stone */:
                this.gameTime.addResource('stone', amount);
                break;
            case 2 /* ItemKind.Food */:
                this.gameTime.addResource('food', amount);
                break;
        }
    }
    // ─── Public getters ───────────────────────────────────────────────────────────
    get colonistEids() { return this._colonistEids; }
}
