import { test } from "node:test";
import assert from "node:assert/strict";
import { createCameraTransition } from "../src/components/network-camera.js";

test("camera interruption preserves the current pose and moves target on the same timeline", () => {
  let pose = { position: { x: 0, y: 0, z: 100 }, target: { x: 0, y: 0, z: 0 } },
    time = 0,
    frame;
  const camera = createCameraTransition({
    read: () => structuredClone(pose),
    apply: (next) => {
      pose = next;
    },
    request: (fn) => {
      frame = fn;
      return 1;
    },
    cancel: () => {
      frame = undefined;
    },
    now: () => time,
  });
  camera.move({ x: 100, y: 0, z: 100 }, { x: 40, y: 0, z: 0 }, 1000);
  time = 500;
  frame(time);
  assert.ok(pose.position.x > 20 && pose.position.x < 100);
  const interruptedX = pose.position.x;
  assert.equal(pose.target.x, 20);
  camera.move({ x: -100, y: 0, z: 100 }, { x: 0, y: 0, z: 0 }, 1000);
  assert.equal(pose.position.x, interruptedX);
  frame(time);
  assert.equal(pose.position.x, interruptedX);
  time = 1500;
  frame(time);
  assert.equal(pose.position.x, -100);
  assert.equal(pose.target.x, 0);
  camera.stop();
  assert.equal(frame, undefined);
});

test("reduced motion applies the final pose without scheduling frames", () => {
  let pose;
  createCameraTransition({
    read: () => ({}),
    apply: (next) => {
      pose = next;
    },
    motion: () => false,
    request: () => {
      throw new Error("unexpected animation");
    },
    cancel: () => {},
    now: () => 0,
  }).move({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0 });
  assert.equal(pose.position.z, 3);
});

test("a half-turn reset follows an arc without crossing the target", () => {
  let pose = { position: { x: 0, y: 0, z: 100 }, target: { x: 0, y: 0, z: 0 } },
    draw;
  createCameraTransition({
    read: () => pose,
    apply: (p) => {
      pose = p;
    },
    request: (fn) => {
      draw = fn;
      return 1;
    },
    cancel: () => {},
    now: () => 0,
  }).move({ x: 0, y: 0, z: -100 }, { x: 0, y: 0, z: 0 }, 1000);
  draw(500);
  assert.ok(
    Math.abs(
      Math.hypot(pose.position.x, pose.position.y, pose.position.z) - 100,
    ) < 1e-8,
  );
});
