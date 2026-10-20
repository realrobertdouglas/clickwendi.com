import { sfx } from "./audio.js";
import { screenToWorld } from "./render.js";
import { ARRIVALS, createMap } from "./maps.js";
import { afterKill, afterShot, clamp, shouldAdvanceCheckpoint, stepGauge, SHOT_COST } from "./rules.js";
import { clearCheckpoint, emptyCheckpoint, loadCheckpoint, writeCheckpoint } from "./save.js";

const PLAYER_SPEED = 176;
const WENDI_SPEED = 112;
const PLAYER_R = 12;
const HIT_R = 14;

const SCENE_NAME = {
  apartment: "4A",
  street: "The block",
  plant: "Wastewater",
  assistant: "The Assistant",
};

export function createGame() {
  let checkpoint = loadCheckpoint();
  let savedAtBoot = Boolean(checkpoint);
  let mode = "title";
  let scene = "street";
  let layer = "match";
  let signal = 100;
  let hp = 4;
  let hasHeadset = false;
  let hasFlask = false;
  let wendi = "pending";
  let plantOpen = false;
  let flag = "down";
  let briefed = false;
  let drilled = false;
  let graduated = false;
  let player = { x: 200, y: 430, facing: 0, hurt: 0, shotCd: 0 };
  let neighbor = null;
  let map = createMap("street", flags());
  let beams = [];
  let bolts = [];
  let motes = [];
  let boltTimer = 0.4;
  let doorGrace = 0;
  let interactGrace = 0;
  let caption = "";
  let captionSpeaker = "";
  let captionT = 0;
  let story = [];
  let modeBefore = "play";
  let bossSpoken = false;
  let toast = "";
  let toastT = 0;
  let hint = "";
  let objective = "";
  let menu = titleMenu();
  let gauge = null;
  let shake = 0;
  let ventT = 0;
  let ending = null;
  let streetHinted = false;
  let streetTime = 0;
  let saveStuck = false;
  let titleActor = { x: 1040, y: 430, dir: 1 };
  let look = null;
  let bossHp = 1000;
  let pops = [];

  function flags() {
    return { hasHeadset, hasFlask, plantOpen, wendi, briefed, drilled, flag };
  }

  function titleMenu() {
    const actions = [{ id: "start", label: "Begin" }];
    if (savedAtBoot && checkpoint) {
      actions.push({
        id: "resume",
        label: `Resume \u2014 ${SCENE_NAME[checkpoint.scene] ?? "checkpoint"}`,
      });
    }
    return {
      kind: "title",
      eyebrow: "2032 \u00b7 a clear signal demo",
      title: "Click Wendi",
      body: "The ward has queued your block into a match. The headset on your desk will name an objective. Tonight it is Wendi, in 4B. She thinks she is playing capture the flag.",
      actions,
    };
  }
}
