import assert from "node:assert/strict";
import test from "node:test";
import {
  afterKill,
  afterShot,
  sceneRank,
  shouldAdvanceCheckpoint,
  stepGauge,
} from "../src/rules.js";
import { createMap } from "../src/maps.js";

test("shots and kills cannot push Signal below zero", () => {
  assert.equal(afterShot(100), 70);
  assert.equal(afterShot(20), 0);
  assert.equal(afterKill(5), 0);
});

test("checkpoints only move forward", () => {
  const street = { scene: "street", hasFlask: false };
  const plant = { scene: "plant", hasFlask: false };
  const flask = { scene: "plant", hasFlask: true };
  const assistant = { scene: "assistant", hasFlask: true };
  assert.ok(sceneRank(flask) > sceneRank(plant));
  assert.equal(shouldAdvanceCheckpoint(street, plant), true);
  assert.equal(shouldAdvanceCheckpoint(plant, street), false);
  assert.equal(shouldAdvanceCheckpoint(assistant, flask), false);
});

test("the treatment band fills and a pinned valve spills", () => {
  let gauge = { pressure: 50, treated: 0, spill: 0 };
  gauge = { ...gauge, ...stepGauge(gauge, false, 0.5, 0) };
  assert.ok(gauge.pressure > 50);

  gauge = { pressure: 50, treated: 0, spill: 0 };
  for (let i = 0; i < 20; i += 1) {
    gauge = { ...gauge, ...stepGauge(gauge, false, 0.2, 0) };
  }
  assert.equal(gauge.result, "fail");

  gauge = { pressure: 50, treated: 90, spill: 0 };
  gauge = { ...gauge, ...stepGauge(gauge, false, 0.7, 0) };
  assert.equal(gauge.result, "win");
});

test("every scene has a walkable spawn", () => {
  for (const scene of ["apartment", "street", "plant", "assistant"]) {
    const map = createMap(scene, {
      hasHeadset: true,
      hasFlask: true,
      plantOpen: true,
      wendi: "spared",
    });
    assert.ok(map.w > 200 && map.h > 200);
    assert.equal(typeof map.spawn.x, "number");
    const spawnBlocked = map.props.some(
      (prop) =>
        prop.solid &&
        map.spawn.x > prop.x &&
        map.spawn.x < prop.x + prop.w &&
        map.spawn.y > prop.y &&
        map.spawn.y < prop.y + prop.h,
    );
    assert.equal(spawnBlocked, false, scene);
  }
});
