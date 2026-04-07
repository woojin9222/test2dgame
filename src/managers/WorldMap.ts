/**
 * WorldMap — 타일 맵 생성, A* 경로 탐색, 타일 쿼리
 */
import { TileType } from '../types'

export const TILE_SIZE  = 32
export const MAP_W      = 80
export const MAP_H      = 60

// ─── Tile color palette ───────────────────────────────────────────────────────

export const TILE_COLORS: Record<TileType, number> = {
  [TileType.Grass]:     0x4d9928,
  [TileType.Dirt]:      0x9470478,
  [TileType.Stone]:     0x848488,
  [TileType.DeepStone]: 0x4d4d57,
  [TileType.Water]:     0x3366cc,
}

// ─── Noise helper (value noise, no deps) ─────────────────────────────────────

function hash(x: number, y: number): number {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  return (
    hash(ix,   iy  ) * (1-ux) * (1-uy) +
    hash(ix+1, iy  ) * ux     * (1-uy) +
    hash(ix,   iy+1) * (1-ux) * uy     +
    hash(ix+1, iy+1) * ux     * uy
  )
}

function fbm(x: number, y: number, octaves = 4): number {
  let v = 0, amp = 0.5, freq = 1
  for (let i = 0; i < octaves; i++) {
    v += smoothNoise(x * freq, y * freq) * amp
    amp *= 0.5; freq *= 2
  }
  return v
}

// ─── WorldMap class ───────────────────────────────────────────────────────────

export class WorldMap {
  readonly tiles: Uint8Array            // [y * MAP_W + x]
  /** Blocked tiles (water + resource nodes) */
  private readonly blocked: Uint8Array  // 0 | 1

  private readonly _seed: number

  constructor() {
    this.tiles   = new Uint8Array(MAP_W * MAP_H)
    this.blocked = new Uint8Array(MAP_W * MAP_H)
    this._seed   = Math.random() * 1000
    this._generate()
  }

  private _idx(x: number, y: number): number { return y * MAP_W + x }

  private _generate(): void {
    const s = this._seed
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const v = fbm(x * 0.05 + s, y * 0.05 + s)
        let tile: TileType
        if      (v < 0.28) tile = TileType.Water
        else if (v < 0.38) tile = TileType.Dirt
        else if (v > 0.68) tile = TileType.DeepStone
        else if (v > 0.58) tile = TileType.Stone
        else               tile = TileType.Grass

        this.tiles[this._idx(x, y)] = tile
        if (tile === TileType.Water) this.blocked[this._idx(x, y)] = 1
      }
    }

    // Safe spawn area at center
    const cx = Math.floor(MAP_W / 2), cy = Math.floor(MAP_H / 2)
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++) {
        const tx = cx + dx, ty = cy + dy
        if (this._inBounds(tx, ty)) {
          this.tiles[this._idx(tx, ty)]   = TileType.Grass
          this.blocked[this._idx(tx, ty)] = 0
        }
      }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  getTile(tx: number, ty: number): TileType {
    if (!this._inBounds(tx, ty)) return TileType.Water
    return this.tiles[this._idx(tx, ty)] as TileType
  }

  isWalkable(tx: number, ty: number): boolean {
    if (!this._inBounds(tx, ty)) return false
    return this.blocked[this._idx(tx, ty)] === 0
  }

  setBlocked(tx: number, ty: number, v: boolean): void {
    if (this._inBounds(tx, ty))
      this.blocked[this._idx(tx, ty)] = v ? 1 : 0
  }

  worldToTile(wx: number, wy: number): { tx: number; ty: number } {
    return { tx: Math.floor(wx / TILE_SIZE), ty: Math.floor(wy / TILE_SIZE) }
  }

  tileToWorld(tx: number, ty: number): { wx: number; wy: number } {
    return {
      wx: tx * TILE_SIZE + TILE_SIZE / 2,
      wy: ty * TILE_SIZE + TILE_SIZE / 2,
    }
  }

  /** A* path (returns world-pixel waypoints, empty = no path) */
  findPath(
    fromWx: number, fromWy: number,
    toWx: number,   toWy: number,
  ): { x: number; y: number }[] {
    const { tx: sx, ty: sy } = this.worldToTile(fromWx, fromWy)
    let   { tx: gx, ty: gy } = this.worldToTile(toWx,   toWy)

    if (!this.isWalkable(gx, gy)) {
      const nb = this._nearestWalkable(gx, gy)
      if (!nb) return []
      gx = nb.tx; gy = nb.ty
    }

    if (sx === gx && sy === gy) return []

    // A* with Manhattan heuristic
    type Node = { tx: number; ty: number; g: number; f: number; parent: Node | null }
    const open: Node[] = []
    const closed = new Set<number>()
    const key = (x: number, y: number) => y * MAP_W + x

    const start: Node = { tx: sx, ty: sy, g: 0, f: this._h(sx, sy, gx, gy), parent: null }
    open.push(start)

    while (open.length > 0) {
      // Pop lowest-f node
      let bi = 0
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i
      const cur = open.splice(bi, 1)[0]

      if (cur.tx === gx && cur.ty === gy) {
        // Reconstruct
        const path: { x: number; y: number }[] = []
        let n: Node | null = cur
        while (n) {
          const { wx, wy } = this.tileToWorld(n.tx, n.ty)
          path.unshift({ x: wx, y: wy })
          n = n.parent
        }
        return path
      }

      const ck = key(cur.tx, cur.ty)
      if (closed.has(ck)) continue
      closed.add(ck)

      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = cur.tx + dx, ny = cur.ty + dy
        if (!this.isWalkable(nx, ny)) continue
        if (closed.has(key(nx, ny))) continue
        const g = cur.g + 1
        open.push({ tx: nx, ty: ny, g, f: g + this._h(nx, ny, gx, gy), parent: cur })
      }
    }
    return []
  }

  private _h(ax: number, ay: number, bx: number, by: number): number {
    return Math.abs(ax - bx) + Math.abs(ay - by)
  }

  private _inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H
  }

  private _nearestWalkable(tx: number, ty: number): { tx: number; ty: number } | null {
    for (let r = 1; r < 6; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue
          const nx = tx + dx, ny = ty + dy
          if (this.isWalkable(nx, ny)) return { tx: nx, ty: ny }
        }
      }
    }
    return null
  }
}
