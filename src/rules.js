export const SHOT_COST = 30;
export const KILL_COST = 10;
export const BAND = { min: 36, max: 64 };

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function clampSignal(n) {
  return clamp(Math.round(n), 0, 100);
}

export function afterShot(signal) {
  return clampSignal(signal - SHOT_COST);
}

export function afterKill(signal) {
  return clampSignal(signal - KILL_COST);
}

export function sceneRank(checkpoint) {
  const base = { apartment: 0, street: 1, plant: 2, assistant: 3 };
  let rank = base[checkpoint.scene] ?? 0;
  if (checkpoint.scene === "plant" && checkpoint.hasFlask) rank = 2.5;
  return rank;
}

export function shouldAdvanceCheckpoint(prev, next) {
  if (!prev) return true;
  return sceneRank(next) > sceneRank(prev);
}

export function stepGauge(gauge, holding, dt, surge = 0) {
  const pressure = clamp(gauge.pressure + (holding ? -46 : 20) * dt + surge, 0, 100);
  const inBand = pressure >= BAND.min && pressure <= BAND.max;
  const burst = pressure <= 0 || pressure >= 100;
  let treated = gauge.treated;
  let spill = gauge.spill;
  if (inBand) {
    treated = Math.min(100, treated + 16 * dt);
    spill = Math.max(0, spill - 6 * dt);
  } else {
    spill = Math.min(100, spill + 20 * dt);
  }
  if (burst) spill = Math.min(100, spill + 30 * dt);
  let result = "play";
  if (treated >= 100) result = "win";
  else if (spill >= 100) result = "fail";
  return { pressure, treated, spill, result, inBand };
}
