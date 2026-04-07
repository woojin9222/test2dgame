/**
 * UIScene — Phaser 오버레이 UI (GameScene 위에서 실행)
 */
import Phaser from 'phaser';
import { Hunger, Energy, Mood, ColonistState, JobWorker } from '../ecs/components';
import { nameMap } from '../ecs/world';
import { STATE_NAMES } from '../types';
const DARK = 'rgba(12,12,22,0.88)';
const PANEL = 'rgba(16,16,30,0.92)';
const GOLD = '#d4b866';
const BLUE = '#6699ff';
const WHITE = '#e8eeff';
const DIM = '#666688';
export class UIScene extends Phaser.Scene {
    _game;
    // DOM-style HTML overlay (simplest cross-platform UI)
    _topBar;
    _leftPanel;
    _infoPanel;
    _tooltip;
    _selectedEid = -1;
    _tooltipTimer = 0;
    constructor() { super('UI'); }
    init(data) {
        this._game = data.gameScene;
    }
    create() {
        // Enable DOM elements for HTML-based UI
        this._createTopBar();
        this._createLeftPanel();
        this._createInfoPanel();
        this._createTooltip();
        // Listen to game events
        this._game.events.on('colonist-selected', (eid) => {
            this._selectedEid = eid;
            this._infoPanel.setVisible(eid !== -1);
        });
    }
    update(_time, delta) {
        const gt = this._game.gameTime;
        this._tooltipTimer = Math.max(0, this._tooltipTimer - delta / 1000);
        if (this._tooltipTimer <= 0)
            this._tooltip.setVisible(false);
        // Top bar
        const topEl = this._topBar.node;
        topEl.querySelector('#time-label').textContent =
            `Day ${gt.day} | ${gt.seasonName} | ${gt.timeString}  —  Year ${gt.year}`;
        topEl.querySelector('#res-label').textContent =
            `🪵 Wood: ${gt.wood}   🪨 Stone: ${gt.stone}   🍗 Food: ${gt.food}`;
        topEl.querySelector('#jobs-label').textContent =
            `Jobs: ${this._game.jobQueue.pendingCount}`;
        // Left panel colonist list
        const listEl = this._leftPanel.node.querySelector('#col-list');
        const eids = this._game.colonistEids;
        listEl.innerHTML = eids.map(eid => {
            const name = nameMap.get(eid) ?? 'Unknown';
            const h = Math.floor(Hunger.value[eid]);
            const e = Math.floor(Energy.value[eid]);
            const state = STATE_NAMES[ColonistState.state[eid]];
            const hColor = h > 30 ? '#44cc44' : '#ff4444';
            const eColor = e > 30 ? '#4488ff' : '#ff8800';
            const sel = eid === this._selectedEid ? 'background:rgba(80,80,160,0.5);' : '';
            return `<div style="padding:4px 6px;border-bottom:1px solid #222;cursor:pointer;${sel}"
                   onclick="window.__selectColonist(${eid})">
        <b style="color:#aaeeff">${name}</b>
        <span style="float:right;font-size:10px;color:#aaa">${state}</span><br>
        <span style="font-size:11px">
          H:<b style="color:${hColor}">${h}</b>
          &nbsp;E:<b style="color:${eColor}">${e}</b>
        </span>
      </div>`;
        }).join('');
        // Info panel (selected colonist)
        if (this._selectedEid !== -1) {
            const eid = this._selectedEid;
            const name = nameMap.get(eid) ?? 'Unknown';
            const h = Hunger.value[eid];
            const e = Energy.value[eid];
            const mood = Math.floor(Mood.value[eid] ?? 75);
            const state = STATE_NAMES[ColonistState.state[eid]];
            const jobId = JobWorker.jobId[eid];
            const jobStr = jobId !== -1 ? 'Working' : 'None';
            const infoEl = this._infoPanel.node;
            infoEl.querySelector('#info-name').textContent = name;
            infoEl.querySelector('#info-state').textContent = state;
            infoEl.querySelector('#info-job').textContent = `Job: ${jobStr}`;
            infoEl.querySelector('#hbar-fill').style.width = h + '%';
            infoEl.querySelector('#ebar-fill').style.width = e + '%';
            infoEl.querySelector('#info-mood').textContent = `Mood: ${_moodLabel(mood)} (${mood}%)`;
        }
    }
    // ─── HTML element builders ────────────────────────────────────────────────────
    _createTopBar() {
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
        ${['⏸', '▶ 1x', '▶▶ 2.5x', '▶▶▶ 5x'].map((t, i) => `<button onclick="window.__setSpeed(${i})" style="
            background:#1e1e3a;border:1px solid #445;color:#ccd;
            padding:3px 8px;cursor:pointer;border-radius:3px;font-size:12px">${t}</button>`).join('')}
      </span>
      <span id="hint-text" style="font-size:10px;color:${DIM}">RMB: 지정 | MMB: 이동 | 휠: 줌 | WASD: 카메라</span>
    </div>`;
        this._topBar = this.add.dom(0, 0).createFromHTML(html).setOrigin(0, 0);
        // 모바일이면 힌트 텍스트 변경
        if (!this.sys.game.device.os.desktop) {
            const hint = this._topBar.node.querySelector('#hint-text');
            if (hint)
                hint.textContent = '탭: 선택 | 길게누름: 지정 | 두손가락: 이동/줌';
        }
    }
    _createLeftPanel() {
        const html = `
    <div style="
      width:190px;
      background:${PANEL};
      border-right:2px solid #333355;
      font-family:monospace;color:${WHITE};font-size:12px;">
      <div style="padding:6px 8px;color:${BLUE};border-bottom:1px solid #333">COLONISTS</div>
      <div id="col-list"></div>
    </div>`;
        this._leftPanel = this.add.dom(0, 42).createFromHTML(html).setOrigin(0, 0);
    }
    _createInfoPanel() {
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
    </div>`;
        this._infoPanel = this.add.dom(190, 630).createFromHTML(html).setOrigin(0, 1).setVisible(false);
    }
    _createTooltip() {
        const html = `<div id="tooltip" style="
      background:rgba(20,20,40,0.9);border:1px solid ${GOLD};
      color:${GOLD};font-family:monospace;font-size:13px;
      padding:4px 10px;border-radius:3px;"></div>`;
        this._tooltip = this.add.dom(640, 60).createFromHTML(html).setOrigin(0.5, 0).setVisible(false);
        window.__setSpeed = (i) => this._game.gameTime.setSpeed(i);
        window.__selectColonist = (eid) => {
            this._selectedEid = eid;
            this._infoPanel.setVisible(true);
        };
        // 모바일 전용 하단 버튼
        if (!this.sys.game.device.os.desktop) {
            this._createMobileButtons();
        }
    }
    _createMobileButtons() {
        const btnStyle = `
      background:rgba(20,20,50,0.9);
      border:2px solid #446;
      color:#cce;
      font-size:22px;
      width:56px;height:56px;
      border-radius:12px;
      cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      touch-action:manipulation;
      -webkit-tap-highlight-color:transparent;
    `;
        const html = `
    <div style="display:flex;gap:10px;">
      <button id="btn-designate" style="${btnStyle}" title="지정 (길게누름과 동일)">🪓</button>
      <button id="btn-cancel"    style="${btnStyle}" title="지정 취소">✖</button>
      <button id="btn-speed"     style="${btnStyle}" title="속도">▶</button>
    </div>`;
        const bar = this.add.dom(10, 710).createFromHTML(html).setOrigin(0, 1);
        let _designateMode = false;
        bar.node.querySelector('#btn-designate').addEventListener('click', () => {
            _designateMode = !_designateMode;
            const btn = bar.node.querySelector('#btn-designate');
            btn.style.borderColor = _designateMode ? '#ff0' : '#446';
            window.__designateMode = _designateMode;
        });
        bar.node.querySelector('#btn-cancel').addEventListener('click', () => {
            _designateMode = false;
            const btn = bar.node.querySelector('#btn-designate');
            btn.style.borderColor = '#446';
            window.__designateMode = false;
        });
        let _speedIdx = 1;
        bar.node.querySelector('#btn-speed').addEventListener('click', () => {
            _speedIdx = (_speedIdx + 1) % 4;
            this._game.gameTime.setSpeed(_speedIdx);
            const labels = ['⏸', '▶', '▶▶', '▶▶▶'];
            bar.node.querySelector('#btn-speed').textContent = labels[_speedIdx];
        });
    }
    showTooltip(msg, duration = 2) {
        const el = this._tooltip.node.querySelector('#tooltip');
        el.textContent = msg;
        this._tooltip.setVisible(true);
        this._tooltipTimer = duration;
    }
}
function _moodLabel(m) {
    if (m > 75)
        return 'Happy';
    if (m > 50)
        return 'Content';
    if (m > 25)
        return 'Unhappy';
    return 'Miserable';
}
