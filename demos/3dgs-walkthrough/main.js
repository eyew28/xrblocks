import {LongSelectHandler} from 'xrblocks/addons/ui/LongSelectHandler.js';

import {SplatMesh, SparkRenderer} from '@sparkjsdev/spark';
import * as THREE from 'three';
import * as xb from 'xrblocks';

const PROPRIETARY_ASSETS_BASE_URL =
  '3dgs/';

const SPLAT_ASSETS = [
  {
    url: PROPRIETARY_ASSETS_BASE_URL + 'horse-qvb.spz',
    scale: new THREE.Vector3(2, -2, 2),
    position: new THREE.Vector3(0, 2.15, 0),
    quaternion: new THREE.Quaternion(1, 0, 0, 0),
  },
  // {
  //   url: PROPRIETARY_ASSETS_BASE_URL + '3dgs_scenes/alameda.spz',
  //   scale: new THREE.Vector3(1.3, 1.3, 1.3),
  //   position: new THREE.Vector3(0, 0, 0),
  //   quaternion: new THREE.Quaternion(1, 0, 0, 0),
  // },
];

const FADE_DURATION_S = 1.0; // seconds
const MOVE_SPEED = 0.05;

/** Ignore stick noise; axes use the standard gamepad range [-1, 1]. */
const STICK_DEADZONE = 0.2;
/** Radians per second at full left-stick deflection (yaw). */
const STICK_YAW_RAD_S = 2.25;
/** Metres per second at full left-stick deflection (vertical). */
const STICK_VERTICAL_M_S = 1.2;
/**
 * Scales right-stick forward/strafe to roughly match keyboard speed at ~60 Hz
 * (MOVE_SPEED is applied per frame without delta time).
 */
const STICK_MOVE_SCALE = MOVE_SPEED * 60;

function stickAxis(value) {
  return Math.abs(value) < STICK_DEADZONE ? 0 : value;
}

