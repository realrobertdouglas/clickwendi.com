import { sfx } from "./audio.js";
import { createGame } from "./game.js";
import { paint } from "./render.js";
import { paint as paintUi } from "./ui.js";

const canvas = document.querySelector("#view");
const ctx = canvas.getContext("2d");
const game = createGame();
const keys = new Set();
const edges = { layer: false, use: false, shoot: false, story: false, action: null, aim: null };
const held = { valve: false };
const stickVec = { x: 0, y: 0 };
let stickId = null;
let stickOrigin = null;

const stick = document.querySelector("#stick");
const nub = document.querySelector("#nub");

window.addEventListener("keydown", (event) => {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
  if (event.repeat) return;
  keys.add(event.code);
  if (event.code === "KeyQ") edges.layer = true;
  if (event.code === "KeyE") edges.use = true;
  if (event.code === "KeyF") edges.shoot = true;
  if (event.code === "KeyC") edges.story = true;
  sfx.unlock();
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") return;
  const rect = canvas.getBoundingClientRect();
  edges.shoot = true;
  edges.aim = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  sfx.unlock();
});

document.querySelector("#story").addEventListener("click", (event) => {
  event.preventDefault();
  edges.story = true;
  sfx.unlock();
});

document.querySelector("#menu").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  edges.action = button.dataset.act;
  sfx.unlock();
});

document.querySelector("#actions").addEventListener("pointerdown", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  event.preventDefault();
  if (button.dataset.hold) held[button.dataset.hold] = true;
  if (button.dataset.act) edges[button.dataset.act] = true;
  sfx.unlock();
});

window.addEventListener("pointerup", () => {
  held.valve = false;
});
window.addEventListener("pointercancel", () => {
  held.valve = false;
});

stick.addEventListener("pointerdown", (event) => {
  stick.setPointerCapture(event.pointerId);
  stickId = event.pointerId;
  stickOrigin = { x: event.clientX, y: event.clientY };
  sfx.unlock();
});

stick.addEventListener("pointermove", (event) => {
  if (event.pointerId !== stickId || !stickOrigin) return;
  const dx = event.clientX - stickOrigin.x;
  const dy = event.clientY - stickOrigin.y;
  const mag = Math.hypot(dx, dy) || 1;
  const max = 44;
  const scale = Math.min(max, mag);
  stickVec.x = (dx / mag) * (scale / max);
  stickVec.y = (dy / mag) * (scale / max);
  nub.style.transform = `translate(${(dx / mag) * scale}px, ${(dy / mag) * scale}px)`;
});

function endStick(event) {
  if (event.pointerId !== stickId) return;
  stickId = null;
  stickOrigin = null;
  stickVec.x = 0;
  stickVec.y = 0;
  nub.style.transform = "translate(0px, 0px)";
}

stick.addEventListener("pointerup", endStick);
stick.addEventListener("pointercancel", endStick);

function readInput() {
  const ax =
    (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
    (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) +
    stickVec.x;
  const ay =
    (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
    (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) +
    stickVec.y;
  const view = canvas.getBoundingClientRect();
  const packet = {
    ax,
    ay,
    layer: edges.layer,
    use: edges.use,
    shoot: edges.shoot,
    story: edges.story,
    aim: edges.aim,
    viewW: view.width,
    viewH: view.height,
    valve: held.valve || keys.has("Space"),
    action: edges.action,
  };
  edges.layer = false;
  edges.use = false;
  edges.shoot = false;
  edges.story = false;
  edges.action = null;
  edges.aim = null;
  return packet;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  canvas.dataset.w = String(rect.width);
  canvas.dataset.h = String(rect.height);
}

window.addEventListener("resize", resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  const rect = canvas.getBoundingClientRect();
  const view = game.frame(dt, readInput());
  paintUi(view);
  paint(ctx, view, rect.width, rect.height);
  requestAnimationFrame(frame);
}

window.__game = game;
requestAnimationFrame(frame);
