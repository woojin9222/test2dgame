/**
 * JobQueue — 우선순위 큐 기반 작업 관리 (Bevy Resource 개념)
 */
import { JobEntry, JobTypeId } from '../types'
import { TILE_SIZE } from './WorldMap'

let _nextJobId = 1

const JOB_PRIORITY: Record<JobTypeId, number> = {
  [JobTypeId.Build]:    8,
  [JobTypeId.Haul]:     6,
  [JobTypeId.ChopTree]: 5,
  [JobTypeId.MineRock]: 5,
}

const WORK_REQUIRED: Record<JobTypeId, number> = {
  [JobTypeId.ChopTree]: 80,
  [JobTypeId.MineRock]: 150,
  [JobTypeId.Haul]:     20,
  [JobTypeId.Build]:    100,
}

export class JobQueue {
  private _pending:  JobEntry[] = []
  private _all:      Map<number, JobEntry> = new Map()

  // ─── Mutations ───────────────────────────────────────────────────────────────

  addJob(type: JobTypeId, tx: number, ty: number, targetEid: number): JobEntry {
    const job: JobEntry = {
      id: _nextJobId++,
      type,
      wx: tx * TILE_SIZE + TILE_SIZE / 2,
      wy: ty * TILE_SIZE + TILE_SIZE / 2,
      tx, ty,
      targetEid,
      priority:     JOB_PRIORITY[type],
      workRequired: WORK_REQUIRED[type],
      workDone:     0,
      assignedEid:  -1,
    }
    this._pending.push(job)
    this._sort()
    this._all.set(job.id, job)
    return job
  }

  /** Returns the highest-priority unassigned job and marks it as assigned */
  claim(colonistEid: number): JobEntry | null {
    for (const job of this._pending) {
      if (job.assignedEid === -1) {
        job.assignedEid = colonistEid
        this._pending = this._pending.filter(j => j.id !== job.id)
        return job
      }
    }
    return null
  }

  /** Colonist couldn't do the job — return it to the queue */
  returnJob(job: JobEntry): void {
    if (!this._all.has(job.id)) return
    job.assignedEid = -1
    job.workDone    = 0
    this._pending.push(job)
    this._sort()
  }

  complete(job: JobEntry): void {
    this._pending = this._pending.filter(j => j.id !== job.id)
    this._all.delete(job.id)
  }

  cancelByTarget(targetEid: number): void {
    this._pending = this._pending.filter(j => j.targetEid !== targetEid)
    for (const [id, job] of this._all) {
      if (job.targetEid === targetEid) this._all.delete(id)
    }
  }

  hasJobForTarget(targetEid: number): boolean {
    return [...this._all.values()].some(j => j.targetEid === targetEid)
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  get pendingCount(): number { return this._pending.length }

  private _sort(): void {
    this._pending.sort((a, b) => b.priority - a.priority)
  }
}
