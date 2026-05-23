import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';

import {SimulatorOptions} from './SimulatorOptions';

export class SimulatorScene extends THREE.Scene {
  gltf?: GLTF;

  constructor() {
    super();
  }

  async init(simulatorOptions: SimulatorOptions) {
    this.addLights();
    const activeEnv =
      simulatorOptions.environments[simulatorOptions.activeEnvironmentIndex];
    if (!activeEnv) return;
    if (activeEnv.videoPath) {
      return;
    }
    if (activeEnv.scenePath) {
      await this.loadGLTF(
        activeEnv.scenePath,
        new THREE.Vector3(
          simulatorOptions.initialScenePosition.x,
          simulatorOptions.initialScenePosition.y,
          simulatorOptions.initialScenePosition.z
        )
      );
    }
  }

  async setEnvironment(path: string | null, initialPosition: THREE.Vector3) {
    if (this.gltf) {
      this.remove(this.gltf.scene);
      this.gltf = undefined;
    }
    if (path) {
      await this.loadGLTF(path, initialPosition);
    }
  }

  addLights() {
    this.add(new THREE.HemisphereLight(0xbbbbbb, 0x888888, 3));
  }

  async loadGLTF(path: string, initialPosition: THREE.Vector3) {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (gltf) => {
          gltf.scene.position.copy(initialPosition);
          this.add(gltf.scene);
          this.gltf = gltf;
          resolve(gltf);
        },
        () => {},
        (error) => {
          reject(error);
        }
      );
    });
  }
}
