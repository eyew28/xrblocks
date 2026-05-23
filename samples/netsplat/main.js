import * as THREE from 'three';
import * as xb from 'xrblocks';
import 'xrblocks/addons/simulator/SimulatorAddons.js';
import {Keyboard} from 'xrblocks/addons/virtualkeyboard/Keyboard.js';
import {LongSelectHandler} from 'xrblocks/addons/ui/LongSelectHandler.js';
import {
  BroadcastChannelTransport,
  AVATAR_PALETTE,
  hashStringToIndex,
} from 'netblocks';
import {NetSample} from '../../build/addons/netblocks/samples/Sample.js';
import {SplatMesh, SparkRenderer} from '@sparkjsdev/spark';

const SPLAT_ASSETS = [
  {
    url: 'https://cdn.jsdelivr.net/gh/xrblocks/proprietary-assets@main/3dgs_scenes/nyc.spz',
    scale: new THREE.Vector3(1.3, 1.3, 1.3),
    position: new THREE.Vector3(0, -0.15, 0),
    quaternion: new THREE.Quaternion(1, 0, 0, 0),
  },
  {
    url: 'https://cdn.jsdelivr.net/gh/xrblocks/proprietary-assets@main/3dgs_scenes/alameda.spz',
    scale: new THREE.Vector3(1.3, 1.3, 1.3),
    position: new THREE.Vector3(0, 0, 0),
    quaternion: new THREE.Quaternion(1, 0, 0, 0),
  },
];

const FADE_DURATION_S = 1.0;
const PARTICLES_PER_BURST = 24;
const BURST_LIFETIME_MS = 1200;
// 32 KB of binary per chunk → ~43 KB base64; safe for WebRTC data channels.
const SPLAT_CHUNK_SIZE = 32768;

function easeInOutSine(x) {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Process 8 KB at a time to avoid blocking the event loop and stay within
  // the argument-count limit of Function.apply.
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}

class NetsplatSample extends NetSample {
  constructor() {
    super(...arguments);
    this._displayName = `User-${Math.floor(Math.random() * 1000)}`;
    this._voiceOn = false;
    this._spatialLogLines = [];
    this._bursts = [];
    // 3DGS state
    this.splatMeshes = [];
    this.currentIndex = 0;
    this.fadeProgress = null;
    this.nextIndex = null;
    // File transfer: id → {chunks, received, total, fileName}
    this._pendingTransfers = new Map();
    // Resolves when the initial CDN splats finish loading; set to null after.
    this._splatSetupPromise = null;
  }

  getJoinOptions() {
    return {
      roomId: 'netsplat-sample',
      options: {
        transport: new BroadcastChannelTransport(),
        displayName: this._displayName,
      },
    };
  }

  async init() {
    // Load splats concurrently with the network room join.
    this._splatSetupPromise = this._setupSplats();
    await super.init();
    await this._splatSetupPromise;
    this._splatSetupPromise = null;
  }

  async _setupSplats() {
    this.add(new THREE.HemisphereLight(0xffffff, 0x666666, 3));

    // Register SparkRenderer before any await so it is ready for splats that
    // arrive via file transfer while the initial CDN assets are still loading.
    const sparkRenderer = new SparkRenderer({
      renderer: xb.core.renderer,
      maxStdDev: Math.sqrt(4),
    });
    xb.core.registry.register(new xb.SparkRendererHolder(sparkRenderer));
    xb.add(sparkRenderer);

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

    xb.add(this.splatMeshes[this.currentIndex]);

    xb.add(
      new LongSelectHandler(this.cycleSplat.bind(this), {
        triggerDelay: 1500,
        triggerCooldownDuration: 1500,
      })
    );

    document.addEventListener('keydown', (e) => {
      const idx = parseInt(e.key, 10) - 1;
      if (
        idx >= 0 &&
        idx < this.splatMeshes.length &&
        idx !== this.currentIndex &&
        this.fadeProgress === null
      ) {
        this.nextIndex = idx;
        this.fadeProgress = 0;
      }
    });
  }

