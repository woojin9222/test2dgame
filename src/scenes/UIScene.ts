/**
 * UIScene — Phaser 오버레이 UI (GameScene 위에서 실행)
 */
import Phaser from 'phaser'
import { Hunger, Energy, Mood, ColonistState, JobWorker } from '../ecs/components'
import { nameMap, colorMap } from '../ecs/world'
import { ColonistStateId, STATE_NAMES, JOB_NAMES, JobTypeId } from '../types'
import type { GameScene } from './GameScene'

const DARK  = 'rgba(12,12,22,0.88)'
const PANEL = 'rgba(16,16,30,0.92)'
const GOLD  = '#d4b866'
const BLUE  = '#6699ff'
const WHITE = '#e8eeff'
const DIM   = '#666688'

export class UIScene extends Phaser.Scene {
  private _game!: GameScene

  // DOM-style HTML overlay (simplest cross-platform UI)
  private _topBar!: Phaser.GameObjects.DOMElement
  private _leftPanel!: Phaser.GameObjects.DOMElement
  private _infoPanel!: Phaser.GameObjects.DOMElement
  private _tooltip!: Phaser.GameObjects.DOMElement

  private _selectedEid = -1
  private _tooltipTimer = 0

  constructor() { super('UI') }

  init(data: { gameScene: GameScene }): void {
    this._game = data.gameScene
  }

  create(): void {
    // Enable DOM elements for HTML-based UI
    this._createTopBar()
    this._createLeftPanel()
    this._createInfoPanel()
    this._createTooltip()

    // Listen to game events
    this._game.events.on('colonist-selected', (eid: number) => {
      this._selectedEid = eid
      this._infoPanel.setVisible(eid !== -1)
    })
  }

  update(_time: number, delta: number): void {
    const gt = this._game.gameTime
    this._tooltipTimer = Math.max(0, this._tooltipTimer - delta / 1000)
    if (this._tooltipTimer <= 0) this._tooltip.setVisible(false)

    // Top bar
    const topEl = this._topBar.node as HTMLElement
    topEl.querySelector('#time-label')!.textContent =
      `Day ${gt.day} | ${gt.seasonName} | ${gt.timeString}  —  Year ${gt.year}`
    topEl.querySelector('#res-label')!.textContent =
      `🪵 Wood: ${gt.wood}   🪨 Stone: ${gt.stone}   🍗 Food: ${gt.food}`
    topEl.querySelector('#jobs-label')!.textContent =
      `Jobs: ${this._game.jobQueue.pendingCount}`

    // Left panel colonist list
    const listEl = this._leftPanel.node.querySelector('#col-list') as HTMLElement
    const eids = this._game.colonistEids
    listEl.innerHTML = eids.map(eid => {
      const name   = nameMap.get(eid) ?? 'Unknown'
      const h      = Math.floor(Hunger.value[eid])
      const e      = Math.floor(Energy.value[eid])
      const state  = STATE_NAMES[ColonistState.state[eid] as ColonistStateId]
      const hColor = h > 30 ? '#44cc44' : '#ff4444'
      const eColor = e > 30 ? '#4488ff' : '#ff8800'
      const sel    = eid === this._selectedEid ? 'background:rgba(80,80,160,0.5);' : ''
      return `<div style="padding:4px 6px;border-bottom:1px solid #222;cursor:pointer;${sel}"
                   onclick="window.__selectColonist(${eid})">
        <b style="color:#aaeeff">${name}</b>
        <span style="float:right;font-size:10px;color:#aaa">${state}</span><br>
        <span style="font-size:11px">
          H:<b style="color:${hColor}">${h}</b>
          &nbsp;E:<b style="color:${eColor}">${e}</b>
        </span>
      </div>`
    }).join('')

    // Info panel (selected colonist)
    if (this._selectedEid !== -1) {
      const eid    = this._selectedEid
      const name   = nameMap.get(eid) ?? 'Unknown'
      const h      = Hunger.value[eid]
      const e      = Energy.value[eid]
      const mood   = Math.floor(Mood.value[eid] ?? 75)
      const state  = STATE_NAMES[ColonistState.state[eid] as ColonistStateId]
      const jobId  = JobWorker.jobId[eid]
      const jobStr = jobId !== -1 ? 'Working' : 'None'

      const infoEl = this._infoPanel.node as HTMLElement
      infoEl.querySelector('#info-name')!.textContent  = name
      infoEl.querySelector('#info-state')!.textContent = state
      infoEl.querySelector('#info-job')!.textContent   = `Job: ${jobStr}`
      ;(infoEl.querySelector('#hbar-fill') as HTMLElement).style.width = h + '%'
      ;(infoEl.querySelector('#ebar-fill') as HTMLElement).style.width = e + '%'
      infoEl.querySelector('#info-mood')!.textContent  = `Mood: ${_moodLabel(mood)} (${mood}%)`
    }
  }

