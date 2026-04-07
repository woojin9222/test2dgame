// ─── Enums ────────────────────────────────────────────────────────────────────
export const STATE_NAMES = {
    [0 /* ColonistStateId.Idle */]: 'Idle',
    [1 /* ColonistStateId.Moving */]: 'Moving',
    [2 /* ColonistStateId.Working */]: 'Working',
    [3 /* ColonistStateId.Eating */]: 'Eating',
    [4 /* ColonistStateId.Sleeping */]: 'Sleeping',
    [5 /* ColonistStateId.Wandering */]: 'Wandering',
};
export const JOB_NAMES = {
    [0 /* JobTypeId.ChopTree */]: 'Chopping tree',
    [1 /* JobTypeId.MineRock */]: 'Mining rock',
    [2 /* JobTypeId.Haul */]: 'Hauling',
    [3 /* JobTypeId.Build */]: 'Building',
};