  cycleSplat() {
    if (this.fadeProgress !== null) return;
    this.nextIndex = (this.currentIndex + 1) % this.splatMeshes.length;
    this.fadeProgress = 0;
  }

  onSession(session) {
    // Cubes intentionally omitted.
    this._buildChatPanel(session);
    this._buildVoiceButton(session);
    this._buildLoadSplatButton();
    this._buildSpatialHud(session);
    this._wireBursts(session);
    // Register the splat-chunk listener immediately on join so chunks sent
    // while the initial CDN splats are still downloading are not missed.
    this._wireFileTransfer(session);
  }

  update(time, frame) {
    super.update(time, frame);
    this._stepBursts();
    this._updateFade(xb.getDeltaTime());
  }

  _updateFade(dt) {
    if (this.fadeProgress === null || !this.splatMeshes.length) return;
    this.fadeProgress += dt;
    const currentMesh = this.splatMeshes[this.currentIndex];
    if (this.fadeProgress < FADE_DURATION_S) {
      currentMesh.opacity =
        1 - easeInOutSine(this.fadeProgress / FADE_DURATION_S);
    } else if (this.fadeProgress < 2 * FADE_DURATION_S) {
      if (currentMesh.parent) {
        xb.scene.remove(currentMesh);
        this.currentIndex = this.nextIndex;
        const nextMesh = this.splatMeshes[this.currentIndex];
        nextMesh.opacity = 0;
        xb.add(nextMesh);
      }
      const inProgress =
        (this.fadeProgress - FADE_DURATION_S) / FADE_DURATION_S;
      this.splatMeshes[this.currentIndex].opacity = easeInOutSine(inProgress);
    } else {
      this.splatMeshes[this.currentIndex].opacity = 1;
      this.fadeProgress = null;
      this.nextIndex = null;
    }
  }

  // ---- Load Splat button -------------------------------------------------

  _buildLoadSplatButton() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.ply,.spz,.splat,.ksplat';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    const btn = document.createElement('button');
    btn.textContent = '📂 Load Splat';
    Object.assign(btn.style, {
      marginTop: '8px',
      padding: '8px 14px',
      background: '#3a7fbf',
      color: '#fff',
      border: 'none',
      borderRadius: '20px',
      fontSize: '13px',
      cursor: 'pointer',
      alignSelf: 'flex-start',
    });
    (this._chatPanel ?? document.body).appendChild(btn);

