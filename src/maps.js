function wall(x, y, w, h) {
  return { type: "wall", x, y, w, h, solid: true };
}

function door(spec) {
  return { type: "door", solid: !spec.open, ...spec };
}

export function createMap(scene, flags) {
  if (scene === "apartment") return apartment(flags);
  if (scene === "street") return street(flags);
  if (scene === "plant") return plant(flags);
  return assistant(flags);
}

function apartment(flags) {
  const open = Boolean(flags.briefed && flags.drilled);
  return {
    id: "apartment",
    w: 640,
    h: 420,
    spawn: { x: 200, y: 250 },
    props: [
      wall(0, 0, 640, 22),
      wall(0, 398, 640, 22),
      wall(0, 0, 22, 420),
      wall(618, 0, 22, 160),
      wall(618, 270, 22, 150),
      { type: "bed", x: 48, y: 64, w: 92, h: 128, solid: true },
      { type: "table", x: 286, y: 138, w: 108, h: 52, solid: true },
      { type: "window", x: 250, y: 22, w: 96, h: 14, solid: false },
      ...(flags.hasHeadset
        ? []
        : [{ type: "headset", x: 322, y: 214, w: 40, h: 26, solid: false }]),
      ...(flags.drilled ? [] : [{ type: "plate", x: 470, y: 248, w: 40, h: 56, solid: false }]),
      door({
        x: 596,
        y: 168,
        w: 44,
        h: 96,
        open,
        to: "street",
        label: open ? "Stairwell" : "Not yet",
        matchLabel: open ? "Queue" : "Locked",
      }),
    ],
  };
}

function street(flags) {
  const open = flags.plantOpen || flags.wendi === "spared" || flags.wendi === "killed";
  return {
    id: "street",
    w: 1400,
    h: 900,
    spawn: { x: 200, y: 430 },
    props: [
      wall(0, 0, 1400, 28),
      wall(0, 872, 1400, 28),
      wall(0, 0, 28, 900),
      wall(1372, 0, 28, 900),
      wall(36, 300, 108, 240),
      wall(360, 0, 200, 120),
      wall(680, 0, 280, 120),
      { type: "car", x: 390, y: 270, w: 180, h: 84, solid: true },
      { type: "car", x: 390, y: 540, w: 180, h: 84, solid: true },
      { type: "car", x: 980, y: 640, w: 170, h: 78, solid: true },
      ...(!flags.flag || flags.flag === "down"
        ? [{ type: "relay", x: 1164, y: 392, w: 58, h: 58, solid: false }]
        : []),
      { type: "plaque", x: 150, y: 620, w: 70, h: 24, solid: false, text: "4A" },
      { type: "plaque", x: 860, y: 250, w: 70, h: 24, solid: false, text: "4B" },
      door({
        x: 560,
        y: 28,
        w: 120,
        h: 92,
        open,
        to: "plant",
        label: open ? "Wastewater" : "Plant shut",
        matchLabel: open ? "Extraction" : "Locked",
      }),
    ],
  };
}

function plant(flags) {
  return {
    id: "plant",
    w: 760,
    h: 500,
    spawn: { x: 130, y: 250 },
    props: [
      wall(0, 0, 760, 24),
      wall(0, 476, 760, 24),
      wall(0, 0, 24, 190),
      wall(0, 310, 24, 190),
      wall(736, 0, 24, 190),
      wall(736, 310, 24, 190),
      { type: "tank", x: 70, y: 48, w: 170, h: 120, solid: false },
      { type: "console", x: 300, y: 200, w: 150, h: 70, solid: false },
      { type: "drop", x: 80, y: 360, w: 52, h: 72, solid: false, filled: flags.flag === "dropped" },
      door({
        x: 0,
        y: 198,
        w: 36,
        h: 104,
        open: true,
        to: "street",
        label: "Block",
        matchLabel: "Block",
      }),
      door({
        x: 724,
        y: 198,
        w: 36,
        h: 104,
        open: flags.hasFlask,
        to: "assistant",
        label: flags.hasFlask ? "Assistant" : "Coolant",
        matchLabel: flags.hasFlask ? "Boss" : "Locked",
      }),
    ],
  };
}

function assistant() {
  return {
    id: "assistant",
    w: 980,
    h: 680,
    spawn: { x: 230, y: 400 },
    props: [
      wall(0, 0, 980, 28),
      wall(0, 652, 980, 28),
      wall(0, 0, 28, 680),
      wall(952, 0, 28, 680),
      { type: "path", x: 370, y: 150, w: 170, h: 430, solid: false },
      { type: "boss", x: 405, y: 200, w: 100, h: 100, solid: false },
      { type: "inlet", x: 790, y: 300, w: 72, h: 72, solid: false },
      { type: "plaque", x: 760, y: 392, w: 140, h: 24, solid: false, text: "COOLANT" },
    ],
  };
}

export const ARRIVALS = {
  "street:plant": { x: 620, y: 190 },
  "plant:assistant": { x: 640, y: 250 },
  "plant:street": { x: 130, y: 250 },
  "assistant:plant": { x: 230, y: 400 },
};
