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
  assert.equal(pose.position.x, 50);
  assert.equal(pose.target.x, 20);
  camera.move({ x: -100, y: 0, z: 100 }, { x: 0, y: 0, z: 0 }, 1000);
  assert.equal(pose.position.x, 50);
  frame(time);
  assert.equal(pose.position.x, 50);
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
