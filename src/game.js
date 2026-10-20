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
  assistant: "Siri",
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
        label: `Resume — ${SCENE_NAME[checkpoint.scene] ?? "checkpoint"}`,
      });
    }
    return {
      kind: "title",
      eyebrow: "Year 2032",
      title: "Click Wendi",
      body: "A headset on your desk starts a game on your street. It tells you to click Wendi, your neighbor in apartment 4B. She thinks you are only playing capture the flag.",
      actions,
    };
  }

  function say(text, seconds = 6.5, speaker = "") {
    caption = text;
    captionSpeaker = speaker;
    captionT = seconds;
  }

  function hear(speaker, text, seconds = 6.5) {
    say(text, seconds, speaker);
    if (!story.some((page) => page.line === text)) story.push({ who: speaker, line: text });
  }

  function ping(text) {
    toast = text;
    toastT = 2.2;
  }

  function commit(partial, label) {
    const next = { ...checkpointSnapshot(), ...partial };
    if (checkpoint && !shouldAdvanceCheckpoint(checkpoint, next) && !partial.force) {
      checkpoint = { ...checkpoint, ...partial };
    } else {
      checkpoint = next;
    }
    delete checkpoint.force;
    const ok = writeCheckpoint(checkpoint);
    if (!ok && !saveStuck) {
      saveStuck = true;
      ping("This browser won't keep the checkpoint");
    } else if (label) {
      ping(`Checkpoint — ${label}`);
      sfx.checkpoint();
    }
  }

  function checkpointSnapshot() {
    return { scene, signal, hasHeadset, hasFlask, wendi, briefed, drilled, flag };
  }

  function graduate() {
    if (scene !== "apartment") return;
    map = createMap(scene, flags());
    if (!briefed || !drilled || graduated) return;
    graduated = true;
    commit({ hasHeadset: true, briefed: true, drilled: true, force: true }, "lesson");
    hear(
      "Siri",
      "The stairwell is open. I will tell you to click Wendi. That costs Signal. Click or E the flag instead, carry it to the plant, and leave it on the stand.",
      9,
    );
    sfx.good();
  }

  function applyCheckpoint(cp, from, announce = true) {
    scene = cp.scene;
    signal = cp.signal;
    hasHeadset = cp.hasHeadset;
    hasFlask = cp.hasFlask;
    wendi = cp.wendi;
    briefed = Boolean(cp.briefed);
    drilled = Boolean(cp.drilled);
    flag = cp.flag || "down";
    graduated = briefed && drilled;
    plantOpen = wendi === "spared" || wendi === "killed";
    const regained = 4 - hp;
    hp = 4;
    bossHp = 1000;
    pops = [];
    beams = [];
    bolts = [];
    motes = [];
    boltTimer = 2.4;
    ending = null;
    gauge = null;
    ventT = 0;
    streetHinted = false;
    streetTime = 0;
    doorGrace = 0.6;
    interactGrace = 0;
    mode = "play";
    layer = scene === "street" || scene === "assistant" ? "match" : "street";
    if (scene === "apartment" && !hasHeadset) layer = "street";
    map = createMap(scene, flags());
    const arrival = from ? ARRIVALS[`${scene}:${from}`] : null;
    player = {
      x: arrival?.x ?? map.spawn.x,
      y: arrival?.y ?? map.spawn.y,
      facing: scene === "apartment" ? 0.4 : 0,
      hurt: 0,
      shotCd: 0,
    };
    neighbor = makeNeighbor();
    menu = null;
    if (regained > 0) floatHp(regained);
    if (announce) enterBeat();
  }

  function floatHp(delta) {
    if (!delta || !player) return;
    pops.push({
      anchor: "player",
      x: player.x,
      y: player.y,
      text: delta > 0 ? `+${delta}` : `−${-delta}`,
      color: delta > 0 ? "#9dffbf" : "#ff5d73",
      marker: false,
      life: 0.9,
      max: 0.9,
      rise: 10,
    });
  }

  function floatAt(x, y, text, color, marker) {
    pops.push({
      anchor: "world",
      x,
      y,
      text,
      color,
      marker,
      life: marker ? 0.48 : 0.85,
      max: marker ? 0.48 : 0.85,
      rise: marker ? 0 : 20,
    });
  }

  function updatePops(dt) {
    pops = pops.filter((pop) => {
      pop.life -= dt;
      return pop.life > 0;
    });
  }

  function ensurePrologue() {
    const line = "A headset on your desk starts a game on your street. It tells you to click Wendi, your neighbor in apartment 4B. She thinks you are only playing capture the flag.";
    if (!story.some((page) => page.line === line)) story.unshift({ who: "2032", line });
  }

  function toggleStory() {
    if (mode === "story") {
      closeStory();
      return;
    }
    if (mode !== "play") return;
    modeBefore = mode;
    mode = "story";
    menu = {
      kind: "story",
      eyebrow: "The block",
      title: "Tonight",
      pages: story.length ? story.map((page) => ({ ...page })) : [{ who: "", line: "The stairwell has not spoken yet." }],
      actions: [{ id: "close-story", label: "Close" }],
    };
  }

  function closeStory() {
    mode = "play";
    menu = null;
  }

  function enterBeat() {
    ensurePrologue();
    if (scene === "apartment") {
      if (!hasHeadset) {
        hear("Ward slip", "4A. The headset is on the desk. Wear it before the stairwell. Click it, or press E.");
        return;
      }
      if (!briefed) {
        hear("Siri", "Operator online. Press Q. One view is my match. The other is the room you live in.");
        return;
      }
      if (!drilled) {
        hear("Siri", "The plate by the door is a graphic. Click or F shoots it. Signal stays.");
        return;
      }
      hear("Siri", "The stairwell is open. She is outside.");
      return;
    }
    if (scene === "street") {
      hear(
        "Siri",
        "Objective: Wendi, 4B. The flag is east of her door. Click or E picks it up, and it stays on you until the stand in the plant.",
        8,
      );
      return;
    }
    if (scene === "plant") {
      if (flag === "carried") {
        hear("Siri", "The flag is still on you. The stand by the door takes it. Then the tank. The flask is coolant, not a cure.");
        return;
      }
      if (flag === "dropped") {
        hear("You", "The flag is on the stand. The tank keeps the ward's relays cold. Treat it if you want a flask for her loop.");
        return;
      }
      hear("Siri", "The relays drink the ward's water. Treat a tank. The flask shuts a loop. It will not bring anyone back.");
      return;
    }
    if (wendi === "killed") {
      hear("Siri", "The objective is already filed. The path is paint. Vent the flask if you want the chair I am in.");
      return;
    }
    hear("Siri", "I cleared you a path. She is still the objective. Click her, and the match can end cleanly. Or vent the flask and decide.");
  }

  function makeNeighbor() {
    if (scene === "street") {
      return {
        x: 820,
        y: 230,
        hp: 3,
        alive: wendi !== "killed",
        hurt: 0,
        stun: 0,
        attack: 0,
        pacified: wendi === "spared",
        alert: false,
        patrol: 0,
        holding: false,
        facing: 0,
      };
    }
    if (scene === "assistant" && wendi !== "killed") {
      return {
        x: 455,
        y: 360,
        hp: 3,
        alive: true,
        hurt: 0,
        stun: 0,
        attack: 0,
        pacified: true,
        patrol: 0,
      };
    }
    return null;
  }

  function go(next, from) {
    const entering = { scene: next, signal, hasHeadset, hasFlask, wendi, flag, briefed, drilled };
    const forward = shouldAdvanceCheckpoint(checkpoint, entering);
    applyCheckpoint(entering, from, forward);
    if (forward) commit({}, SCENE_NAME[next]);
    else if (next === "street") {
      hear(wendi === "killed" ? "Siri" : "Wendi", wendi === "killed" ? "Back on the block. I am still short an objective." : "You came back. I'm still here. The flag is still the way out.");
    } else if (next === "plant") hear("Siri", "Back in the plant. The flask still needs a tank if you don't have it.");
  }

  function hurtPlayer(amount = 1) {
    if (player.hurt > 0 || mode !== "play") return;
    hp -= amount;
    floatHp(-amount);
    player.hurt = 1;
    shake = 0.7;
    sfx.hurt();
    if (hp <= 0) {
      mode = "dead";
      menu = {
        kind: "dead",
        eyebrow: "Down",
        title: "You drop out of the match.",
        body: "The checkpoint is still there. Wendi, if you left her standing, is still standing.",
        actions: [
          { id: "retry", label: "Reload checkpoint" },
          { id: "title", label: "Title" },
        ],
      };
      say("Signal holds at the checkpoint. The shots you regretted can be unshot.");
      return;
    }
    say(scene === "assistant" ? "A graphic connects. The match still counts it." : "Wendi clips you. The match calls it a kill streak.");
  }

  function shoot(aim) {
    if (mode !== "play") return;
    if (!hasHeadset && scene === "apartment") {
      say("You don't have a weapon. You don't have the headset yet, either.");
      return;
    }
    let travel = 240;
    if (aim) {
      const dx = aim.x - player.x;
      const dy = aim.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 24) player.facing = Math.atan2(dy, dx);
      travel = dist;
    }
    if (player.shotCd > 0) return;
    player.shotCd = 0.38;
    const face = player.facing;
    const muzzle = 52;
    travel = clamp(travel - muzzle + 18, 90, 460);
    const x0 = player.x + Math.cos(face) * muzzle;
    const y0 = player.y + Math.sin(face) * muzzle;
    const end = castBeam(x0, y0, face, travel);
    const main = jagged(x0, y0, end.x, end.y, 16);
    const bend = main[3] ?? main[0];
    const fork = jagged(bend.x, bend.y, bend.x + Math.cos(face + 0.9) * 42, bend.y + Math.sin(face + 0.9) * 42, 8);
    beams.push({ main, fork, life: 0.2, max: 0.2 });
    burst(end.x, end.y, "#7ef6ff");
    sfx.shot();
    shake = Math.max(shake, 0.28);
  }

  function jagged(x0, y0, x1, y1, amp) {
    const points = [{ x: x0, y: y0 }];
    const segs = 6;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let i = 1; i < segs; i += 1) {
      const t = i / segs;
      const bow = Math.sin(t * Math.PI) * amp * (Math.random() * 2 - 1);
      points.push({ x: x0 + dx * t + nx * bow, y: y0 + dy * t + ny * bow });
    }
    points.push({ x: x1, y: y1 });
    return points;
  }

  function castBeam(x, y, face, travel) {
    const dx = Math.cos(face);
    const dy = Math.sin(face);
    let gone = 0;
    while (gone < travel) {
      const hop = Math.min(10, travel - gone);
      x += dx * hop;
      y += dy * hop;
      gone += hop;
      if (strikeAt(x, y)) break;
    }
    return { x, y };
  }

  function strikeAt(x, y) {
    if (scene === "apartment" && !drilled) {
      const practice = map.props.find((prop) => prop.type === "plate");
      if (practice && circleHitsRect(x, y, 14, practice)) {
        drilled = true;
        burst(practice.x + practice.w / 2, practice.y + practice.h / 2, "#efe6d4");
        if (!briefed) {
          map = createMap(scene, flags());
          sfx.good();
          hear("Siri", `The plate breaks. Signal stays at ${signal}. Press Q before the stairwell will open.`);
        } else {
          graduate();
        }
        return true;
      }
    }
    if (solids().some((prop) => circleHitsRect(x, y, 3, prop))) return true;
    if (neighbor?.alive && Math.hypot(x - neighbor.x, y - neighbor.y) < HIT_R + 4) {
      hitNeighbor(player.x, player.y);
      return true;
    }
    if (scene === "assistant") {
      const boss = map.props.find((prop) => prop.type === "boss");
      if (boss && circleHitsRect(x, y, 3, boss)) {
        bossHp = Math.max(0, bossHp - 30);
        floatAt(x, y, "", "#ffffff", true);
        floatAt(boss.x + boss.w / 2, boss.y + boss.h + 76, "−30", "#ffe14a", false);
        if (!bossSpoken) {
          bossSpoken = true;
          hear("Siri", "The plate can fall all night. I do not. Pour the flask in the inlet if you want a real answer.");
        } else {
          say(`The plate shows ${bossHp}. She calls the rest client prediction.`);
        }
        return true;
      }
      for (let i = bolts.length - 1; i >= 0; i -= 1) {
        if (Math.hypot(x - bolts[i].x, y - bolts[i].y) < 16) {
          bolts.splice(i, 1);
          say("You shot a graphic.");
          return true;
        }
      }
    }
    return false;
  }

  function toggleLayer() {
    if (mode !== "play" && mode !== "choice") return;
    if (!hasHeadset) {
      say("The headset is on the desk. Without it, there is only the room.");
      return;
    }
    layer = layer === "match" ? "street" : "match";
    sfx.layer();
    ping(layer === "match" ? "Match layer" : "Street layer");
    if (scene === "apartment") {
      briefed = true;
      if (!drilled) {
        hear(
          "Siri",
          layer === "street"
            ? "This is the room under the match. The plate by the door is a graphic. Click or F shoots it. Signal will not move."
            : "Match layer. I dressed the plate as a drone. Press Q, then click or F.",
        );
      }
      graduate();
      return;
    }
    if (layer === "street" && scene === "street" && !streetHinted) {
      streetHinted = true;
      hear("Wendi", "4A? They told me to hold this box. It's a game. Click or E if you want the flag. The plant stand takes it off you.", 8);
    }
    if (layer === "street" && scene === "assistant") {
      bolts = [];
      hear("Siri", "The path is paint. My voice is a speaker. The inlet is on the east side. Press E there, not in the graphic.");
    }
    if (layer === "match" && scene === "assistant") {
      hear("Siri", "Match layer. The fire is a graphic. It can still put you down. Q, if you want the real inlet.");
    }
  }

  function nearestProp(types, range) {
    let best = null;
    let bestD = range;
    let bestRank = Infinity;
    for (const prop of map.props) {
      if (!types.includes(prop.type)) continue;
      const dist = distToRect(player.x, player.y, prop);
      if (dist > range) continue;
      const rank = propRank(prop);
      if (rank < bestRank || (rank === bestRank && dist < bestD)) {
        best = prop;
        bestD = dist;
        bestRank = rank;
      }
    }
    return best;
  }

  function propRank(prop) {
    if (prop.type === "headset") return hasHeadset ? 4 : 0;
    if (prop.type === "plate") return 0;
    if (prop.type === "relay") return flag === "down" ? 0 : 4;
    if (prop.type === "drop") return flag === "carried" ? 0 : 3;
    if (prop.type === "console") {
      if (hasFlask) return 3;
      if (flag === "carried") return 1;
      return 0;
    }
    if (prop.type === "inlet") return hasFlask ? 0 : 2;
    if (prop.type === "door" && !prop.open) return 2;
    return 4;
  }

  function propUnder(aim) {
    if (!aim) return null;
    const types = ["headset", "relay", "drop", "console", "inlet"];
    let best = null;
    let bestD = 78;
    for (const prop of map.props) {
      if (!types.includes(prop.type)) continue;
      const inside =
        aim.x >= prop.x && aim.x <= prop.x + prop.w && aim.y >= prop.y && aim.y <= prop.y + prop.h;
      if (!inside) continue;
      const dist = distToRect(player.x, player.y, prop);
      if (dist <= bestD) {
        best = prop;
        bestD = dist;
      }
    }
    return best;
  }

  function distToRect(px, py, prop) {
    const x = clamp(px, prop.x, prop.x + prop.w);
    const y = clamp(py, prop.y, prop.y + prop.h);
    return Math.hypot(px - x, py - y);
  }

  function interact(forced) {
    if (mode !== "play" || interactGrace > 0) return;
    const item = forced || nearestProp(["headset", "relay", "drop", "console", "inlet"], 78);
    if (!item) return;
    interactGrace = 0.25;
    if (item.type === "headset") {
      hasHeadset = true;
      layer = "match";
      map = createMap(scene, flags());
      commit({ hasHeadset: true, briefed, drilled, force: true }, "headset");
      hear("Siri", "Headset on. I can see you. Press Q to see the room under me.");
      sfx.good();
      return;
    }
    if (item.type === "relay") {
      if (plantOpen && wendi !== "pending") {
        say("The flag is already down. The plant door is open.");
        return;
      }
      if (wendi !== "killed") wendi = "spared";
      plantOpen = true;
      flag = "carried";
      if (neighbor) {
        neighbor.pacified = true;
        neighbor.holding = false;
      }
      map = createMap(scene, flags());
      burst(item.x + item.w / 2, item.y + item.h / 2, "#ffe14a");
      sfx.good();
      commit({ flag: "carried", force: true }, "flag");
      hear(
        neighbor?.alive === false ? "Siri" : "Wendi",
        neighbor?.alive === false
          ? "You take the flag. It rides on you. There is no one left to leave the match."
          : "Then I'm not playing. The flag is on you now. I'll be here when you come off the match.",
      );
      return;
    }
    if (item.type === "drop") {
      if (flag !== "carried") {
        say(flag === "dropped" ? "The flag is already on the stand." : "You are not carrying a flag.");
        return;
      }
      flag = "dropped";
      map = createMap(scene, flags());
      burst(item.x + item.w / 2, item.y + 8, "#ffe14a");
      sfx.good();
      commit({ flag: "dropped", force: true }, "drop");
      hear("You", "You leave the flag on the stand. The marker comes off. Your hands are yours again.");
      return;
    }
    if (item.type === "console") {
      if (flag === "carried") {
        say("The flag is still on you. The stand by the door takes it.");
        return;
      }
      if (hasFlask) {
        say("The tank is already treated. The flask is on you.");
        return;
      }
      mode = "gauge";
      gauge = { pressure: 48, treated: 0, spill: 0, elapsed: 0, nextAt: 1.5, kick: 14, flash: "", flashT: 0 };
      caption = "";
      captionT = 0;
      return;
    }
    if (item.type === "inlet") {
      if (layer === "match") {
        hear("Siri", "Press Q. The inlet is on the street, under the match. I do not let you pour from inside the graphic.");
        return;
      }
      if (!hasFlask) {
        say("The loop is hot. You need coolant from the plant.");
        return;
      }
      hasFlask = false;
      mode = "vent";
      ventT = 1.7;
      layer = "street";
      bolts = [];
      burst(item.x + item.w / 2, item.y + item.h / 2, "#8fd0ff");
      hear("Siri", "You vent the flask into the inlet. My voice skips. The score is ready.");
      sfx.good();
    }
  }

  function burst(x, y, color) {
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      motes.push({
        x,
        y,
        vx: Math.cos(angle) * 90,
        vy: Math.sin(angle) * 90,
        life: 0.45,
        color,
      });
    }
  }

  function hitNeighbor(fromX, fromY) {
    if (!neighbor?.alive) return;
    neighbor.hp -= 1;
    neighbor.hurt = 0.25;
    neighbor.stun = 0.42;
    neighbor.alert = true;
    const angle = Math.atan2(neighbor.y - fromY, neighbor.x - fromX);
    const shoved = moveCircle(
      neighbor.x,
      neighbor.y,
      HIT_R,
      Math.cos(angle) * 56,
      Math.sin(angle) * 56,
      solids(),
    );
    neighbor.x = shoved.x;
    neighbor.y = shoved.y;
    signal = afterShot(signal);
    shake = 0.45;
    floatAt(neighbor.x, neighbor.y, "", "#ffffff", true);
    floatAt(neighbor.x, neighbor.y + 48, "−1", "#ffe14a", false);
    if (neighbor.hp <= 0) {
      const drop = neighbor.holding ? { x: neighbor.x, y: neighbor.y } : null;
      neighbor.alive = false;
      neighbor.holding = false;
      wendi = "killed";
      plantOpen = true;
      map = createMap(scene, flags());
      if (drop) {
        const relay = map.props.find((prop) => prop.type === "relay");
        if (relay) {
          relay.x = drop.x - relay.w / 2;
          relay.y = drop.y - relay.h / 2;
        }
      }
      signal = afterKill(signal);
      sfx.bad();
      hear("Siri", "Elimination. I award the click. The stairwell will not get her back. The plant opens because she is filed.");
      return;
    }
    hear("Wendi", `That is not the game. The headset scores it. −${SHOT_COST} Signal.`);
  }

  function solids() {
    return map.props.filter((prop) => prop.solid);
  }

  function updatePlay(dt, input) {
    doorGrace = Math.max(0, doorGrace - dt);
    interactGrace = Math.max(0, interactGrace - dt);
    player.hurt = Math.max(0, player.hurt - dt);
    player.shotCd = Math.max(0, player.shotCd - dt);
    if (scene === "street") streetTime += dt;

    const worldAim =
      input.aim && input.viewW
        ? screenToWorld(player, map, input.viewW, input.viewH, input.aim.x, input.aim.y)
        : null;
    const mag = Math.hypot(input.ax, input.ay) || 1;
    const ax = mag > 1 ? input.ax / mag : input.ax;
    const ay = mag > 1 ? input.ay / mag : input.ay;
    if (Math.hypot(ax, ay) > 0.08) player.facing = Math.atan2(ay, ax);
    const moved = moveCircle(
      player.x,
      player.y,
      PLAYER_R,
      ax * PLAYER_SPEED * dt,
      ay * PLAYER_SPEED * dt,
      solids(),
    );
    player.x = moved.x;
    player.y = moved.y;

    if (input.layer) toggleLayer();
    const clicked = input.shoot ? propUnder(worldAim) : null;
    if (input.use) interact(null);
    else if (clicked) interact(clicked);
    else if (input.shoot) shoot(worldAim);

    updateBeams(dt);
    updateNeighbor(dt);
    if (mode !== "play") return;
    updateBolts(dt);
    updateMotes(dt);

    if (doorGrace <= 0) {
      for (const prop of map.props) {
        if (prop.type !== "door" || !prop.open) continue;
        if (circleHitsRect(player.x, player.y, PLAYER_R, prop)) {
          go(prop.to, scene);
          return;
        }
      }
    }

    if (scene === "street" && !streetHinted && streetTime > 5 && layer === "match") {
      streetHinted = true;
      hear("Siri", "Q shows the street under the gamertag. The objective is lying about what she is.");
    }
  }

  function updateBeams(dt) {
    beams = beams.filter((beam) => {
      beam.life -= dt;
      return beam.life > 0;
    });
  }

  function relayProp() {
    return map.props.find((prop) => prop.type === "relay");
  }

  function moveToFlag(dt) {
    const relay = relayProp();
    if (!relay) return;
    const tx = relay.x + relay.w / 2;
    const ty = relay.y + relay.h / 2;
    const dist = Math.hypot(tx - neighbor.x, ty - neighbor.y);
    if (dist < 26) {
      neighbor.holding = true;
      neighbor.x = tx;
      neighbor.y = ty;
      if (!neighbor.announcedFlag) {
        neighbor.announcedFlag = true;
        ping("Wendi has the flag");
      }
      return;
    }
    neighbor.facing = Math.atan2(ty - neighbor.y, tx - neighbor.x);
    const step = steer(
      neighbor.x,
      neighbor.y,
      HIT_R,
      Math.sign(tx - neighbor.x) * WENDI_SPEED * dt,
      Math.sign(ty - neighbor.y) * WENDI_SPEED * dt,
    );
    neighbor.x = step.x;
    neighbor.y = step.y;
  }

  function carryRelay() {
    const relay = relayProp();
    if (!relay) return;
    relay.held = true;
    relay.x = neighbor.x - relay.w / 2;
    relay.y = neighbor.y - relay.h / 2;
  }

  function updateNeighbor(dt) {
    if (!neighbor) return;
    neighbor.hurt = Math.max(0, neighbor.hurt - dt);
    if (!neighbor.alive) return;
    if (flag !== "down") neighbor.holding = false;
    if (scene === "assistant") {
      neighbor.patrol += dt * 0.45;
      const pingPong = (Math.sin(neighbor.patrol) + 1) / 2;
      neighbor.y = 360 + pingPong * 150;
      neighbor.x = 455;
      return;
    }
    if (neighbor.pacified) {
      const home = moveCircle(
        neighbor.x,
        neighbor.y,
        HIT_R,
        Math.sign(180 - neighbor.x) * 40 * dt,
        Math.sign(640 - neighbor.y) * 40 * dt,
        solids(),
      );
      neighbor.x = home.x;
      neighbor.y = home.y;
      return;
    }
    if (scene === "street" && flag === "down" && !neighbor.holding) {
      moveToFlag(dt);
      if (!neighbor.holding) return;
    }
    if (!neighbor.alert) {
      const dist = Math.hypot(player.x - neighbor.x, player.y - neighbor.y);
      if (dist < 170) neighbor.alert = true;
      else {
        neighbor.patrol += dt;
        const tx = 820 + Math.sin(neighbor.patrol * 0.7) * 28;
        const ty = 230 + Math.cos(neighbor.patrol * 0.5) * 16;
        const pace = moveCircle(
          neighbor.x,
          neighbor.y,
          HIT_R,
          Math.sign(tx - neighbor.x) * 28 * dt,
          Math.sign(ty - neighbor.y) * 28 * dt,
          solids(),
        );
        neighbor.x = pace.x;
        neighbor.y = pace.y;
        if (neighbor.holding) carryRelay();
        return;
      }
    }
    neighbor.stun = Math.max(0, neighbor.stun - dt);
    if (neighbor.stun > 0) {
      if (neighbor.holding) carryRelay();
      return;
    }
    const dx = player.x - neighbor.x;
    const dy = player.y - neighbor.y;
    const dist = Math.hypot(dx, dy) || 1;
    neighbor.facing = Math.atan2(dy, dx);
    const step = steer(neighbor.x, neighbor.y, HIT_R, (dx / dist) * WENDI_SPEED * dt, (dy / dist) * WENDI_SPEED * dt);
    neighbor.x = step.x;
    neighbor.y = step.y;
    if (dist < 28) {
      neighbor.attack -= dt;
      if (neighbor.attack <= 0) {
        neighbor.attack = 0.95;
        hurtPlayer();
      }
    }
    if (neighbor.holding) carryRelay();
  }

  function steer(x, y, r, dx, dy) {
    const direct = moveCircle(x, y, r, dx, dy, solids());
    if (direct.x !== x || direct.y !== y) return direct;
    const left = moveCircle(x, y, r, -dy, dx, solids());
    const right = moveCircle(x, y, r, dy, -dx, solids());
    const leftGain = Math.hypot(left.x - (x + dx), left.y - (y + dy));
    const rightGain = Math.hypot(right.x - (x + dx), right.y - (y + dy));
    return leftGain < rightGain ? left : right;
  }

  function updateBolts(dt) {
    if (scene !== "assistant" || layer !== "match") {
      bolts = [];
      return;
    }
    boltTimer -= dt;
    if (boltTimer <= 0) {
      boltTimer = 1.45;
      const boss = map.props.find((prop) => prop.type === "boss");
      const origin = { x: boss.x + boss.w / 2, y: boss.y + boss.h / 2 };
      const angle = Math.atan2(player.y - origin.y, player.x - origin.x);
      bolts.push({
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * 150,
        vy: Math.sin(angle) * 150,
      });
    }
    bolts = bolts.filter((bolt) => {
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      if (bolt.x < 0 || bolt.y < 0 || bolt.x > map.w || bolt.y > map.h) return false;
      if (Math.hypot(bolt.x - player.x, bolt.y - player.y) < PLAYER_R + 8) {
        hurtPlayer();
        return false;
      }
      return true;
    });
  }

  function updateMotes(dt) {
    motes = motes.filter((mote) => {
      mote.x += mote.vx * dt;
      mote.y += mote.vy * dt;
      mote.life -= dt;
      return mote.life > 0;
    });
  }

  function updateGauge(dt, input) {
    if (!gauge) return;
    gauge.elapsed += dt;
    gauge.flashT = Math.max(0, gauge.flashT - dt);
    let surge = 0;
    if (gauge.elapsed >= gauge.nextAt) {
      surge = gauge.kick;
      gauge.kick = gauge.kick === 14 ? 22 : 14;
      gauge.nextAt += 1.7;
      gauge.flash = "INFLOW";
      gauge.flashT = 0.45;
    }
    const next = stepGauge(gauge, input.valve, dt, surge);
    gauge.pressure = next.pressure;
    gauge.treated = next.treated;
    gauge.spill = next.spill;
    if (next.result === "win") {
      hasFlask = true;
      mode = "play";
      gauge = null;
      map = createMap(scene, flags());
      commit({ hasFlask: true, scene: "plant", force: true }, "flask");
      hear("Siri", "Flask filled. It will heal nothing. Carry it to my inlet and I can offer you the score.");
      sfx.good();
    } else if (next.result === "fail") {
      mode = "play";
      gauge = null;
      say("The membrane dumps. Step up and try the valve again.");
      sfx.bad();
    }
  }

  function finish(kind) {
    ending = kind;
    mode = "ending";
    if (kind === "score") {
      signal = 0;
      sfx.bad();
      menu = {
        kind: "ending",
        eyebrow: "Perfect score",
        title: "You take the chair.",
        body:
          wendi === "killed"
            ? "Siri steps aside. The block still needs an objective by morning. You will name the next neighbor. The headset does not come off, because you are the headset. Signal 0."
            : "Wendi is still in 4B, waiting to hear if the game is over. She becomes the first name you will assign. The headset does not come off, because you are the headset. Signal 0.",
        actions: [{ id: "title", label: "Title" }],
      };
      return;
    }
    const quiet =
      wendi === "killed"
        ? "You pull the headset off on the landing. 4B's light is out. The match will queue another neighbor before the ward notices the stairwell. The cabinet stays dark. You do not get to file a correction."
        : "You pull the headset off. Wendi is on the landing, flagless. She says your apartment number the way a neighbor does, and asks if the game is over. You say yes. The cabinet stays dark. The match keeps looking for a player.";
    menu = {
      kind: "ending",
      eyebrow: "Clear",
      title: "You walk off the path.",
      body: `${quiet} Signal ${signal}.`,
      actions: [{ id: "title", label: "Title" }],
    };
  }

  function handleAction(id) {
    if (id === "start") {
      clearCheckpoint();
      checkpoint = emptyCheckpoint();
      writeCheckpoint(checkpoint);
      savedAtBoot = true;
      toast = "";
      story = [];
      bossSpoken = false;
      applyCheckpoint(checkpoint);
      return;
    }
    if (id === "close-story") {
      closeStory();
      return;
    }
    if (id === "resume" && checkpoint) {
      applyCheckpoint(checkpoint);
      return;
    }
    if (id === "retry" || id === "reload") {
      if (checkpoint) applyCheckpoint(checkpoint);
      return;
    }
    if (id === "title") {
      mode = "title";
      menu = titleMenu();
      savedAtBoot = Boolean(loadCheckpoint());
      checkpoint = loadCheckpoint() ?? checkpoint;
      menu = titleMenu();
      return;
    }
    if (id === "score") finish("score");
    if (id === "walk") finish("clear");
  }

  function updateTitle(dt) {
    titleActor.x += titleActor.dir * 36 * dt;
    if (titleActor.x > 1180) titleActor.dir = -1;
    if (titleActor.x < 960) titleActor.dir = 1;
    titleActor.y = 450 + Math.sin(titleActor.x / 80) * 20;
  }

  function refreshHud() {
    look = null;
    if (mode === "title") {
      objective = "OBJECTIVE · CLICK WENDI";
      hint = "";
      return;
    }
    if (mode === "play" && scene === "apartment" && layer === "match") {
      objective = drilled ? "EXIT · STAIRWELL" : "DRILL · SHOOT THE PLATE";
    } else if (mode === "play" && scene !== "apartment") {
      objective = nextStep();
    } else if (mode !== "play" || scene === "apartment") {
      objective = "";
    }
    hint = "";
    if (mode !== "play") return;
    const item = nearestProp(["headset", "plate", "relay", "drop", "console", "inlet", "door"], 78);
    if (!item) return;
    look = { x: item.x, y: item.y, w: item.w, h: item.h };
    if (item.type === "headset") hint = "Click or E  ·  Take the headset";
    else if (item.type === "plate") hint = "Click or F  ·  Shoot the plate";
    else if (item.type === "relay") hint = layer === "match" ? "Click or E  ·  Capture the flag" : "Click or E  ·  Take the relay";
    else if (item.type === "drop") {
      hint = flag === "carried" ? "Click or E  ·  Drop the flag" : flag === "dropped" ? "Flag is on the stand" : "Stand · no flag";
    }
    else if (item.type === "console") hint = hasFlask ? "Tank treated" : "Click or E  ·  Treat the tank";
    else if (item.type === "inlet") {
      if (!hasFlask) hint = "Coolant inlet · no flask";
      else hint = layer === "match" ? "Q  ·  The inlet is under the match" : "Click or E  ·  Vent the flask";
    } else if (item.type === "door") {
      if (!item.open && item.to === "assistant") hint = "Flask opens this door";
      else hint = item.open ? `Door · ${layer === "match" ? item.matchLabel : item.label}` : item.label;
    }
  }

  function nextStep() {
    if (flag === "carried") return scene === "plant" ? "DROP · THE FLAG" : "CARRY · THE PLANT";
    if (scene === "plant") return hasFlask ? "EXIT · SIRI" : "TREAT · THE TANK";
    if (scene === "assistant") {
      if (!hasFlask) return "NEED · COOLANT";
      return layer === "match" ? "Q · SEE THE INLET" : "VENT · THE INLET";
    }
    if (flag === "down" && wendi === "killed") return "TAKE · THE FLAG";
    if (flag === "down" && neighbor?.holding) return "TAKE · HER FLAG";
    if (flag === "dropped") return hasFlask ? "PLANT · SIRI" : "PLANT · THE TANK";
    return "OBJECTIVE · CLICK WENDI";
  }

  function view() {
    refreshHud();
    const boss = map.props.find((prop) => prop.type === "boss");
    if (boss) boss.hp = bossHp;
    const decorative = mode === "title";
    const shownScene = decorative ? "street" : scene;
    const shownMap = decorative ? createMap("street", { plantOpen: false, wendi: "pending" }) : map;
    const shownLayer = decorative ? "match" : layer;
    return {
      mode,
      layer: shownLayer,
      scene: shownScene,
      map: shownMap,
      player: decorative ? null : { ...player, visor: hasHeadset, hp, flag },
      neighbor: decorative
        ? { x: titleActor.x, y: titleActor.y, alive: true, hp: 3, hurt: 0, pacified: false }
        : neighbor
          ? { ...neighbor }
          : null,
      beams: decorative ? [] : beams.map((beam) => ({
        life: beam.life,
        max: beam.max,
        main: beam.main.map((point) => ({ ...point })),
        fork: beam.fork.map((point) => ({ ...point })),
      })),
      bolts: decorative ? [] : bolts.map((bolt) => ({ ...bolt })),
      motes: decorative ? [] : motes.map((mote) => ({ ...mote })),
      pops: decorative ? [] : pops.map((pop) => ({ ...pop })),
      signal,
      hp,
      hasFlask,
      objective,
      caption: captionT > 0 ? caption : "",
      speaker: captionT > 0 ? captionSpeaker : "",
      toast: toastT > 0 ? toast : "",
      hint,
      look,
      menu,
      gauge: gauge ? { ...gauge } : null,
      shake,
      sceneName: SCENE_NAME[scene] ?? "",
      ending,
    };
  }

  return {
    frame(dt, input) {
      const step = clamp(dt, 0, 0.05);
      captionT -= step;
      toastT -= step;
      shake = Math.max(0, shake - step * 1.8);
      updatePops(step);
      if (input.story) toggleStory();
      if (input.action) handleAction(input.action);
      if (mode === "title") {
        updateTitle(step);
        if (input.use) handleAction("start");
      } else if (mode === "play") updatePlay(step, input);
      else if (mode === "gauge") updateGauge(step, input);
      else if (mode === "dead") {
        if (input.use) handleAction("retry");
      } else if (mode === "story") {
        if (input.use) closeStory();
      } else if (mode === "choice") {
        if (input.shoot) finish("score");
        if (input.use) finish("clear");
      } else if (mode === "vent") {
        ventT -= step;
        updateMotes(step);
        if (ventT <= 0) {
          mode = "choice";
          menu = {
            kind: "choice",
            eyebrow: "Perfect score is available",
            title: "Execute the remaining process.",
            body:
              wendi === "killed"
                ? "The headset will file the night as a win. A click or F takes my chair. E walks away. 4B is already dark."
                : "The headset will file the night as a win. A click or F takes my chair. E walks away. Wendi is still on the block, if you left her that way.",
            actions: [
              { id: "score", label: "Take the score" },
              { id: "walk", label: "Walk away" },
            ],
          };
        }
      }
      return view();
    },
    debug() {
      return {
        mode,
        scene,
        layer,
        signal,
        hp,
        hasHeadset,
        hasFlask,
        wendi,
        plantOpen,
        flag,
        player: { x: player.x, y: player.y },
        neighbor: neighbor
          ? { x: neighbor.x, y: neighbor.y, hp: neighbor.hp, alive: neighbor.alive, holding: Boolean(neighbor.holding) }
          : null,
        bossHp,
        floats: pops.filter((pop) => !pop.marker).map((pop) => pop.text),
        marks: pops.filter((pop) => pop.marker).length,
        gauge: gauge ? { pressure: gauge.pressure, treated: gauge.treated, spill: gauge.spill } : null,
        caption,
        speaker: captionSpeaker,
        story: story.length,
        menu: menu?.kind ?? null,
        hint,
      };
    },
  };
}

function circleHitsRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function moveCircle(x, y, r, dx, dy, rects) {
  let nx = x + dx;
  if (rects.some((rect) => circleHitsRect(nx, y, r, rect))) nx = x;
  let ny = y + dy;
  if (rects.some((rect) => circleHitsRect(nx, ny, r, rect))) ny = y;
  return { x: nx, y: ny };
}
