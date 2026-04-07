// ─── Enums ────────────────────────────────────────────────────────────────────
export const BUILDING_DEFS = {
    [0 /* BuildingKind.Wall */]: {
        kind: 0 /* BuildingKind.Wall */, label: '벽', emoji: '🧱',
        costWood: 0, costStone: 4, walkable: false, instantBuild: false, hp: 200,
    },
    [1 /* BuildingKind.Floor */]: {
        kind: 1 /* BuildingKind.Floor */, label: '바닥', emoji: '🟫',
        costWood: 2, costStone: 0, walkable: true, instantBuild: false, hp: 50,
    },
    [2 /* BuildingKind.Door */]: {
        kind: 2 /* BuildingKind.Door */, label: '문', emoji: '🚪',
        costWood: 3, costStone: 0, walkable: true, instantBuild: false, hp: 80,
    },
    [3 /* BuildingKind.Stockpile */]: {
        kind: 3 /* BuildingKind.Stockpile */, label: '창고', emoji: '📦',
        costWood: 0, costStone: 0, walkable: true, instantBuild: true, hp: 1,
    },
    [4 /* BuildingKind.Container */]: {
        kind: 4 /* BuildingKind.Container */, label: '보관함', emoji: '🗃️',
        costWood: 5, costStone: 0, walkable: false, instantBuild: false, hp: 60,
    },
};
export const STATE_NAMES = {
    [0 /* ColonistStateId.Idle */]: 'Idle',
    [1 /* ColonistStateId.Moving */]: 'Moving',
    [2 /* ColonistStateId.Working */]: 'Working',
    [3 /* ColonistStateId.Eating */]: 'Eating',
    [4 /* ColonistStateId.Sleeping */]: 'Sleeping',
    [5 /* ColonistStateId.Wandering */]: 'Wandering',
};
export const JOB_NAMES = {
    [0 /* JobTypeId.ChopTree */]: '나무 베기',
    [1 /* JobTypeId.MineRock */]: '채굴',
    [2 /* JobTypeId.Haul */]: '운반',
    [3 /* JobTypeId.Build */]: '건설',
};
