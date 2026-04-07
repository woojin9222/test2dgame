/**
 * GameTime — 시간, 계절, 게임 속도 관리 (Bevy Resource 개념)
 */
const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const SPEED_MULTIPLIERS = [0, 1, 2.5, 5];
const DAYS_PER_SEASON = 15;
const SECS_PER_GAME_HOUR = 2.5; // real seconds
export class GameTime {
    hour = 6;
    day = 1;
    year = 1;
    season = 0 /* Season.Spring */;
    speedIndex = 1; // 0=paused, 1=1x, 2=2.5x, 3=5x
    wood = 0;
    stone = 0;
    food = 50;
    _hourTimer = 0;
    /** Call each frame with real delta (seconds) */
    tick(delta) {
        const mult = SPEED_MULTIPLIERS[this.speedIndex];
        if (mult === 0)
            return;
        this._hourTimer += delta * mult;
        if (this._hourTimer >= SECS_PER_GAME_HOUR) {
            this._hourTimer -= SECS_PER_GAME_HOUR;
            this.hour++;
            if (this.hour >= 24) {
                this.hour = 0;
                this.day++;
                if (this.day > DAYS_PER_SEASON) {
                    this.day = 1;
                    this.season = ((this.season + 1) % 4);
                    if (this.season === 0 /* Season.Spring */)
                        this.year++;
                }
            }
        }
    }
    setSpeed(idx) { this.speedIndex = idx; }
    addResource(kind, amount) {
        if (kind === 'wood')
            this.wood += amount;
        if (kind === 'stone')
            this.stone += amount;
        if (kind === 'food')
            this.food += amount;
    }
    /** Returns the effective multiplier for per-second rates */
    get multiplier() { return SPEED_MULTIPLIERS[this.speedIndex]; }
    get seasonName() { return SEASON_NAMES[this.season]; }
    get timeString() { return `${String(this.hour).padStart(2, '0')}:00`; }
}
