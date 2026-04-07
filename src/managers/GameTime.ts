/**
 * GameTime — 시간, 계절, 게임 속도 관리 (Bevy Resource 개념)
 */

export const enum Season { Spring, Summer, Autumn, Winter }

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'] as const
const SPEED_MULTIPLIERS = [0, 1, 2.5, 5] as const

const DAYS_PER_SEASON    = 15
const SECS_PER_GAME_HOUR = 2.5  // real seconds

export class GameTime {
  hour   = 6
  day    = 1
  year   = 1
  season = Season.Spring

  speedIndex = 1               // 0=paused, 1=1x, 2=2.5x, 3=5x
  wood  = 0
  stone = 0
  food  = 50

  private _hourTimer = 0

  /** Call each frame with real delta (seconds) */
  tick(delta: number): void {
    const mult = SPEED_MULTIPLIERS[this.speedIndex]
    if (mult === 0) return

    this._hourTimer += delta * mult

    if (this._hourTimer >= SECS_PER_GAME_HOUR) {
      this._hourTimer -= SECS_PER_GAME_HOUR
      this.hour++

      if (this.hour >= 24) {
        this.hour = 0
        this.day++

        if (this.day > DAYS_PER_SEASON) {
          this.day = 1
          this.season = ((this.season + 1) % 4) as Season
          if (this.season === Season.Spring) this.year++
        }
      }
    }
  }

  setSpeed(idx: 0 | 1 | 2 | 3): void { this.speedIndex = idx }

  addResource(kind: 'wood' | 'stone' | 'food', amount: number): void {
    if (kind === 'wood')  this.wood  += amount
    if (kind === 'stone') this.stone += amount
    if (kind === 'food')  this.food  += amount
  }

  /** Returns the effective multiplier for per-second rates */
  get multiplier(): number { return SPEED_MULTIPLIERS[this.speedIndex] }

  get seasonName(): string { return SEASON_NAMES[this.season] }

  get timeString(): string { return `${String(this.hour).padStart(2, '0')}:00` }
}