  // ─── HTML element builders ────────────────────────────────────────────────────

  private _createTopBar(): void {
    const html = `
    <div style="
      width:1280px;height:42px;
      background:${DARK};
      border-bottom:2px solid #333355;
      display:flex;align-items:center;gap:24px;
      padding:0 12px;font-family:monospace;color:${WHITE};font-size:13px;">
      <span id="time-label" style="color:${GOLD}">Day 1 | Spring | 06:00</span>
      <span id="res-label"  style="color:#aadd88">Wood: 0  Stone: 0  Food: 50</span>
      <span id="jobs-label" style="color:${BLUE}">Jobs: 0</span>
      <span style="margin-left:auto;display:flex;gap:6px;">
        ${['⏸','▶ 1x','▶▶ 2.5x','▶▶▶ 5x'].map((t,i) =>
          `<button onclick="window.__setSpeed(${i})" style="
            background:#1e1e3a;border:1px solid #445;color:#ccd;
            padding:3px 8px;cursor:pointer;border-radius:3px;font-size:12px">${t}</button>`
        ).join('')}
      </span>
      <span style="font-size:10px;color:${DIM}">RMB: designate | MMB: pan | Scroll: zoom | WASD: camera</span>
    </div>`
    this._topBar = this.add.dom(0, 0).createFromHTML(html).setOrigin(0, 0)
  }

  private _createLeftPanel(): void {
    const html = `
    <div style="
      width:190px;
      background:${PANEL};
      border-right:2px solid #333355;
      font-family:monospace;color:${WHITE};font-size:12px;">
      <div style="padding:6px 8px;color:${BLUE};border-bottom:1px solid #333">COLONISTS</div>
      <div id="col-list"></div>
    </div>`
    this._leftPanel = this.add.dom(0, 42).createFromHTML(html).setOrigin(0, 0)
  }

  private _createInfoPanel(): void {
    const html = `
    <div style="
      width:320px;
      background:${PANEL};
      border:2px solid #4466cc;
      border-radius:4px;
      padding:10px;
      font-family:monospace;color:${WHITE};font-size:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <b id="info-name" style="font-size:14px;color:#aaeeff">Colonist</b>
        <span id="info-state" style="color:#88ff88;font-size:11px">Idle</span>
      </div>
      <div id="info-job" style="color:${GOLD};margin-bottom:8px;font-size:11px">Job: None</div>
      <div style="margin-bottom:4px;">
        <span style="color:${DIM}">Hunger</span>
        <div style="background:#222;height:12px;border-radius:2px;margin-top:2px;">
          <div id="hbar-fill" style="background:#33cc33;height:100%;width:100%;border-radius:2px;transition:width 0.3s"></div>
        </div>
      </div>
      <div style="margin-bottom:6px;">
        <span style="color:${DIM}">Energy</span>
        <div style="background:#222;height:12px;border-radius:2px;margin-top:2px;">
          <div id="ebar-fill" style="background:#3366ff;height:100%;width:100%;border-radius:2px;transition:width 0.3s"></div>
        </div>
      </div>
      <div id="info-mood" style="color:${GOLD};font-size:11px">Mood: Content</div>
    </div>`
    this._infoPanel = this.add.dom(190, 630).createFromHTML(html).setOrigin(0, 1).setVisible(false)
  }

  private _createTooltip(): void {
    const html = `<div id="tooltip" style="
      background:rgba(20,20,40,0.9);border:1px solid ${GOLD};
      color:${GOLD};font-family:monospace;font-size:13px;
      padding:4px 10px;border-radius:3px;"></div>`
    this._tooltip = this.add.dom(640, 60).createFromHTML(html).setOrigin(0.5, 0).setVisible(false)

    // Expose global helpers (used by inline onclick in HTML)
    ;(window as any).__setSpeed     = (i: number) => this._game.gameTime.setSpeed(i as 0|1|2|3)
    ;(window as any).__selectColonist = (eid: number) => {
      this._selectedEid = eid
      this._infoPanel.setVisible(true)
    }
  }

  showTooltip(msg: string, duration = 2): void {
    const el = this._tooltip.node.querySelector('#tooltip') as HTMLElement
    el.textContent = msg
    this._tooltip.setVisible(true)
    this._tooltipTimer = duration
  }
}

function _moodLabel(m: number): string {
  if (m > 75) return 'Happy'
  if (m > 50) return 'Content'
  if (m > 25) return 'Unhappy'
  return 'Miserable'
}
