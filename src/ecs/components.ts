/**
 * bitECS component definitions — Bevy 스타일 ECS
 *
 * 모든 컴포넌트는 TypedArray 기반이라 매우 빠릅니다.
 * components.X[eid] 형태로 접근합니다.
 */
import { defineComponent, Types } from 'bitecs'

// ─── Spatial ──────────────────────────────────────────────────────────────────

/** World-pixel position */
export const Position = defineComponent({ x: Types.f32, y: Types.f32 })

// ─── Colonist Needs ───────────────────────────────────────────────────────────

export const Hunger = defineComponent({ value: Types.f32 })   // 0–100
export const Energy = defineComponent({ value: Types.f32 })   // 0–100
export const Mood   = defineComponent({ value: Types.f32 })   // 0–100

// ─── Colonist AI ──────────────────────────────────────────────────────────────

/** Current FSM state (ColonistStateId) */
export const ColonistState = defineComponent({ state: Types.ui8 })

/** Job assignment */
export const JobWorker = defineComponent({
  jobId:      Types.i32,  // -1 = no job
  workTimer:  Types.f32,
})

/** How long this entity has been idle (for wander trigger) */
export const IdleTimer = defineComponent({ elapsed: Types.f32 })

// ─── Resource nodes ───────────────────────────────────────────────────────────

export const Resource = defineComponent({
  kind:       Types.ui8,   // ResourceTypeId
  health:     Types.i16,
  maxHealth:  Types.i16,
  designated: Types.ui8,  // 0 | 1
})

// ─── Tag components (no data, used for queries) ───────────────────────────────

export const IsColonist = defineComponent()
export const IsResource = defineComponent()