function easeInOutSine(x) {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const yawQuat = new THREE.Quaternion();

/**
 * An XR-Blocks demo that displays room-scale 3DGS models, allowing smooth
 * transitions via number keys (1, 2) or a 1.5 s long-pinch.
 */
class WalkthroughManager extends xb.Script {
  async init() {
    this.add(new THREE.HemisphereLight(0xffffff, 0x666666, 3));

    // Load all splat meshes in parallel.
    this.splatMeshes = await Promise.all(
      SPLAT_ASSETS.map(async (asset) => {
        const mesh = new SplatMesh({url: asset.url});
        await mesh.initialized;
        mesh.position.copy(asset.position);
        mesh.quaternion.copy(asset.quaternion);
        mesh.scale.copy(asset.scale);
        return mesh;
      })
    );

    // Create a SparkRenderer for gaussian splat rendering and register it so
    // the simulator can toggle encodeLinear for correct color space.
    const sparkRenderer = new SparkRenderer({
      renderer: xb.core.renderer,
      maxStdDev: Math.sqrt(5),
    });
    xb.core.registry.register(new xb.SparkRendererHolder(sparkRenderer));
    xb.add(sparkRenderer);

    // Show the first splat.
    this.currentIndex = 0;
    xb.add(this.splatMeshes[this.currentIndex]);

    // fadeProgress tracks animation time: null = idle, 0‥FADE_DURATION_S =
    // fading out, FADE_DURATION_S‥2×FADE_DURATION_S = fading in.
    this.fadeProgress = null;
    this.nextIndex = null;

    // Locomotion state (reference-space offset + yaw from left thumbstick).
    this.locomotionOffset = new THREE.Vector3();
    this.locomotionYaw = 0;
    this.baseReferenceSpace = null;
    this.keys = {w: false, a: false, s: false, d: false};

    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));

    xb.add(
      new LongSelectHandler(this.cycleSplat.bind(this), {
        triggerDelay: 1500,
        triggerCooldownDuration: 1500,
      })
    );
  }

  /** Starts a crossfade to the next splat (wrapping around). */
  cycleSplat() {
    if (this.fadeProgress !== null) return;
    this.nextIndex = (this.currentIndex + 1) % this.splatMeshes.length;
    this.fadeProgress = 0;
  }

  onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key in this.keys) this.keys[key] = true;

    // Number key → jump to that splat (1-indexed).
    const idx = parseInt(key, 10) - 1;
    if (
      idx >= 0 &&
      idx < this.splatMeshes.length &&
      idx !== this.currentIndex &&
      this.fadeProgress === null
    ) {
      this.nextIndex = idx;
      this.fadeProgress = 0;
    }
  }

  onKeyUp(event) {
    const key = event.key.toLowerCase();
    if (key in this.keys) this.keys[key] = false;
  }

  onXRSessionEnded() {
    super.onXRSessionEnded();
    this.baseReferenceSpace = null;
    this.locomotionOffset.set(0, 0, 0);
    this.locomotionYaw = 0;
  }

  update() {
    super.update();
    const dt = xb.getDeltaTime();

    this.updateFade(dt);
    this.updateLocomotion(dt);
  }

  /** Handles the fade-out → fade-in crossfade between splats. */
  updateFade(dt) {
    if (this.fadeProgress === null) return;

    this.fadeProgress += dt;
    const currentMesh = this.splatMeshes[this.currentIndex];

    if (this.fadeProgress < FADE_DURATION_S) {
      // Fading out the current splat.
      currentMesh.opacity =
        1 - easeInOutSine(this.fadeProgress / FADE_DURATION_S);
    } else if (this.fadeProgress < 2 * FADE_DURATION_S) {
      // Swap on the first frame of the fade-in phase.
      if (currentMesh.parent) {
        xb.scene.remove(currentMesh);
        this.currentIndex = this.nextIndex;
        const nextMesh = this.splatMeshes[this.currentIndex];
        nextMesh.opacity = 0;
        xb.add(nextMesh);
      }
      // Fading in the new splat.
      const inProgress =
        (this.fadeProgress - FADE_DURATION_S) / FADE_DURATION_S;
      this.splatMeshes[this.currentIndex].opacity = easeInOutSine(inProgress);
    } else {
      // Fade complete.
      this.splatMeshes[this.currentIndex].opacity = 1;
      this.fadeProgress = null;
      this.nextIndex = null;
    }
  }

  /**
   * WASD and XR thumbstick locomotion via `xb.core.input` gamepads
   * (see https://xrblocks.github.io/docs/manual/Inputs/).
   * Left stick: Y = vertical, X = yaw. Right stick: Y = forward/back, X = strafe.
   */
  updateLocomotion(dt) {
    const xr = xb.core.renderer?.xr;
    if (!xr?.isPresenting) return;

    if (!this.baseReferenceSpace) {
      this.baseReferenceSpace = xr.getReferenceSpace();
    }

    const input = xb.core.input;
    const leftGp = input.leftController?.gamepad;
    const rightGp = input.rightController?.gamepad;

    if (leftGp?.axes && leftGp.axes.length >= 2) {
      const lx = stickAxis(leftGp.axes[0]);
      const ly = stickAxis(leftGp.axes[1]);
      // Gamepad Y is negative when the stick is pushed up.
      this.locomotionYaw -= lx * STICK_YAW_RAD_S * dt;
      this.locomotionOffset.y += -ly * STICK_VERTICAL_M_S * dt;
    }

    const camera = xr.getCamera();
    if (camera) {
      camera.getWorldDirection(forward);
      forward.y = 0;
      if (forward.lengthSq() > 1e-10) {
        forward.normalize();
        right.crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();

        if (rightGp?.axes && rightGp.axes.length >= 2) {
          const rx = stickAxis(rightGp.axes[0]);
          const ry = stickAxis(rightGp.axes[1]);
          const forwardAmount = -ry;
          this.locomotionOffset.addScaledVector(
            forward,
            -STICK_MOVE_SCALE * dt * forwardAmount
          );
          this.locomotionOffset.addScaledVector(
            right,
            -STICK_MOVE_SCALE * dt * rx
          );
        }

        moveDirection.set(0, 0, 0);
        if (this.keys.w) moveDirection.add(forward);
        if (this.keys.s) moveDirection.sub(forward);
        if (this.keys.a) moveDirection.sub(right);
        if (this.keys.d) moveDirection.add(right);
        if (moveDirection.lengthSq() > 0) {
          moveDirection.normalize();
          this.locomotionOffset.addScaledVector(moveDirection, -MOVE_SPEED);
        }
      }
    }

    yawQuat.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, this.locomotionYaw);
    const transform = new XRRigidTransform(
      {
        x: this.locomotionOffset.x,
        y: this.locomotionOffset.y,
        z: this.locomotionOffset.z,
      },
      {x: yawQuat.x, y: yawQuat.y, z: yawQuat.z, w: yawQuat.w}
    );
    xr.setReferenceSpace(
      this.baseReferenceSpace.getOffsetReferenceSpace(transform)
    );
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const options = new xb.Options();
  options.reticles.enabled = false;
  options.hands.enabled = true;
  options.hands.visualization = true;
  options.hands.visualizeMeshes = true;
  options.simulator.scenePath = null; // Prevent simulator scene from loading.

  xb.add(new WalkthroughManager());
  xb.init(options);
});
