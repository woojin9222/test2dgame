import { TILE_SIZE } from './WorldMap';
let _nextJobId = 1;
const JOB_PRIORITY = {
    [3 /* JobTypeId.Build */]: 8,
    [2 /* JobTypeId.Haul */]: 6,
    [0 /* JobTypeId.ChopTree */]: 5,
    [1 /* JobTypeId.MineRock */]: 5,
};
const WORK_REQUIRED = {
    [0 /* JobTypeId.ChopTree */]: 80,
    [1 /* JobTypeId.MineRock */]: 150,
    [2 /* JobTypeId.Haul */]: 20,
    [3 /* JobTypeId.Build */]: 100,
};
export class JobQueue {
    _pending = [];
    _all = new Map();
    // ─── Mutations ───────────────────────────────────────────────────────────────
    addJob(type, tx, ty, targetEid) {
        const job = {
            id: _nextJobId++,
            type,
            wx: tx * TILE_SIZE + TILE_SIZE / 2,
            wy: ty * TILE_SIZE + TILE_SIZE / 2,
            tx, ty,
            targetEid,
            priority: JOB_PRIORITY[type],
            workRequired: WORK_REQUIRED[type],
            workDone: 0,
            assignedEid: -1,
        };
        this._pending.push(job);
        this._sort();
        this._all.set(job.id, job);
        return job;
    }
    /** Returns the highest-priority unassigned job and marks it as assigned */
    claim(colonistEid) {
        for (const job of this._pending) {
            if (job.assignedEid === -1) {
                job.assignedEid = colonistEid;
                this._pending = this._pending.filter(j => j.id !== job.id);
                return job;
            }
        }
        return null;
    }
    /** Colonist couldn't do the job — return it to the queue */
    returnJob(job) {
        if (!this._all.has(job.id))
            return;
        job.assignedEid = -1;
        job.workDone = 0;
        this._pending.push(job);
        this._sort();
    }
    complete(job) {
        this._pending = this._pending.filter(j => j.id !== job.id);
        this._all.delete(job.id);
    }
    cancelByTarget(targetEid) {
        this._pending = this._pending.filter(j => j.targetEid !== targetEid);
        for (const [id, job] of this._all) {
            if (job.targetEid === targetEid)
                this._all.delete(id);
        }
    }
    hasJobForTarget(targetEid) {
        return [...this._all.values()].some(j => j.targetEid === targetEid);
    }
    // ─── Queries ─────────────────────────────────────────────────────────────────
    get pendingCount() { return this._pending.length; }
    _sort() {
        this._pending.sort((a, b) => b.priority - a.priority);
    }
}
