/** Shared tunable gameplay and presentation values for λRush. */

// Run timer and rewards
export const TIMER_START = 120;
export const CLOCK_TARGET = 20;
/** Correct answers 16–20 each land one strike on Σ; the fifth defeats it. */
export const SIGMA_HEALTH_BARS = 5;
/** Answers 1–15 assemble the dial: twelve numerals, the centre pin, then both hands. */
export const CLOCK_ASSEMBLY_COUNT = CLOCK_TARGET - SIGMA_HEALTH_BARS;
export const CLOCK_INTRO_SECONDS = 4;
/** Results and Play Again follow the final strike, dissolve, fade and centring. */
export const CLOCK_CELEBRATION_SECONDS = 5.4;
/** Σ's bite clock while it hovers in the battle: aggressive, never a pursuit speed. */
export const BATTLE_BITE_RATE = 2.6;
/** Σ is parked this far behind λ while airborne, so the rear boundary cannot catch. */
export const BATTLE_REAR_GAP = 4000;
export const LOW_TIME = 10;
export const SIGMA_BASE_SPEED = 75;
export const SIGMA_BITE_RATE = 1.5;
export const TIME_BONUS_TRIPLE_BELOW = 7;
/** Spawn Sigma fully within the 2D camera without triggering the opening proximity cue. */
export const SIGMA_SPAWN_GAP = 400;

// Σ pace is fixed for the whole run; Focus may only slow it down.
export const QUESTION_SLOW = 0.25;
export const QUESTION_SLOW_THRESHOLD = 60;
export const POINTS_MIN = 100;
/** Cap on how fast Σ's cosmetic clock may run relative to real time. */
export const SIGMA_CLOCK_MAX = 3;

// Shared health across every 2D stage.
export const HEARTS_2D = 5;

// Danger effects (section 6.3)
export const PROX2D_START_PX = 240;
export const PROX2D_MAX_SHAKE_PX = 1.5;
export const PROX2D_MAX_ZOOM = 0.025;

// Σ bite cycle (section 6.1), seconds
export const BITE_CYCLE_MIN_S = 1.3;
export const BITE_CYCLE_MAX_S = 1.9;
export const BITE_REST_S = 0.25;
export const BITE_REAR_S = 0.12;
export const BITE_STRIKE_S = 0.07;
export const BITE_CLAMP_S = 0.2;

// Checkpoint pulse (section 5), seconds
export const CHECKPOINT_PULSE_MIN_S = 1.2;
export const CHECKPOINT_PULSE_MAX_S = 1.6;

// Correct-answer feedback (section 6.4), seconds
export const CORRECT_FADE_S = 0.8;
export const BONUS_HOLD_S = 0.6;
export const BONUS_FLY_S = 0.45;
export const WRONG_FLASH_S = 0.25;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The confirmed 25% question slowdown, only while 60 s or less is banked. */
export function questionSlowdown(atQuestion: boolean, timer: number) {
  return atQuestion && timer <= QUESTION_SLOW_THRESHOLD ? QUESTION_SLOW : 1;
}

/** Multiply Haskell's raw canonical-answer reward using the current game rule. */
export function rewardedTimeBonus(baseBonus: number) {
  if (!Number.isFinite(baseBonus)) return 0;
  const base = Math.max(0, Math.floor(baseBonus));
  return base * (base < TIME_BONUS_TRIPLE_BELOW ? 3 : 2);
}

// ---- 2D canvas visuals ----
/** Gap at which the proximity treatment reaches its full 2D strength. */
export const PROX2D_FULL_PX = 40;
export const PROX2D_MAX_TILT_DEG = 0.2;
export const PROX2D_MAX_TINT_OPACITY = 0.55;
export const LOW_TIME_MAX_TINT_OPACITY = 0.2;
export const LOW_TIME_MAX_ZOOM = 0.008;
/** Low-time zoom pulse rate (rad/s): one slow breath roughly every 5 s. */
export const LOW_TIME_PULSE_RAD_S = 1.25;
export const CHECKPOINT_GLOW_MIN = 0.2;
export const CHECKPOINT_GLOW_MAX = 0.72;
export const SIGMA_BOB_PRIMARY_HZ = 5.5;
export const SIGMA_BOB_SECONDARY_HZ = 2.3;
export const LAMBDA_BLINK_S = 3.1;

// ---- 2D map ----
export const MAP_OBSTACLE_STUMBLE_S = 0.35;
export const MAP_PIT_STUMBLE_S = 0.8;
export const MAP_OBSTACLE_KNOCKBACK_PX = 42;
export const MAP_STEAM_PERIOD_S = 2.1;
export const MAP_CONVEYOR_SPEED = 75;
export const MAP_SPIKE_HEIGHT = 42;
export const MAP_TRAPDOOR_EARLY_WIDTH = 90;
export const MAP_SHUTTER_WIDTH = 40;
export const MAP_RAISED_PLATFORM_HEIGHT = 70;
export const MAP_SHUTTER_MAX_HEIGHT = 34;
export const MAP_SHUTTER_RAD_S = 1.5;
export const MAP_HAZARD_TRIGGER = 0.45;
export const MAP_PLATFORM_LANDING_TOLERANCE = 3;
