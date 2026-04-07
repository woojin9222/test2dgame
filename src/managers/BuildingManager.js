/**
 * BuildingManager — 건물 배치, 타일 레이어 관리
 * 각 타일에 어떤 건물 EID가 있는지 추적합니다.
 */
import { removeEntity } from 'bitecs';
import { world, spawnBuilding, gfxMap } from '../ecs/world';
import { Building, Position } from '../ecs/components';
import { BUILDING_DEFS } from '../types';
import { MAP_W, MAP_H } from './WorldMap';
/** tile index → building eid (0 = empty) */
const NO_BUILDING = 0;
export class BuildingManager {
    /** Non-floor buildings [ty * MAP_W + tx] → eid or 0 */
    _tiles = new Int32Array(MAP_W * MAP_H);
    /** Floor layer (separate so furniture can be placed on top) */
    _floorTiles = new Int32Array(MAP_W * MAP_H);
    /** All building eids */
    buildingEids = new Set();
    /** Stockpile tile set (tx,ty) → true */
    stockpileTiles = new Set();
    _worldMap;
    _jobQueue;
    _gameTime;
    constructor(worldMap, jobQueue, gameTime) {
        this._worldMap = worldMap;
        this._jobQueue = jobQueue;
        this._gameTime = gameTime;
    }
    // ─── Queries ──────────────────────────────────────────────────────────────────
    getAt(tx, ty) {
        const idx = ty * MAP_W + tx;
        return this._tiles[idx] !== NO_BUILDING ? this._tiles[idx] : (this._floorTiles[idx] ?? NO_BUILDING);
    }
    isEmpty(tx, ty) {
        const idx = ty * MAP_W + tx;
        return this._tiles[idx] === NO_BUILDING && this._floorTiles[idx] === NO_BUILDING;
    }
    isStockpile(tx, ty) {
        return this.stockpileTiles.has(`${tx},${ty}`);
    }
    /** Returns true if a building can be placed on this tile */
    canPlace(tx, ty, kind) {
        if (tx < 0 || tx >= MAP_W || ty < 0 || ty >= MAP_H)
            return false;
        if (!this._worldMap.isWalkable(tx, ty))
            return false;
        const idx = ty * MAP_W + tx;
        if (kind === 1 /* BuildingKind.Floor */) {
            // Can only place floor if no building at all exists here
            return this._floorTiles[idx] === NO_BUILDING && this._tiles[idx] === NO_BUILDING;
        }
        else {
            // Furniture/walls: can be placed on top of a completed floor, but not if another non-floor building exists
            if (this._tiles[idx] !== NO_BUILDING)
                return false;
            // If floor exists, it must be completed (not blueprint)
            if (this._floorTiles[idx] !== NO_BUILDING) {
                const floorEid = this._floorTiles[idx];
                if (Building.isBuilt[floorEid] !== 1)
                    return false; // floor still under construction
            }
            return true;
        }
    }
    // ─── Placement ────────────────────────────────────────────────────────────────
    /**
     * Place a building blueprint (or instant for Stockpile).
     * Returns the new eid, or -1 if placement failed.
     */
    place(tx, ty, kind) {
        if (!this.canPlace(tx, ty, kind))
            return -1;
        const def = BUILDING_DEFS[kind];
        const { wx, wy } = this._worldMap.tileToWorld(tx, ty);
        const idx = ty * MAP_W + tx;
        const isInstant = def.instantBuild;
        const eid = spawnBuilding(wx, wy, kind, isInstant, def.hp);
        if (kind === 1 /* BuildingKind.Floor */) {
            this._floorTiles[idx] = eid;
        }
        else {
            this._tiles[idx] = eid;
        }
        this.buildingEids.add(eid);
        if (kind === 3 /* BuildingKind.Stockpile */) {
            this.stockpileTiles.add(`${tx},${ty}`);
        }
        // 즉시 배치가 아닌 경우 → 경로탐색 차단 + 건설 작업 등록
        if (!isInstant) {
            this._worldMap.setBlocked(tx, ty, true);
            this._jobQueue.addJob(3 /* JobTypeId.Build */, tx, ty, eid);
        }
        return eid;
    }
    /** Called by BuildSystem when construction completes */
    finishBuilding(eid) {
        const kind = Building.kind[eid];
        const def = BUILDING_DEFS[kind];
        // Deduct materials NOW (at construction completion, not blueprint placement)
        if (!def.instantBuild) {
            if (this._gameTime.wood < def.costWood)
                return false;
            if (this._gameTime.stone < def.costStone)
                return false;
            this._gameTime.wood -= def.costWood;
            this._gameTime.stone -= def.costStone;
        }
        Building.isBuilt[eid] = 1;
        Building.buildProgress[eid] = 100;
        if (def.walkable) {
            // 바닥/문 → 통행 가능하게
            const { tx, ty } = this._worldMap.worldToTile(Position.x[eid], Position.y[eid]);
            this._worldMap.setBlocked(tx, ty, false);
        }
        return true;
    }
    /** Remove a building (deconstruct or destroy) */
    remove(tx, ty) {
        const idx = ty * MAP_W + tx;
        // Prefer removing non-floor building first; if none, remove floor
        const eid = this._tiles[idx] !== NO_BUILDING ? this._tiles[idx] : this._floorTiles[idx];
        if (eid === NO_BUILDING)
            return;
        if (this._tiles[idx] === eid) {
            this._tiles[idx] = NO_BUILDING;
        }
        else {
            this._floorTiles[idx] = NO_BUILDING;
        }
        this.buildingEids.delete(eid);
        this.stockpileTiles.delete(`${tx},${ty}`);
        this._worldMap.setBlocked(tx, ty, false);
        this._jobQueue.cancelByTarget(eid);
        const gfx = gfxMap.get(eid);
        if (gfx) {
            gfx.destroy();
            gfxMap.delete(eid);
        }
        removeEntity(world, eid);
    }
    /** Find nearest stockpile tile from world position, returns world coords or null */
    findNearestStockpile(wx, wy) {
        let best = null;
        let bestDist = Infinity;
        for (const key of this.stockpileTiles) {
            const [tx, ty] = key.split(',').map(Number);
            const { wx: swx, wy: swy } = this._worldMap.tileToWorld(tx, ty);
            const d = Math.hypot(swx - wx, swy - wy);
            if (d < bestDist) {
                bestDist = d;
                best = { wx: swx, wy: swy };
            }
        }
        return best;
    }
}
