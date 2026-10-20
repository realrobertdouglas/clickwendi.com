const KEY = "clickwendi-save-v1";

export function emptyCheckpoint() {
  return {
    scene: "apartment",
    signal: 100,
    hasHeadset: false,
    hasFlask: false,
    wendi: "pending",
    briefed: false,
    drilled: false,
    flag: "down",
  };
}

export function loadCheckpoint() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || !data.checkpoint) return null;
    const checkpoint = { ...emptyCheckpoint(), ...data.checkpoint };
    if (!data.checkpoint.flag) {
      checkpoint.flag = checkpoint.wendi === "pending" ? "down" : "dropped";
    }
    return checkpoint;
  } catch {
    return null;
  }
}

export function writeCheckpoint(checkpoint) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, checkpoint }));
    return true;
  } catch {
    return false;
  }
}

export function clearCheckpoint() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}
