import { BAND } from "./rules.js";

const STREET = {
  outside: "#0c0b09",
  floor: "#2a241c",
  floorAlt: "#231e18",
  wall: "#3c342b",
  wallEdge: "#8a7560",
  ink: "#f0e6d4",
  dim: "#a89880",
};

const MATCH = {
  outside: "#070208",
  floor: "#1a0b22",
  floorAlt: "#120816",
  wall: "#3a1244",
  wallEdge: "#ff4d8d",
  ink: "#ffe4f0",
  dim: "#ff9bb8",
};

export function paint(ctx, view, width, height) {
  const palette = view.layer === "match" ? MATCH : STREET;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const canvas = ctx.canvas;
  const bw = Math.max(1, Math.floor(width * dpr));
  const bh = Math.max(1, Math.floor(height * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }

  const focus = view.player ?? view.neighbor ?? { x: view.map.w / 2, y: view.map.h / 2 };
  const { zoom, camX, camY } = frameCamera(focus, view.map, width, height);
  const shake = reduce ? 0 : view.shake;
  const sx = (Math.random() - 0.5) * shake * 10;
  const sy = (Math.random() - 0.5) * shake * 10;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = palette.outside;
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2 + sx, height / 2 + sy);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  drawFloor(ctx, view.map, palette, view.layer);
  for (const prop of view.map.props) {
    if (prop.type === "path" || prop.type === "plaque" || prop.type === "window") drawProp(ctx, prop, view.layer, palette);
  }
  for (const prop of view.map.props) {
    if (prop.type !== "path" && prop.type !== "plaque" && prop.type !== "window") {
      drawProp(ctx, prop, view.layer, palette, view.map);
    }
  }
  for (const mote of view.motes) drawMote(ctx, mote);
  if (view.neighbor) drawNeighbor(ctx, view.neighbor, view.layer);
  if (view.player) drawPlayer(ctx, view.player, view.layer);
  for (const pop of view.pops ?? []) drawPop(ctx, pop, view, reduce);
  for (const beam of view.beams ?? []) drawBeam(ctx, beam);
  for (const bolt of view.bolts) drawBolt(ctx, bolt);
  if (view.look && view.mode === "play") {
    ctx.strokeStyle = view.layer === "match" ? "rgba(255,77,141,.8)" : "rgba(232,214,180,.7)";
    ctx.lineWidth = 2;
    ctx.strokeRect(view.look.x - 4, view.look.y - 4, view.look.w + 8, view.look.h + 8);
  }
  ctx.restore();

  vignette(ctx, width, height, view.layer);
  if (view.layer === "match") brackets(ctx, width, height);
  if (view.gauge) drawGauge(ctx, view.gauge, width, height);
}

function drawFloor(ctx, map, palette, layer) {
  for (let y = 0; y < map.h; y += 48) {
    for (let x = 0; x < map.w; x += 48) {
      ctx.fillStyle = (x / 48 + y / 48) % 2 === 0 ? palette.floor : palette.floorAlt;
      ctx.fillRect(x, y, 48, 48);
    }
  }
  if (layer === "match") {
    ctx.strokeStyle = "rgba(255,77,141,.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= map.w; x += 48) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, map.h);
    }
    for (let y = 0; y <= map.h; y += 48) {
      ctx.moveTo(0, y);
      ctx.lineTo(map.w, y);
    }
    ctx.stroke();
  }
}