    btn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      fileInput.value = '';
      // Use this.net.session at event time — guaranteed set by now.
      if (this.net?.session) this._sendSplatFile(file, this.net.session, btn);
    });
  }

  _wireFileTransfer(session) {
    session.events.on('splat-chunk', (p) => this._receiveSplatChunk(p));
  }

  async _sendSplatFile(file, session, btn) {
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ Loading…';
    try {
      const buffer = await file.arrayBuffer();
      // Apply locally right away.
      this._applySplat(buffer, file.name);
      // Broadcast to peers in base64 chunks.
      btn.textContent = '📡 Sending…';
      const base64 = arrayBufferToBase64(buffer);
      const total = Math.ceil(base64.length / SPLAT_CHUNK_SIZE);
      const id = Math.random().toString(36).slice(2, 9);
      for (let i = 0; i < total; i++) {
        session.events.emit('splat-chunk', {
          id,
          index: i,
          total,
          fileName: i === 0 ? file.name : null,
          data: base64.slice(i * SPLAT_CHUNK_SIZE, (i + 1) * SPLAT_CHUNK_SIZE),
        });
      }
    } finally {
      btn.textContent = originalLabel;
      btn.disabled = false;
    }
  }

  _receiveSplatChunk(p) {
    let transfer = this._pendingTransfers.get(p.id);
    if (!transfer) {
      transfer = {chunks: new Array(p.total), received: 0, total: p.total, fileName: p.fileName};
      this._pendingTransfers.set(p.id, transfer);
    }
    if (p.fileName) transfer.fileName = p.fileName;
    transfer.chunks[p.index] = p.data;
    transfer.received++;
    if (transfer.received === transfer.total) {
      this._pendingTransfers.delete(p.id);
      const buffer = base64ToArrayBuffer(transfer.chunks.join(''));
      this._applySplat(buffer, transfer.fileName);
    }
  }

  async _applySplat(buffer, fileName) {
    // Wait for the CDN splats to finish so _setupSplats() can't overwrite
    // this.splatMeshes after we've already stored the file-transfer mesh.
    if (this._splatSetupPromise) await this._splatSetupPromise;
    // Cancel any in-progress crossfade.
    this.fadeProgress = null;
    this.nextIndex = null;
    // Initialize the new mesh BEFORE removing old ones. Removing all splats
    // while none is initializing leaves the SparkRenderer with nothing to
    // render, which nulls out its internal render target and causes:
    //   "Cannot set properties of undefined (setting 'encodeLinear')"
    // in the Simulator's render loop. Keeping the old splat visible until
    // the new one is fully ready prevents that gap.
    const mesh = new SplatMesh({fileBytes: buffer, fileName});
    try {
      await mesh.initialized;
    } catch (err) {
      console.error('[netsplat] failed to load splat:', err);
      return;
    }
    // New mesh is ready — atomically swap: remove all old splats, add new one.
    for (const m of this.splatMeshes) {
      if (m?.parent) xb.scene.remove(m);
    }
    mesh.position.set(0, -0.15, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1.3, 1.3, 1.3);
    this.splatMeshes[this.currentIndex] = mesh;
    xb.add(mesh);
  }

  // ---- Chat panel --------------------------------------------------------

  _buildChatPanel(session) {
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      width: '320px',
      maxHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(20, 20, 30, 0.85)',
      color: '#fff',
      borderRadius: '12px',
      padding: '10px',
      font: '13px system-ui, sans-serif',
      backdropFilter: 'blur(8px)',
      zIndex: '999',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    });
    const header = document.createElement('div');
    header.textContent = `💬 ${this._displayName}`;
    Object.assign(header.style, {
      fontWeight: '600',
      marginBottom: '6px',
      color: '#bfa9ff',
    });
    panel.appendChild(header);
    const log = document.createElement('div');
    Object.assign(log.style, {
      flex: '1 1 auto',
      overflowY: 'auto',
      minHeight: '120px',
      padding: '4px 0',
    });
    panel.appendChild(log);
    this._log = log;
    this._chatPanel = panel;
    const inputRow = document.createElement('form');
    Object.assign(inputRow.style, {
      display: 'flex',
      gap: '6px',
      marginTop: '6px',
    });
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Say something…';
    input.maxLength = 280;
    Object.assign(input.style, {
      flex: '1 1 auto',
      padding: '6px 10px',
      borderRadius: '6px',
      border: '1px solid #444',
      background: '#13141c',
      color: '#fff',
      font: 'inherit',
      userSelect: 'text',
      WebkitUserSelect: 'text',
    });
    const send = document.createElement('button');
    send.type = 'submit';
    send.textContent = 'Send';
    Object.assign(send.style, {
      padding: '6px 14px',
      borderRadius: '6px',
      border: 'none',
      background: '#9177c7',
      color: '#fff',
      cursor: 'pointer',
      font: 'inherit',
    });
    inputRow.appendChild(input);
    inputRow.appendChild(send);
    panel.appendChild(inputRow);
    document.body.appendChild(panel);
    const controls = xb.core?.simulator?.controls;
    input.addEventListener('focus', () => {
      if (controls) controls.enabled = false;
    });
    input.addEventListener('blur', () => {
      if (controls) controls.enabled = true;
    });
    inputRow.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const payload = {
        from: this._displayName,
        fromId: session.localPeerId,
        text,
        ts: Date.now(),
      };
      session.events.emit('chat-message', payload);
      this._appendLine(payload, true);
      input.value = '';
    });
    session.events.on('chat-message', (payload) =>
      this._appendLine(payload, false)
    );
  }

  _appendLine(p, self) {
    if (this._log) {
      const line = document.createElement('div');
      line.style.padding = '2px 0';
      const who = document.createElement('span');
      who.textContent = self ? 'you' : p.from;
      const colorHex = self
        ? '#9177c7'
        : '#' +
          AVATAR_PALETTE[hashStringToIndex(p.fromId, AVATAR_PALETTE.length)]
            .toString(16)
            .padStart(6, '0');
      who.style.color = colorHex;
      who.style.fontWeight = '600';
      line.appendChild(who);
      line.appendChild(document.createTextNode(`: ${p.text}`));
      this._log.appendChild(line);
      this._log.scrollTop = this._log.scrollHeight;
    }
    this._appendSpatialLine(`${self ? 'you' : p.from}: ${p.text}`);
  }

  _appendSpatialLine(text) {
    if (!this._spatialLog) return;
    this._spatialLogLines.push(text);
    if (this._spatialLogLines.length > 12) this._spatialLogLines.shift();
    this._spatialLog.setText(this._spatialLogLines.join('\n'));
  }

  // ---- Spatial HUD -------------------------------------------------------

  _buildSpatialHud(session) {
    const panel = new xb.SpatialPanel({
      width: 1.4,
      height: 1.0,
      backgroundColor: '#1a1a2add',
    });
    const grid = panel.addGrid();
    grid.addRow({weight: 0.1}).addText({
      text: `💬 ${this._displayName}`,
      fontSize: 0.05,
      fontColor: '#bfa9ff',
      textAlign: 'center',
    });
    this._spatialLog = new xb.ScrollingTroikaTextView({
      text: '(start typing on the keyboard below to chat)',
      fontSize: 0.04,
      textAlign: 'left',
    });
    grid.addRow({weight: 0.55}).add(this._spatialLog);
    this._spatialDraft = grid.addRow({weight: 0.13}).addText({
      text: '› ',
      fontSize: 0.04,
      fontColor: '#7ac0ff',
      textAlign: 'left',
    });
    this._spatialVoiceBtn = grid.addRow({weight: 0.22}).addTextButton({
      text: '🎙️ Enable voice',
      fontColor: '#ffffff',
      backgroundColor: '#9177c7',
      fontSize: 0.18,
    });
    this._spatialVoiceBtn.onTriggered = () => this._toggleVoice(session);
    panel.position.set(-1.2, 1.5, -1.5);
    panel.rotation.y = Math.PI / 8;
    this.add(panel);
    this._buildKeyboard(session);
  }

  _buildKeyboard(session) {
    class PositionedKeyboard extends Keyboard {
      init() {
        super.init();
        const sub = this.subspace;
        sub.position.set(-0.7, 0.7, -0.7);
        sub.scale.setScalar(0.6);
        sub.rotation.set(-Math.PI / 6, 0, 0);
      }
    }
    const keyboard = new PositionedKeyboard();
    this._keyboard = keyboard;
    xb.add(keyboard);
    keyboard.onTextChanged = (text) => {
      this._spatialDraft?.setText(`› ${text}`);
    };
    keyboard.onEnterPressed = (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const payload = {
        from: this._displayName,
        fromId: session.localPeerId,
        text: trimmed,
        ts: Date.now(),
      };
      session.events.emit('chat-message', payload);
      this._appendLine(payload, true);
      keyboard.clearText();
    };
  }

  async _toggleVoice(session) {
    if (this._voiceOn) {
      session.voice.disable();
      this._voiceOn = false;
      this._spatialVoiceBtn?.setText('🎙️ Enable voice');
    } else {
      try {
        await session.voice.enable(session.transport.remotePeerIds);
        this._voiceOn = true;
        this._spatialVoiceBtn?.setText('🔇 Disable voice');
      } catch (err) {
        this._appendSpatialLine(`voice error: ${err.message}`);
      }
    }
  }

  // ---- Voice button ------------------------------------------------------

  _buildVoiceButton(session) {
    const btn = document.createElement('button');
    btn.textContent = '🎙️ Enable voice';
    Object.assign(btn.style, {
      marginTop: '8px',
      padding: '8px 14px',
      background: '#9177c7',
      color: '#fff',
      border: 'none',
      borderRadius: '20px',
      fontSize: '13px',
      cursor: 'pointer',
      alignSelf: 'flex-start',
    });
    (this._chatPanel ?? document.body).appendChild(btn);
    btn.addEventListener('click', async () => {
      await this._toggleVoice(session);
      btn.textContent = this._voiceOn ? '🔇 Disable voice' : '🎙️ Enable voice';
    });
  }

  // ---- Emoji burst RPC ---------------------------------------------------

  _wireBursts(session) {
    session.events.on('emoji-burst', (p) => this._spawnBurst(p));
    const fire = (origin) => {
      const payload = {
        x: origin.x,
        y: origin.y,
        z: origin.z,
        hue: Math.random(),
      };
      session.events.emit('emoji-burst', payload);
      this._spawnBurst(payload);
    };
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'b' && e.key !== 'B') return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const cam = xb.core?.camera;
      if (!cam) return;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      fire(cam.position.clone().add(fwd.multiplyScalar(1.2)));
    });
    xb.core?.input?.bindSqueezeStart?.((event) => {
      const ctrl = event.target;
      if (!ctrl) return;
      fire(ctrl.getWorldPosition(new THREE.Vector3()));
    });
  }

  _spawnBurst(p) {
    const positions = new Float32Array(PARTICLES_PER_BURST * 3);
    const velocities = new Float32Array(PARTICLES_PER_BURST * 3);
    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 0.4 + Math.random() * 0.4;
      velocities[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
      velocities[i * 3 + 1] = speed * Math.cos(phi) + 0.4;
      velocities[i * 3 + 2] = speed * Math.sin(phi) * Math.sin(theta);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const color = new THREE.Color().setHSL(p.hue, 0.85, 0.6);
    const mat = new THREE.PointsMaterial({color, size: 0.04, transparent: true});
    const points = new THREE.Points(geom, mat);
    this.add(points);
    this._bursts.push({points, velocities, bornAt: performance.now()});
  }

  _stepBursts() {
    const now = performance.now();
    const dt = 1 / 60;
    for (let i = this._bursts.length - 1; i >= 0; i--) {
      const b = this._bursts[i];
      const age = now - b.bornAt;
      if (age > BURST_LIFETIME_MS) {
        this.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        this._bursts.splice(i, 1);
        continue;
      }
      const pos = b.points.geometry.getAttribute('position');
      for (let j = 0; j < pos.count; j++) {
        pos.setXYZ(
          j,
          pos.getX(j) + b.velocities[j * 3] * dt,
          pos.getY(j) + b.velocities[j * 3 + 1] * dt - 0.6 * dt,
          pos.getZ(j) + b.velocities[j * 3 + 2] * dt
        );
        b.velocities[j * 3 + 1] -= 1.5 * dt;
      }
      pos.needsUpdate = true;
      b.points.material.opacity = 1 - age / BURST_LIFETIME_MS;
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const options = new xb.Options();
  options.enableUI();
  options.reticles.enabled = true;
  options.controllers.visualizeRays = false;
  options.simulator.instructions.enabled = false;
  options.hands.enabled = true;
  options.hands.visualization = true;
  options.hands.visualizeMeshes = true;
  xb.add(new NetsplatSample());
  await xb.init(options);
});
