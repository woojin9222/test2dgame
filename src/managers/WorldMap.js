export const TILE_SIZE = 32;
export const MAP_W = 80;
export const MAP_H = 60;
// ─── Tile color palette ───────────────────────────────────────────────────────
export const TILE_COLORS = {
    [0 /* TileType.Grass */]: 0x4d9928,
    [1 /* TileType.Dirt */]: 0x9470478,
    [2 /* TileType.Stone */]: 0x848488,
    [3 /* TileType.DeepStone */]: 0x4d4d57,
    [4 /* TileType.Water */]: 0x3366cc,
};
// ─── Noise helper (value noise, no deps) ─────────────────────────────────────
function hash(x, y) {
    let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
}
function smoothNoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return (hash(ix, iy) * (1 - ux) * (1 - uy) +
        hash(ix + 1, iy) * ux * (1 - uy) +
        hash(ix, iy + 1) * (1 - ux) * uy +
        hash(ix + 1, iy + 1) * ux * uy);
}
function fbm(x, y, octaves = 4) {
    let v = 0, amp = 0.5, freq = 1;
    for (let i = 0; i < octaves; i++) {
        v += smoothNoise(x * freq, y * freq) * amp;
        amp *= 0.5;
        freq *= 2;
    }
    return v;
}
// ─── WorldMap class ───────────────────────────────────────────────────────────
export class WorldMap {
    tiles; // [y * MAP_W + x]
    /** Blocked tiles (water + resource nodes) */
    blocked; // 0 | 1
    _seed;
    constructor() {
        this.tiles = new Uint8Array(MAP_W * MAP_H);
        this.blocked = new Uint8Array(MAP_W * MAP_H);
        this._seed = Math.random() * 1000;
        this._generate();
    }
    _idx(x, y) { return y * MAP_W + x; }
    _generate() {
        const s = this._seed;
        for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
                const v = fbm(x * 0.05 + s, y * 0.05 + s);
                let tile;
                if (v < 0.28)
                    tile = 4 /* TileType.Water */;
                else if (v < 0.38)
                    tile = 1 /* TileType.Dirt */;
                else if (v > 0.68)
                    tile = 3 /* TileType.DeepStone */;
                else if (v > 0.58)
                    tile = 2 /* TileType.Stone */;
                else
                    tile = 0 /* TileType.Grass */;
                this.tiles[this._idx(x, y)] = tile;
                if (tile === 4 /* TileType.Water */)
                    this.blocked[this._idx(x, y)] = 1;
            }
        }
        // Safe spawn area at center
        const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2);
        for (let dy = -5; dy <= 5; dy++)
            for (let dx = -5; dx <= 5; dx++) {
                const tx = cx + dx, ty = cy + dy;
                if (this._inBounds(tx, ty)) {
                    this.tiles[this._idx(tx, ty)] = 0 /* TileType.Grass */;
                    this.blocked[this._idx(tx, ty)] = 0;
                }
            }
    }
    // ─── Public API ─────────────────────────────────────────────────────────────
    getTile(tx, ty) {
        if (!this._inBounds(tx, ty))
            return 4 /* TileType.Water */;
        return this.tiles[this._idx(tx, ty)];
    }
    isWalkable(tx, ty) {
        if (!this._inBounds(tx, ty))
            return false;
        return this.blocked[this._idx(tx, ty)] === 0;
    }
    setBlocked(tx, ty, v) {
        if (this._inBounds(tx, ty))
            this.blocked[this._idx(tx, ty)] = v ? 1 : 0;
    }
    worldToTile(wx, wy) {
        return { tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) };
    }
    tileToWorld(tx, ty) {
        return {
            wx: tx * TILE_SIZE + TILE_SIZE / 2,
            wy: ty * TILE_SIZE + TILE_SIZE / 2,
        };
    }
    /** A* path (returns world-pixel waypoints, empty = no path) */
    findPath(fromWx, fromWy, toWx, toWy) {
        const { tx: sx, ty: sy } = this.worldToTile(fromWx, fromWy);
        let { tx: gx, ty: gy } = this.worldToTile(toWx, toWy);
        if (!this.isWalkable(gx, gy)) {
            const nb = this._nearestWalkable(gx, gy);
            if (!nb)
                return [];
            gx = nb.tx;
            gy = nb.ty;
        }
        if (sx === gx && sy === gy)
            return [];
        const open = [];
        const closed = new Set();
        const key = (x, y) => y * MAP_W + x;
        const start = { tx: sx, ty: sy, g: 0, f: this._h(sx, sy, gx, gy), parent: null };
        open.push(start);
        while (open.length > 0) {
            // Pop lowest-f node
            let bi = 0;
            for (let i = 1; i < open.length; i++)
                if (open[i].f < open[bi].f)
                    bi = i;
            const cur = open.splice(bi, 1)[0];
            if (cur.tx === gx && cur.ty === gy) {
                // Reconstruct
                const path = [];
                let n = cur;
                while (n) {
                    const { wx, wy } = this.tileToWorld(n.tx, n.ty);
                    path.unshift({ x: wx, y: wy });
                    n = n.parent;
                }
                return path;
            }
            const ck = key(cur.tx, cur.ty);
            if (closed.has(ck))
                continue;
            closed.add(ck);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cur.tx + dx, ny = cur.ty + dy;
                if (!this.isWalkable(nx, ny))
                    continue;
                if (closed.has(key(nx, ny)))
                    continue;
                const g = cur.g + 1;
                open.push({ tx: nx, ty: ny, g, f: g + this._h(nx, ny, gx, gy), parent: cur });
            }
        }
        return [];
    }
    _h(ax, ay, bx, by) {
        return Math.abs(ax - bx) + Math.abs(ay - by);
    }
    _inBounds(tx, ty) {
        return tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H;
    }
    _nearestWalkable(tx, ty) {
        for (let r = 1; r < 6; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r)
                        continue;
                    const nx = tx + dx, ny = ty + dy;
                    if (this.isWalkable(nx, ny))
                        return { tx: nx, ty: ny };
                }
            }
        }
        return null;
    }
}