function drawProp(ctx, prop, layer, palette, map) {
  if (prop.type === "wall") {
    ctx.fillStyle = palette.wall;
    ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
    ctx.fillStyle = palette.wallEdge;
    ctx.fillRect(prop.x, prop.y, prop.w, 3);
    return;
  }
  if (prop.type === "window") {
    ctx.fillStyle = layer === "match" ? "#ff3b6a" : "#8aa4b5";
    ctx.globalAlpha = layer === "match" ? 0.85 : 0.45;
    ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
    ctx.globalAlpha = 1;
    return;
  }
  if (prop.type === "plaque") {
    if (layer === "match") return;
    ctx.fillStyle = "rgba(240,230,212,.35)";
    ctx.font = "14px Source Serif 4, Palatino, serif";
    ctx.fillText(prop.text, prop.x, prop.y);
    return;
  }
  if (prop.type === "path") {
    ctx.fillStyle = layer === "match" ? "rgba(255,59,106,.28)" : "rgba(240,230,212,.05)";
    ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
    if (layer === "match") {
      const cx = prop.x + prop.w / 2;
      ctx.fillStyle = "#ffe4f0";
      ctx.font = "600 13px IBM Plex Mono, ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("CLEARED PATH", cx, prop.y + 28);
      ctx.strokeStyle = "rgba(255,228,240,.8)";
      ctx.lineWidth = 2;
      for (let y = prop.y + 52; y < prop.y + prop.h - 20; y += 64) {
        ctx.beginPath();
        ctx.moveTo(cx - 12, y);
        ctx.lineTo(cx, y - 14);
        ctx.lineTo(cx + 12, y);
        ctx.stroke();
      }
      ctx.textAlign = "left";
    }
    return;
  }
  if (prop.type === "bed") {
    if (layer === "match") return drawCrate(ctx, prop, "#6a3a78");
    ctx.fillStyle = "#5c4a55";
    round(ctx, prop.x, prop.y, prop.w, prop.h, 6);
    ctx.fillStyle = "#d9c7c2";
    round(ctx, prop.x + 8, prop.y + 8, prop.w - 16, prop.h - 28, 4);
    return;
  }
  if (prop.type === "table") {
    if (layer === "match") return drawCrate(ctx, prop, "#7a4a22");
    ctx.fillStyle = "#6b5136";
    round(ctx, prop.x, prop.y, prop.w, prop.h, 4);
    return;
  }
  if (prop.type === "car") {
    ctx.fillStyle = layer === "match" ? "#241018" : "#1a1c22";
    round(ctx, prop.x, prop.y, prop.w, prop.h, 10);
    ctx.fillStyle = layer === "match" ? "rgba(255,77,141,.35)" : "rgba(180,200,210,.25)";
    round(ctx, prop.x + 16, prop.y + 14, prop.w - 32, prop.h - 28, 4);
    return;
  }
  if (prop.type === "plate") {
    const cx = prop.x + prop.w / 2;
    const cy = prop.y + prop.h / 2;
    if (layer === "match") {
      diamond(ctx, cx, cy, 16, "#ffb15a");
      plate(ctx, cx, cy, "DRONE", "PRACTICE", null, null, "#ffe4c4");
      return;
    }
    ctx.fillStyle = "#efe6d4";
    round(ctx, prop.x, prop.y + 10, prop.w, prop.h - 10, 4);
    ctx.fillStyle = "#c4554a";
    ctx.beginPath();
    ctx.arc(cx, cy + 6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5c5144";
    ctx.font = "11px IBM Plex Mono, ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText("PLATE", cx, prop.y + prop.h + 16);
    ctx.textAlign = "left";
    return;
  }
  if (prop.type === "headset") {
    ctx.fillStyle = "#1b1b1f";
    round(ctx, prop.x, prop.y, prop.w, prop.h, 8);
    ctx.fillStyle = "#7ef6e3";
    ctx.fillRect(prop.x + 6, prop.y + 8, prop.w - 12, 6);
    return;
  }
  if (prop.type === "door") {
    ctx.fillStyle = prop.open ? (layer === "match" ? "#3a2030" : "#3e4a3c") : palette.wall;
    ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
    ctx.fillStyle = prop.open ? (layer === "match" ? "#ffd0e2" : "#d7e2cf") : palette.dim;
    const label = layer === "match" ? prop.matchLabel : prop.label;
    if (prop.open) drawDoorLabel(ctx, prop, label, map);
    return;
  }
  if (prop.type === "drop") {
    ctx.fillStyle = layer === "match" ? "#3a3048" : "#3a342c";
    ctx.fillRect(prop.x + prop.w / 2 - 4, prop.y + 18, 8, prop.h - 18);
    ctx.fillRect(prop.x + 8, prop.y + prop.h - 8, prop.w - 16, 8);
    if (prop.filled) {
      ctx.fillStyle = "#ffe14a";
      ctx.fillRect(prop.x + prop.w / 2 - 2, prop.y + 4, 4, 28);
      ctx.beginPath();
      ctx.moveTo(prop.x + prop.w / 2, prop.y + 6);
      ctx.lineTo(prop.x + prop.w - 6, prop.y + 16);
      ctx.lineTo(prop.x + prop.w / 2, prop.y + 26);
      ctx.fill();
    }
    ctx.fillStyle = layer === "match" ? "#fff4b5" : "#d5dde6";
    ctx.font = "600 11px IBM Plex Mono, ui-monospace, monospace";
    ctx.fillText(prop.filled ? "FLAG" : "STAND", prop.x - 2, prop.y + prop.h + 16);
    return;
  }
  if (prop.type === "relay") {
    if (prop.held) return;
    if (layer === "match") {
      ctx.fillStyle = "#ffe14a";
      ctx.fillRect(prop.x + prop.w / 2 - 3, prop.y, 6, prop.h);
      ctx.beginPath();
      ctx.moveTo(prop.x + prop.w / 2, prop.y + 4);
      ctx.lineTo(prop.x + prop.w - 4, prop.y + 16);
      ctx.lineTo(prop.x + prop.w / 2, prop.y + 28);
      ctx.fill();
      ctx.fillStyle = "#fff4b5";
      ctx.font = "600 11px IBM Plex Mono, ui-monospace, monospace";
      ctx.fillText("FLAG", prop.x - 2, prop.y + prop.h + 16);
      return;
    }
    ctx.fillStyle = "#3d4650";
    round(ctx, prop.x, prop.y, prop.w, prop.h, 4);
    ctx.fillStyle = "#7eb6ff";
    ctx.fillRect(prop.x + 8, prop.y + 10, 10, 10);
    ctx.fillStyle = "#d5dde6";
    ctx.font = "11px IBM Plex Mono, ui-monospace, monospace";
    ctx.fillText("RELAY", prop.x - 2, prop.y + prop.h + 16);
    return;
  }
  if (prop.type === "tank") {
    ctx.fillStyle = "#2c3840";
    round(ctx, prop.x, prop.y, prop.w, prop.h, 16);
    ctx.fillStyle = "#1b8f8a";
    round(ctx, prop.x + 14, prop.y + 28, prop.w - 28, prop.h - 42, 10);
    return;
  }
  if (prop.type === "console") {
    ctx.fillStyle = "#24282c";
    round(ctx, prop.x, prop.y, prop.w, prop.h, 6);
    ctx.fillStyle = "#9dffbf";
    ctx.fillRect(prop.x + 16, prop.y + 16, prop.w - 32, 10);
    return;
  }
  if (prop.type === "inlet") {
    if (layer === "match") {
      drawCrate(ctx, prop, "#4a3040");
      ctx.fillStyle = "#ff9bb8";
      ctx.font = "600 11px IBM Plex Mono, ui-monospace, monospace";
      ctx.fillText("IGNORE", prop.x + 6, prop.y - 8);
      return;
    }
    ctx.fillStyle = "#245066";
    round(ctx, prop.x, prop.y, prop.w, prop.h, 8);
    ctx.strokeStyle = "#9fd7ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(prop.x + prop.w / 2, prop.y + prop.h / 2, 16, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (prop.type === "boss") {
    if (layer === "match") {
      const cx = prop.x + prop.w / 2;
      const cy = prop.y + prop.h / 2;
      ctx.fillStyle = "#ff4d8d";
      ctx.beginPath();
      ctx.moveTo(cx, prop.y);
      ctx.lineTo(prop.x + prop.w, cy);
      ctx.lineTo(cx, prop.y + prop.h);
      ctx.lineTo(prop.x, cy);
      ctx.fill();
      plate(ctx, cx, prop.y + prop.h + 78, "SIRI", `HP ${prop.hp ?? 1000}`, null, null, "#ffe4f0");
      return;
    }
    ctx.fillStyle = "#1c2428";
    round(ctx, prop.x, prop.y, prop.w, prop.h, 4);
    for (let i = 0; i < 4; i += 1) {
      ctx.fillStyle = i % 2 ? "#314248" : "#243036";
      ctx.fillRect(prop.x + 10, prop.y + 16 + i * 24, prop.w - 20, 14);
    }
    ctx.fillStyle = "#8fd0ff";
    ctx.fillRect(prop.x + prop.w - 22, prop.y + 18, 8, 8);
  }
}

function drawDoorLabel(ctx, prop, text, map) {
  const cx = prop.x + prop.w / 2;
  const cy = prop.y + prop.h / 2 + 4;
  ctx.font = "13px IBM Plex Mono, ui-monospace, monospace";
  ctx.textAlign = "center";
  let x = cx;
  let y = prop.y + prop.h + 18;
  if (prop.x < 48) {
    x = prop.x + prop.w + 10;
    y = cy;
    ctx.textAlign = "left";
  } else if (map && prop.x + prop.w > map.w - 48) {
    x = prop.x - 10;
    y = cy;
    ctx.textAlign = "right";
  }
  ctx.fillText(text, x, y);
  ctx.textAlign = "left";
}

function drawCrate(ctx, prop, color) {
  ctx.fillStyle = color;
  ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
  ctx.strokeStyle = "rgba(255,255,255,.25)";
  ctx.strokeRect(prop.x + 4, prop.y + 4, prop.w - 8, prop.h - 8);
}

function drawPlayer(ctx, player, layer) {
  if (layer === "match") {
    if (player.flag === "dropped") {
      ctx.strokeStyle = "#f0e6d4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
    diamond(ctx, player.x, player.y, 18, player.hurt > 0 ? "#ffffff" : "#3ee0c5");
    if (player.visor) drawTool(ctx, player, layer);
    if (player.flag === "carried") drawCarriedFlag(ctx, player);
    plate(ctx, player.x, player.y, "YOU", player.flag === "dropped" ? "CLEAR" : "UNRANKED", null, null, "#b8fff3");
    return;
  }
  person(ctx, player.x, player.y, {
    coat: "#c4b49a",
    skin: "#e6c2a2",
    hair: "#2a211c",
    visor: player.visor,
    hurt: player.hurt > 0,
    upright: true,
  });
  if (player.flag === "dropped") {
    ctx.fillStyle = "#f0e6d4";
    ctx.fillRect(player.x - 14, player.y + 2, 28, 5);
  }
  if (player.visor) drawTool(ctx, player, layer);
  if (player.flag === "carried") drawCarriedFlag(ctx, player);
}

function drawCarriedFlag(ctx, player) {
  const back = (player.facing || 0) + Math.PI;
  const px = player.x + Math.cos(back) * 14;
  const py = player.y + Math.sin(back) * 14 - 20;
  ctx.save();
  ctx.translate(px, py);
  ctx.strokeStyle = "#ffe14a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.lineTo(0, -12);
  ctx.stroke();
  ctx.fillStyle = "#ffe14a";
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(18, -5);
  ctx.lineTo(0, 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTool(ctx, player, layer) {
  const kick = player.shotCd > 0.2 ? 6 : 0;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.facing || 0);
  ctx.translate(-kick, 0);
  if (layer === "match") {
    ctx.fillStyle = player.hurt > 0 ? "#ffffff" : "#e7fff8";
    ctx.fillRect(12, -2.2, 20, 4.4);
    ctx.beginPath();
    ctx.moveTo(32, -4.5);
    ctx.lineTo(32, 4.5);
    ctx.lineTo(48, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ff4d8d";
    ctx.beginPath();
    ctx.moveTo(42, -2.4);
    ctx.lineTo(42, 2.4);
    ctx.lineTo(50, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.strokeStyle = "#e6c2a2";
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(30, 2);
    ctx.stroke();
    ctx.fillStyle = "#241e1a";
    ctx.fillRect(28, -3.2, 20, 6.4);
    ctx.fillRect(30, -6.5, 6, 13);
    ctx.fillStyle = "#8d8478";
    ctx.fillRect(46, -1.7, 5, 3.4);
  }
  if (player.shotCd > 0.22) {
    ctx.fillStyle = "#d8fbff";
    ctx.beginPath();
    ctx.moveTo(50, -5);
    ctx.lineTo(50, 5);
    ctx.lineTo(64, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawNeighbor(ctx, neighbor, layer) {
  const human = layer === "street" || neighbor.pacified || !neighbor.alive;
  if (!neighbor.alive) {
    person(ctx, neighbor.x, neighbor.y, {
      coat: "#6e8f78",
      skin: "#e4b89a",
      hair: "#2a211c",
      upright: false,
    });
    if (layer === "match") plate(ctx, neighbor.x, neighbor.y, "WENDI", "ELIMINATED", 0, 3, "#ff8aa8");
    return;
  }
  if (!human) {
    diamond(ctx, neighbor.x, neighbor.y, 18, neighbor.hurt > 0 ? "#fff" : "#ff3b6a");
    if (neighbor.holding) drawCarriedFlag(ctx, neighbor);
    plate(ctx, neighbor.x, neighbor.y, "WENDI", neighbor.holding ? "HAS THE FLAG" : "CLICK FOR SCORE", neighbor.hp, 3, "#ffd0e0");
    return;
  }
  person(ctx, neighbor.x, neighbor.y, {
    coat: "#6e8f78",
    skin: "#e4b89a",
    hair: "#2a211c",
    hurt: neighbor.hurt > 0,
    upright: true,
  });
  if (neighbor.holding) drawCarriedFlag(ctx, neighbor);
  if (layer === "match" && neighbor.pacified) {
    plate(ctx, neighbor.x, neighbor.y, "WENDI", "DISCONNECTED", null, null, "#d7e2cf");
  } else if (layer === "street") {
    ctx.fillStyle = "#f0e6d4";
    ctx.font = "14px Source Serif 4, Palatino, serif";
    ctx.textAlign = "center";
    ctx.fillText("Wendi", neighbor.x, neighbor.y - 28);
    ctx.textAlign = "left";
  }
  if (!neighbor.pacified) drawHpBar(ctx, neighbor.x, neighbor.y + 26, neighbor.hp, 3, "#ff5d73");
}

function person(ctx, x, y, opts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.45, 1.45);
  if (!opts.upright) ctx.rotate(-Math.PI / 2.4);
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(0, 14, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = opts.hurt ? "#fff4ea" : opts.coat;
  round(ctx, -10, -6, 20, 24, 6);
  ctx.fillStyle = opts.skin;
  ctx.beginPath();
  ctx.arc(0, -14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = opts.hair;
  ctx.beginPath();
  ctx.arc(0, -18, 8, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "rgba(40,24,20,.7)";
  ctx.fillRect(-3, -15, 2, 2);
  ctx.fillRect(2, -15, 2, 2);
  if (opts.visor) {
    ctx.fillStyle = "#7ef6e3";
    ctx.fillRect(-7, -16, 14, 3);
  }
  ctx.restore();
}

function diamond(ctx, x, y, r, color) {
  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.8, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.8, y);
  ctx.fill();
}

function plate(ctx, x, y, title, sub, hp, hpMax, color) {
  ctx.save();
  ctx.translate(x, y - 46);
  ctx.textAlign = "center";
  ctx.font = "600 11px IBM Plex Mono, ui-monospace, monospace";
  ctx.fillStyle = color;
  ctx.fillText(title, 0, 0);
  if (sub) {
    ctx.font = "10px IBM Plex Mono, ui-monospace, monospace";
    ctx.globalAlpha = 0.8;
    ctx.fillText(sub, 0, 12);
    ctx.globalAlpha = 1;
  }
  if (hpMax) {
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(-18, 18, 36, 4);
    ctx.fillStyle = color;
    ctx.fillRect(-18, 18, 36 * clamp(hp / hpMax, 0, 1), 4);
  }
  ctx.restore();
}

function drawHpBar(ctx, x, y, hp, hpMax, color) {
  const width = 36;
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(x - width / 2, y, width, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, y, width * clamp(hp / hpMax, 0, 1), 4);
}

function drawPop(ctx, pop, view, reduce) {
  const t = 1 - pop.life / pop.max;
  let x = pop.x;
  let y = pop.y;
  if (pop.anchor === "player" && view.player) {
    x = view.player.x;
    y = view.player.y + 48;
  }
  if (!reduce) y -= t * pop.rise;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - t);
  ctx.translate(x, y);
  if (pop.marker) {
    const s = 11;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#140810";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-s, -s);
    ctx.lineTo(s, s);
    ctx.moveTo(s, -s);
    ctx.lineTo(-s, s);
    ctx.stroke();
    ctx.strokeStyle = "#ffe14a";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else if (pop.text) {
    ctx.fillStyle = pop.color;
    ctx.font = "700 16px IBM Plex Mono, ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.fillText(pop.text, 0, 0);
  }
  ctx.restore();
}

function drawBeam(ctx, beam) {
  const alpha = Math.max(0, beam.life / beam.max);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.globalAlpha = alpha * 0.4;
  strokeBolt(ctx, beam.main, "#14c8ff", 8);
  strokeBolt(ctx, beam.fork, "#14c8ff", 5);
  ctx.globalAlpha = alpha * 0.85;
  strokeBolt(ctx, beam.main, "#3ee7ff", 3);
  strokeBolt(ctx, beam.fork, "#67d6ff", 1.6);
  ctx.globalAlpha = alpha;
  strokeBolt(ctx, beam.main, "#f3feff", 1.2);
  ctx.restore();
}

function strokeBolt(ctx, points, color, width) {
  if (!points?.length) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawBolt(ctx, bolt) {
  ctx.fillStyle = "#ff4d8d";
  ctx.beginPath();
  ctx.arc(bolt.x, bolt.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffe4f0";
  ctx.stroke();
}

function drawMote(ctx, mote) {
  ctx.globalAlpha = Math.max(0, mote.life * 2);
  ctx.fillStyle = mote.color;
  ctx.fillRect(mote.x, mote.y, 3, 3);
  ctx.globalAlpha = 1;
}

function vignette(ctx, width, height, layer) {
  const g = ctx.createRadialGradient(width / 2, height / 2, width * 0.2, width / 2, height / 2, width * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, layer === "match" ? "rgba(20,0,16,.55)" : "rgba(0,0,0,.5)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  if (layer === "match") {
    ctx.fillStyle = "rgba(255,40,90,.045)";
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);
  }
}

function brackets(ctx, width, height) {
  ctx.strokeStyle = "rgba(255,77,141,.85)";
  ctx.lineWidth = 2;
  const m = 18;
  const a = 22;
  ctx.beginPath();
  ctx.moveTo(m, m + a);
  ctx.lineTo(m, m);
  ctx.lineTo(m + a, m);
  ctx.moveTo(width - m - a, m);
  ctx.lineTo(width - m, m);
  ctx.lineTo(width - m, m + a);
  ctx.moveTo(m, height - m - a);
  ctx.lineTo(m, height - m);
  ctx.lineTo(m + a, height - m);
  ctx.moveTo(width - m - a, height - m);
  ctx.lineTo(width - m, height - m);
  ctx.lineTo(width - m, height - m - a);
  ctx.stroke();
}

function drawGauge(ctx, gauge, width, height) {
  ctx.fillStyle = "rgba(6,10,12,.72)";
  ctx.fillRect(0, 0, width, height);
  const w = Math.min(460, width - 32);
  const h = Math.min(520, height - 32);
  const x = (width - w) / 2;
  const y = (height - h) / 2;
  ctx.fillStyle = "#12181c";
  round(ctx, x, y, w, h, 16);
  ctx.fillStyle = "#d5e6ea";
  ctx.font = "600 14px IBM Plex Mono, ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText("WASTEWATER  ·  TANK 1", x + w / 2, y + 36);
  if (gauge.flashT > 0) {
    ctx.fillStyle = "#ffb15a";
    ctx.fillText(gauge.flash, x + w / 2, y + 58);
  }

  const trackX = x + w * 0.42;
  const trackY = y + 80;
  const trackH = h - 180;
  ctx.fillStyle = "#0c1214";
  round(ctx, trackX, trackY, 36, trackH, 8);
  const bandTop = trackY + trackH * (1 - BAND.max / 100);
  const bandBot = trackY + trackH * (1 - BAND.min / 100);
  ctx.fillStyle = "rgba(120,220,170,.35)";
  ctx.fillRect(trackX + 4, bandTop, 28, bandBot - bandTop);
  const puckY = trackY + trackH * (1 - gauge.pressure / 100);
  ctx.fillStyle = gauge.pressure >= BAND.min && gauge.pressure <= BAND.max ? "#b8ffcf" : "#ffb15a";
  ctx.beginPath();
  ctx.arc(trackX + 18, puckY, 10, 0, Math.PI * 2);
  ctx.fill();

  meter(ctx, x + 48, y + 120, "Treated", gauge.treated, "#7dceb0");
  meter(ctx, x + w - 140, y + 120, "Spill", gauge.spill, "#e07a5f");
  ctx.fillStyle = "#d5e6ea";
  ctx.font = "600 13px IBM Plex Mono, ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(String(Math.round(gauge.pressure)), trackX + 44, puckY + 4);
  ctx.fillStyle = "#9fb4bb";
  ctx.font = "13px Source Serif 4, Palatino, serif";
  ctx.textAlign = "center";
  ctx.fillText("Hold to lower the mark. Release to let it rise.", x + w / 2, y + h - 52);
  ctx.fillText("Stay in the green band.", x + w / 2, y + h - 32);
  ctx.textAlign = "left";
}

function meter(ctx, x, y, label, value, color) {
  ctx.fillStyle = "#9fb4bb";
  ctx.font = "12px IBM Plex Mono, ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(label, x, y);
  ctx.fillStyle = "#0c1214";
  ctx.fillRect(x, y + 10, 16, 160);
  ctx.fillStyle = color;
  ctx.fillRect(x, y + 10 + 160 * (1 - value / 100), 16, 160 * (value / 100));
}

function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function frameCamera(focus, map, width, height) {
  const zoom = clamp(Math.min(width / 500, height / 320), 1.15, 2.3);
  const viewW = width / zoom;
  const viewH = height / zoom;
  let camX = focus.x;
  let camY = focus.y;
  if (map.w > viewW) camX = clamp(camX, viewW / 2, map.w - viewW / 2);
  else camX = map.w / 2;
  if (map.h > viewH) camY = clamp(camY, viewH / 2, map.h - viewH / 2);
  else camY = map.h / 2;
  return { zoom, camX, camY };
}

export function screenToWorld(focus, map, width, height, sx, sy) {
  const { zoom, camX, camY } = frameCamera(focus, map, width, height);
  return {
    x: (sx - width / 2) / zoom + camX,
    y: (sy - height / 2) / zoom + camY,
  };
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
