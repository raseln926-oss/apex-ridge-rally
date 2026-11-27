import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { createRallyTrack, type RallyTrack } from './track';
import {
  createInitialVehicleState,
  stepAiVehicle,
  stepVehiclePhysics,
  type VehicleState,
} from './physics';
import { createProceduralTextures, type ProceduralTextures } from './textures';
import {
  buildCircuitEnvironment,
  buildGhostCarMesh,
  buildGhostTrajectoryOverlay,
  buildRallyCarMesh,
  buildRoadObstacleMesh,
  buildTrafficCarMesh,
  type RallyCarRig,
  type TrafficCarRig,
} from './models';
import {
  createRoadObstacles,
  createTrafficCars,
  stepTrafficAndObstacles,
  type RoadObstacleState,
  type TrafficCarState,
} from './traffic';
import {
  computeGhostDeltaMs,
  loadGhostForStage,
  sampleGhostAtTime,
  sampleRunAtTime,
  saveBestGhostIfFaster,
} from './telemetry';
import { RallyAudioEngine } from './audio';
import type {
  CameraMode,
  ControlInput,
  GameState,
  GhostData,
  HudSnapshot,
  MapId,
  RaceMode,
  RaceResultSnapshot,
  ReplayCameraMode,
  RunRecording,
  TelemetrySample,
} from './types';

// Pre-allocated scratch math objects (Zero-GC in animation loop)
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _dustDummy = new THREE.Object3D();

const RECORD_INTERVAL_MS = 50;
const MAX_RUN_FRAMES = 12000;

interface DustParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  scale: number;
}

export interface MinimapSamplePayload {
  playerX: number;
  playerZ: number;
  playerHeading: number;
  rivals: { x: number; z: number }[];
  ghost?: { x: number; z: number; heading: number } | null;
}

export interface EngineCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
  onFastTelemetry: (speedKmh: number, rpm: number, gear: number) => void;
  onFastMinimap: (payload: MinimapSamplePayload) => void;
  onReplayTick?: (timeMs: number, durationMs: number, paused: boolean, lap: number) => void;
  onGhostUpdated?: (ghost: GhostData | null) => void;
  onRaceComplete: (result: RaceResultSnapshot) => void;
  onContextLost: (lost: boolean) => void;
  onSceneReady?: () => void;
}

export class RallyGameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sky: Sky;
  private hemiLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private mapId: MapId;
  private track: RallyTrack;
  private audio: RallyAudioEngine;
  private isSoftwareGl: boolean;

  private playerCar: RallyCarRig;
  private ghostCar: RallyCarRig;
  private rivalRigs: RallyCarRig[] = [];
  private trafficCars: TrafficCarState[] = [];
  private trafficRigs: TrafficCarRig[] = [];
  private roadObstacles: RoadObstacleState[] = [];
  private obstacleRigs: { root: THREE.Group; dispose: () => void }[] = [];
  private playerState: VehicleState;
  private rivalStates: VehicleState[] = [];
  private rivalLanes = [-2.2, 2.2];
  private rivalPaces = [0.91, 0.85];
  private score = 0;
  private combo = 1;
  private overtakes = 0;

  // Ghost & Telemetry Recording state
  private activeGhost: GhostData | null = null;
  private ghostEnabled = true;
  private ghostTrajectory: { group: THREE.Group; dispose: () => void } | null = null;
  private currentGhostPose: { x: number; z: number; heading: number } | null = null;
  private currentGhostDeltaMs: number | null = null;
  private runFrames: TelemetrySample[] = [];
  private lastRecordTimeMs = -Infinity;
  private lastRunRecording: RunRecording | null = null;

  // Replay playback state
  private replayTimeMs = 0;
  private replayDurationMs = 0;
  private replayPaused = false;
  private replaySpeed: 0.5 | 1 | 2 = 1;
  private replayCameraMode: ReplayCameraMode = 'broadcast';
  private replayCamAnchor = new THREE.Vector3();
  private replayCamSnapped = false;
  private replayOrbitAngle = 0;

  // Dust particle ring buffer
  private dustMesh: THREE.InstancedMesh;
  private dustPool: DustParticle[] = [];
  private dustCursor = 0;

  // Game & loop state
  private gameState: GameState = 'title';
  private raceMode: RaceMode = 'race';
  private totalLaps = 2;
  private cameraMode: CameraMode = 'chase';
  private input: ControlInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };

  private lapStartMs = 0;
  private totalTimeMs = 0;
  private bestLapMs: number | null = null;
  private hitstopTimer = 0;
  private trauma = 0;
  private titleTourT = 0;
  private lastHudEmit = 0;
  private lastTimeMs = 0;
  private frameId = 0;
  private disposed = false;
  private sceneReadyEmitted = false;

  private envMap: THREE.Texture;
  private textures: ProceduralTextures;
  private envDispose: () => void;
  private dustGeo: THREE.BufferGeometry;
  private dustMat: THREE.Material;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, callbacks: EngineCallbacks, initialMapId: MapId = 'alpine') {
    this.container = container;
    this.callbacks = callbacks;
    this.mapId = initialMapId;
    this.track = createRallyTrack(480, initialMapId);
    this.audio = new RallyAudioEngine();

    // Detect software WebGL from GPU renderer string (never UA)
    this.isSoftwareGl = (() => {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    this.renderer.setSize(width, height);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.25, 480);

    // Procedural Studio Environment (RoomEnvironment) for realistic car paint & alloy reflections
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envMap;
    pmremGenerator.dispose();

    // Procedural Sky + Horizon-Matched Exponential Fog
    this.sky = new Sky();
    this.sky.scale.setScalar(1000);
    this.scene.add(this.sky);

    // Warm/Cool 3-Point Outdoor Lighting Rig (max 1 shadow caster)
    this.hemiLight = new THREE.HemisphereLight(0x8db9e8, 0x3f362d, 0.88);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xffe1ba, 2.1);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 220;
    const d = 48;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x9bc4f2, 0.55);
    this.rimLight.position.set(-60, 35, -70);
    this.scene.add(this.rimLight);

    this.applyMapAtmosphere(this.mapId);

    // Procedural textures & circuit terrain/track/props
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    const env = buildCircuitEnvironment(this.scene, this.track, this.textures, this.isSoftwareGl);
    this.envDispose = env.dispose;

    // Player Car (Crimson / Ember Orange Rally Spec)
    this.playerCar = buildRallyCarMesh(0xd93829, 0xf2f0ea, this.textures.contactShadowMap, !this.isSoftwareGl);
    this.scene.add(this.playerCar.root);

    // Translucent Personal-Best Ghost Car
    this.ghostCar = buildGhostCarMesh(this.textures.contactShadowMap);
    this.ghostCar.root.visible = false;
    this.scene.add(this.ghostCar.root);

    // 2 Rival Rally Cars (Alpine Cobalt & Titanium Slate)
    const rivalColors: [number, number][] = [
      [0x1e5aa8, 0xf5b027],
      [0x2b333e, 0x38bdf8],
    ];
    for (const [bodyC, accC] of rivalColors) {
      const rig = buildRallyCarMesh(bodyC, accC, this.textures.contactShadowMap, !this.isSoftwareGl);
      this.scene.add(rig.root);
      this.rivalRigs.push(rig);
    }

    // Pooled Zero-GC Dust / Gravel Particle Ring Buffer
    const poolSize = 110;
    this.dustGeo = new THREE.DodecahedronGeometry(0.42, 0);
    this.dustMat = new THREE.MeshStandardMaterial({
      color: 0xb89f82,
      roughness: 0.96,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.dustMesh = new THREE.InstancedMesh(this.dustGeo, this.dustMat, poolSize);
    this.dustMesh.frustumCulled = false;
    for (let i = 0; i < poolSize; i++) {
      this.dustPool.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: 0.6,
        scale: 0.001,
      });
      _dustDummy.position.set(0, -50, 0);
      _dustDummy.scale.setScalar(0.001);
      _dustDummy.updateMatrix();
      this.dustMesh.setMatrixAt(i, _dustDummy.matrix);
    }
    this.dustMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.dustMesh);

    this.playerState = createInitialVehicleState(this.track, 0.03, 0);
    this.rebuildTrafficAndObstacles();
    this.resetGridPositions();
    this.refreshGhostVisuals();
    this.snapTitleCamera();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);
    window.addEventListener('orientationchange', this.handleOrientationResize);
    window.visualViewport?.addEventListener('resize', this.handleOrientationResize);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.lastTimeMs = performance.now();
    this.scheduleNextTick();
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private handleContextRestored = (): void => {
    this.callbacks.onContextLost(false);
  };

  private handleOrientationResize = (): void => {
    window.setTimeout(() => this.handleResize(), 60);
  };

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
  }

  private rebuildTrafficAndObstacles(): void {
    for (const rig of this.trafficRigs) {
      this.scene.remove(rig.root);
      rig.dispose();
    }
    this.trafficRigs = [];

    for (const obs of this.obstacleRigs) {
      this.scene.remove(obs.root);
      obs.dispose();
    }
    this.obstacleRigs = [];

    this.trafficCars = createTrafficCars(this.track, 6);
    for (const car of this.trafficCars) {
      const rig = buildTrafficCarMesh(
        car.kind,
        car.colorHex,
        car.accentHex,
        this.textures.contactShadowMap,
        !this.isSoftwareGl
      );
      this.scene.add(rig.root);
      this.trafficRigs.push(rig);
    }

    this.roadObstacles = createRoadObstacles(this.track, 12);
    for (const obs of this.roadObstacles) {
      const rig = buildRoadObstacleMesh(obs.kind, !this.isSoftwareGl);
      this.scene.add(rig.root);
      this.obstacleRigs.push(rig);
    }

    this.syncTrafficAndObstacles();
  }

  private syncTrafficAndObstacles(): void {
    const showWorldTraffic = this.gameState !== 'replay';
    for (let i = 0; i < this.trafficRigs.length; i++) {
      const rig = this.trafficRigs[i];
      const car = this.trafficCars[i];
      if (!rig || !car) continue;
      rig.root.visible = showWorldTraffic;
      rig.root.position.set(car.x, car.y, car.z);
      rig.root.rotation.y = car.heading;
      for (const w of rig.wheels) {
        w.rotation.x = car.wheelRotation;
      }
    }

    for (let i = 0; i < this.obstacleRigs.length; i++) {
      const rig = this.obstacleRigs[i];
      const obs = this.roadObstacles[i];
      if (!rig || !obs) continue;
      rig.root.visible = showWorldTraffic;
      rig.root.position.set(obs.x, obs.y, obs.z);
      if (obs.knockedTimer > 0) {
        rig.root.rotation.set(obs.spin * 0.45, obs.heading + obs.spin, obs.spin * 0.35);
      } else {
        rig.root.rotation.set(0, obs.heading, 0);
      }
    }
  }

  private resetGridPositions(): void {
    // Player starts on straight open tarmac grid facing +Z toward the gantry arch
    this.playerState = createInitialVehicleState(this.track, 0.025, 0.0);
    this.rivalStates = [
      createInitialVehicleState(this.track, 0.032, this.rivalLanes[0]),
      createInitialVehicleState(this.track, 0.036, this.rivalLanes[1]),
    ];
    this.lapStartMs = 0;
    this.totalTimeMs = 0;
    this.bestLapMs = null;
    this.score = 0;
    this.combo = 1;
    this.overtakes = 0;
    this.hitstopTimer = 0;
    this.trauma = 0;
    this.runFrames = [];
    this.lastRecordTimeMs = -Infinity;
    this.currentGhostPose = null;
    this.currentGhostDeltaMs = null;

    this.trafficCars = createTrafficCars(this.track, 6);
    this.roadObstacles = createRoadObstacles(this.track, 12);
    this.syncTrafficAndObstacles();

    this.clearDustParticles();

    this.syncCarVisual(this.playerCar, this.playerState, 0);
    for (let i = 0; i < this.rivalRigs.length; i++) {
      const showRivals = this.raceMode === 'race' || this.gameState === 'title';
      this.rivalRigs[i].root.visible = showRivals;
      this.syncCarVisual(this.rivalRigs[i], this.rivalStates[i], 0);
    }
    this.updateGhostVisibility();
  }

  private clearDustParticles(): void {
    for (let i = 0; i < this.dustPool.length; i++) {
      this.dustPool[i].active = false;
      _dustDummy.position.set(0, -50, 0);
      _dustDummy.scale.setScalar(0.001);
      _dustDummy.updateMatrix();
      this.dustMesh.setMatrixAt(i, _dustDummy.matrix);
    }
    this.dustMesh.instanceMatrix.needsUpdate = true;
  }

  private snapTitleCamera(): void {
    const orbitAngle = this.titleTourT * 0.22;
    const dist = 11.5;
    const cx = this.playerState.x + Math.sin(orbitAngle) * dist;
    const cz = this.playerState.z + Math.cos(orbitAngle) * dist;
    const groundY = this.track.groundHeightAt(cx, cz);
    const cy = Math.max(groundY + 2.6, this.playerState.y + 4.4);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(
      this.playerState.x,
      this.playerState.y + 1.1,
      this.playerState.z
    );
  }

  private disposeGhostTrajectory(): void {
    if (this.ghostTrajectory) {
      this.scene.remove(this.ghostTrajectory.group);
      this.ghostTrajectory.dispose();
      this.ghostTrajectory = null;
    }
  }

  private rebuildGhostTrajectory(ghost: GhostData | null): void {
    this.disposeGhostTrajectory();
    if (ghost && ghost.frames.length >= 2) {
      const overlay = buildGhostTrajectoryOverlay(ghost.frames);
      this.ghostTrajectory = overlay;
      this.scene.add(overlay.group);
    }
    this.updateGhostVisibility();
  }

  private refreshGhostVisuals(): void {
    this.activeGhost = loadGhostForStage(this.mapId, this.totalLaps);
    this.rebuildGhostTrajectory(this.activeGhost);
    this.callbacks.onGhostUpdated?.(this.activeGhost);
  }

  private updateGhostVisibility(): void {
    const showActive = Boolean(
      this.activeGhost &&
        this.ghostEnabled &&
        (this.gameState === 'playing' || this.gameState === 'paused')
    );
    if (this.ghostTrajectory) {
      this.ghostTrajectory.group.visible = showActive;
    }
    this.ghostCar.root.visible = showActive;
  }

  public setGhostEnabled(enabled: boolean): void {
    this.ghostEnabled = enabled;
    this.updateGhostVisibility();
    if (!enabled) {
      this.currentGhostPose = null;
      this.currentGhostDeltaMs = null;
    } else if (this.activeGhost && this.gameState === 'playing') {
      this.syncGhostToTime(this.totalTimeMs);
    }
    this.emitMinimapTelemetry();
    this.emitHudSnapshot(true);
  }

  public getActiveGhost(): GhostData | null {
    return this.activeGhost;
  }

  public startRace(mode: RaceMode, laps: number, fromGesture = true): void {
    if (fromGesture) {
      this.audio.unlock();
    }
    this.raceMode = mode;
    this.totalLaps = laps;
    this.gameState = 'playing';
    this.audio.setPaused(!fromGesture);
    this.resetGridPositions();
    this.refreshGhostVisuals();
    this.recordTelemetryFrame(0);
    if (this.activeGhost && this.ghostEnabled) {
      this.syncGhostToTime(0);
    }

    // Snap chase camera cleanly behind player car on start
    const fx = Math.sin(this.playerState.heading);
    const fz = Math.cos(this.playerState.heading);
    this.camera.position.set(
      this.playerState.x - fx * 8.2,
      this.playerState.y + 3.4,
      this.playerState.z - fz * 8.2
    );
    this.camera.lookAt(
      this.playerState.x + fx * 10,
      this.playerState.y + 1.2,
      this.playerState.z + fz * 10
    );
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();

    if (fromGesture) {
      this.audio.playCountdownBeep(true);
    }
    this.emitMinimapTelemetry();
    this.emitHudSnapshot(true);
  }

  private applyMapAtmosphere(mapId: MapId): void {
    const isCity = mapId === 'city';
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms['turbidity'].value = isCity ? 4.8 : 6.5;
    skyUniforms['rayleigh'].value = isCity ? 2.5 : 2.1;
    skyUniforms['mieCoefficient'].value = 0.006;
    skyUniforms['mieDirectionalG'].value = 0.82;

    const sunPos = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(90 - (isCity ? 11 : 14));
    const theta = THREE.MathUtils.degToRad(isCity ? 205 : 142);
    sunPos.setFromSphericalCoords(1, phi, theta);
    skyUniforms['sunPosition'].value.copy(sunPos);

    this.scene.fog = new THREE.FogExp2(isCity ? 0x7a8ca8 : 0xcfa582, isCity ? 0.004 : 0.0044);

    this.hemiLight.color.setHex(isCity ? 0x9ac1ec : 0x8db9e8);
    this.hemiLight.groundColor.setHex(isCity ? 0x2b313c : 0x3f362d);
    this.hemiLight.intensity = isCity ? 0.94 : 0.88;

    this.sunLight.color.setHex(isCity ? 0xffd7ad : 0xffe1ba);
    this.sunLight.position.copy(sunPos).multiplyScalar(110);
    this.sunLight.intensity = isCity ? 2.2 : 2.1;

    this.rimLight.color.setHex(isCity ? 0x60a5fa : 0x9bc4f2);
    this.rimLight.intensity = isCity ? 0.65 : 0.55;
  }

  public setMap(mapId: MapId): void {
    if (this.disposed || mapId === this.mapId) return;
    this.mapId = mapId;
    this.track = createRallyTrack(480, mapId);
    this.envDispose();
    const env = buildCircuitEnvironment(this.scene, this.track, this.textures, this.isSoftwareGl);
    this.envDispose = env.dispose;
    this.applyMapAtmosphere(mapId);

    this.rebuildTrafficAndObstacles();
    this.resetGridPositions();
    this.refreshGhostVisuals();
    if (this.gameState === 'title') {
      this.snapTitleCamera();
    }
    this.emitMinimapTelemetry();
    this.emitHudSnapshot(true);
  }

  public setTotalLaps(laps: number): void {
    const safe = Math.max(1, Math.round(laps));
    if (safe === this.totalLaps) return;
    this.totalLaps = safe;
    this.refreshGhostVisuals();
  }

  public getTrack(): RallyTrack {
    return this.track;
  }

  public restartRace(): void {
    this.startRace(this.raceMode, this.totalLaps, true);
  }

  public returnToTitle(): void {
    this.gameState = 'title';
    this.audio.setPaused(true);
    this.resetGridPositions();
    this.snapTitleCamera();
  }

  public setPaused(paused: boolean): void {
    if (this.gameState !== 'playing' && this.gameState !== 'paused') return;
    this.gameState = paused ? 'paused' : 'playing';
    this.audio.setPaused(paused);
    this.updateGhostVisibility();
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public cycleCamera(): CameraMode {
    const order: CameraMode[] = ['chase', 'hood', 'bumper'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
    return this.cameraMode;
  }

  public hasReplay(): boolean {
    return Boolean(this.lastRunRecording && this.lastRunRecording.frames.length >= 2);
  }

  public startReplay(): boolean {
    if (!this.lastRunRecording || this.lastRunRecording.frames.length < 2) {
      return false;
    }
    this.gameState = 'replay';
    this.audio.setPaused(true);
    this.replayTimeMs = 0;
    this.replayDurationMs = this.lastRunRecording.totalTimeMs;
    this.replayPaused = false;
    this.replaySpeed = 1;
    this.replayCameraMode = 'broadcast';
    this.replayCamSnapped = false;
    this.replayOrbitAngle = 0;
    this.clearDustParticles();
    this.updateGhostVisibility();
    this.syncTrafficAndObstacles();

    const frame = sampleRunAtTime(this.lastRunRecording.frames, 0);
    if (frame) {
      this.applyReplayFrame(frame, 0.016);
      this.callbacks.onReplayTick?.(0, this.replayDurationMs, false, frame.lap);
    }
    return true;
  }

  public stopReplay(): void {
    if (this.gameState !== 'replay') return;
    this.gameState = 'gameover';
    this.audio.setPaused(true);
    this.updateGhostVisibility();
    this.syncTrafficAndObstacles();
  }

  public setReplayPaused(paused: boolean): void {
    if (this.gameState !== 'replay') return;
    if (!paused && this.replayTimeMs >= this.replayDurationMs) {
      this.replayTimeMs = 0;
      this.replayCamSnapped = false;
    }
    this.replayPaused = paused;
    this.callbacks.onReplayTick?.(
      this.replayTimeMs,
      this.replayDurationMs,
      this.replayPaused,
      sampleRunAtTime(this.lastRunRecording?.frames ?? [], this.replayTimeMs)?.lap ?? 1
    );
  }

  public setReplaySpeed(speed: 0.5 | 1 | 2): void {
    this.replaySpeed = speed;
  }

  public seekReplay(timeMs: number): void {
    if (this.gameState !== 'replay' || !this.lastRunRecording) return;
    this.replayTimeMs = Math.max(0, Math.min(this.replayDurationMs, timeMs));
    this.replayCamSnapped = false;
    const frame = sampleRunAtTime(this.lastRunRecording.frames, this.replayTimeMs);
    if (frame) {
      this.applyReplayFrame(frame, 0.016);
      this.callbacks.onReplayTick?.(
        this.replayTimeMs,
        this.replayDurationMs,
        this.replayPaused,
        frame.lap
      );
    }
  }

  public cycleReplayCamera(): ReplayCameraMode {
    const order: ReplayCameraMode[] = ['broadcast', 'heli', 'chase'];
    const idx = order.indexOf(this.replayCameraMode);
    this.replayCameraMode = order[(idx + 1) % order.length];
    this.replayCamSnapped = false;
    if (this.gameState === 'replay' && this.lastRunRecording) {
      const frame = sampleRunAtTime(this.lastRunRecording.frames, this.replayTimeMs);
      if (frame) {
        this.updateReplayCamera(frame, 0.05);
      }
    }
    return this.replayCameraMode;
  }

  public setControlInput(next: ControlInput): void {
    this.input = next;
  }

  public unlockAudio(): void {
    this.audio.unlock();
  }

  private spawnDust(x: number, y: number, z: number, vx: number, vz: number, scale: number): void {
    const p = this.dustPool[this.dustCursor];
    this.dustCursor = (this.dustCursor + 1) % this.dustPool.length;
    p.active = true;
    p.x = x + (Math.random() - 0.5) * 0.4;
    p.y = y + 0.18;
    p.z = z + (Math.random() - 0.5) * 0.4;
    p.vx = vx * 0.18 + (Math.random() - 0.5) * 1.4;
    p.vy = 0.8 + Math.random() * 1.2;
    p.vz = vz * 0.18 + (Math.random() - 0.5) * 1.4;
    p.age = 0;
    p.life = 0.45 + Math.random() * 0.35;
    p.scale = scale;
  }

  private syncCarVisual(rig: RallyCarRig, state: VehicleState, brakeStrength: number): void {
    rig.root.position.set(state.x, state.y, state.z);
    rig.root.rotation.y = state.heading;
    rig.chassisGroup.rotation.x = state.bodyPitch;
    rig.chassisGroup.rotation.z = state.bodyRoll;

    rig.frontLeftSteer.rotation.y = state.steerAngle;
    rig.frontRightSteer.rotation.y = state.steerAngle;
    for (const w of rig.wheelMeshes) {
      w.rotation.x = state.wheelRotation;
    }
    rig.brakeLightMat.emissiveIntensity = brakeStrength > 0.1 ? 3.2 : 0.65;
  }

  private syncRigFromPose(
    rig: RallyCarRig,
    pose: {
      x: number;
      y: number;
      z: number;
      heading: number;
      pitch: number;
      roll: number;
      steer: number;
      wheelRot: number;
    },
    brakeStrength: number
  ): void {
    rig.root.position.set(pose.x, pose.y, pose.z);
    rig.root.rotation.y = pose.heading;
    rig.chassisGroup.rotation.x = pose.pitch;
    rig.chassisGroup.rotation.z = pose.roll;
    rig.frontLeftSteer.rotation.y = pose.steer;
    rig.frontRightSteer.rotation.y = pose.steer;
    for (const w of rig.wheelMeshes) {
      w.rotation.x = pose.wheelRot;
    }
    rig.brakeLightMat.emissiveIntensity = brakeStrength > 0.1 ? 3.2 : 0.65;
  }

  private recordTelemetryFrame(brakeStrength: number): void {
    if (this.runFrames.length >= MAX_RUN_FRAMES) return;
    this.lastRecordTimeMs = this.totalTimeMs;
    const rivals =
      this.raceMode === 'race'
        ? this.rivalStates.map((r) => ({
            x: Number(r.x.toFixed(3)),
            y: Number(r.y.toFixed(3)),
            z: Number(r.z.toFixed(3)),
            heading: Number(r.heading.toFixed(4)),
            pitch: Number(r.bodyPitch.toFixed(3)),
            roll: Number(r.bodyRoll.toFixed(3)),
            steer: Number(r.steerAngle.toFixed(3)),
            wheelRot: Number(r.wheelRotation.toFixed(3)),
          }))
        : [];

    this.runFrames.push({
      t: Math.round(this.totalTimeMs),
      x: Number(this.playerState.x.toFixed(3)),
      y: Number(this.playerState.y.toFixed(3)),
      z: Number(this.playerState.z.toFixed(3)),
      heading: Number(this.playerState.heading.toFixed(4)),
      pitch: Number(this.playerState.bodyPitch.toFixed(3)),
      roll: Number(this.playerState.bodyRoll.toFixed(3)),
      steer: Number(this.playerState.steerAngle.toFixed(3)),
      wheelRot: Number(this.playerState.wheelRotation.toFixed(3)),
      speedKmh: Math.round(Math.abs(this.playerState.speed) * 3.6),
      rpm: Math.round(this.playerState.rpm),
      gear: this.playerState.gear,
      lap: Math.min(this.totalLaps, this.playerState.lap),
      progress: Number(this.playerState.progress.toFixed(4)),
      totalProgress: Number(this.playerState.totalProgress.toFixed(5)),
      brakeStrength: Number(brakeStrength.toFixed(2)),
      surface: this.playerState.surface,
      rivals,
    });
  }

  private syncGhostToTime(timeMs: number): void {
    if (!this.activeGhost || !this.ghostEnabled) {
      this.ghostCar.root.visible = false;
      this.currentGhostPose = null;
      this.currentGhostDeltaMs = null;
      return;
    }

    const gf = sampleGhostAtTime(this.activeGhost.frames, timeMs);
    if (!gf) {
      this.ghostCar.root.visible = false;
      this.currentGhostPose = null;
      this.currentGhostDeltaMs = null;
      return;
    }

    this.ghostCar.root.visible = true;
    this.syncRigFromPose(this.ghostCar, gf, 0);
    this.currentGhostPose = { x: gf.x, z: gf.z, heading: gf.heading };
    this.currentGhostDeltaMs = computeGhostDeltaMs(
      this.activeGhost.frames,
      this.playerState.totalProgress,
      this.totalTimeMs
    );
  }

  private applyReplayFrame(frame: TelemetrySample, dt: number): void {
    this.syncRigFromPose(this.playerCar, frame, frame.brakeStrength);
    for (let i = 0; i < this.rivalRigs.length; i++) {
      const rival = frame.rivals[i];
      if (rival && this.lastRunRecording?.mode === 'race') {
        this.rivalRigs[i].root.visible = true;
        this.syncRigFromPose(this.rivalRigs[i], rival, 0);
      } else {
        this.rivalRigs[i].root.visible = false;
      }
    }

    this.sunLight.target.position.set(frame.x, frame.y, frame.z);
    this.sunLight.position.set(frame.x + 62, frame.y + 38, frame.z - 48);

    this.updateReplayCamera(frame, dt);

    this.callbacks.onFastTelemetry(frame.speedKmh, frame.rpm, frame.gear);
    this.callbacks.onFastMinimap({
      playerX: frame.x,
      playerZ: frame.z,
      playerHeading: frame.heading,
      rivals:
        this.lastRunRecording?.mode === 'race'
          ? frame.rivals.map((r) => ({ x: r.x, z: r.z }))
          : [],
      ghost: null,
    });
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    if (this.gameState === 'title') {
      // Live world camera flyover while hero car cruises smoothly around circuit
      this.titleTourT += dt;
      this.playerState = stepAiVehicle(this.playerState, this.track, dt, 0.0, 0.82);
      this.syncCarVisual(this.playerCar, this.playerState, 0);

      for (let i = 0; i < this.rivalRigs.length; i++) {
        this.rivalRigs[i].root.visible = true;
        this.rivalStates[i] = stepAiVehicle(
          this.rivalStates[i],
          this.track,
          dt,
          this.rivalLanes[i],
          this.rivalPaces[i]
        );
        this.syncCarVisual(this.rivalRigs[i], this.rivalStates[i], 0);
      }

      const trackLen = Math.max(100, this.track.totalLength);
      for (let i = 0; i < this.trafficCars.length; i++) {
        const car = this.trafficCars[i];
        car.progress = (car.progress + (car.speedMps * dt) / trackLen) % 1;
        const s = this.track.sampleAtProgress(car.progress);
        car.x = s.x + s.nx * car.laneOffset;
        car.y = s.y;
        car.z = s.z + s.nz * car.laneOffset;
        car.heading = Math.atan2(s.tx, s.tz);
        car.wheelRotation += car.speedMps * dt * 2.8;
      }
      this.syncTrafficAndObstacles();

      // Smooth scenic chase-orbit flyover around the canyon & hero car
      const orbitAngle = this.titleTourT * 0.22;
      const dist = 11.5;
      const cx = this.playerState.x + Math.sin(orbitAngle) * dist;
      const cz = this.playerState.z + Math.cos(orbitAngle) * dist;
      const groundFloor = this.track.groundHeightAt(cx, cz) + 2.6;
      _camTargetPos.set(
        cx,
        Math.max(groundFloor, this.playerState.y + 4.4 + Math.sin(this.titleTourT * 0.4) * 1.0),
        cz
      );
      this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-3.5 * dt));
      this.camera.lookAt(
        this.playerState.x,
        this.playerState.y + 1.1,
        this.playerState.z
      );
      this.updateDustParticles(dt);
    } else if (this.gameState === 'playing') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      } else {
        const simRes = stepVehiclePhysics(this.playerState, this.input, this.track, dt);
        this.playerState = simRes.state;
        const proj = simRes.proj;

        this.totalTimeMs += dt * 1000;
        const currentLapElapsed = this.totalTimeMs - this.lapStartMs;

        if (simRes.event.wallHitStrength > 0) {
          this.trauma = Math.min(1, this.trauma + 0.45 + simRes.event.wallHitStrength * 0.45);
          this.hitstopTimer = 0.035;
          this.audio.playImpact(simRes.event.wallHitStrength);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.(Math.round(25 + simRes.event.wallHitStrength * 45));
          }
        }

        if (simRes.event.completedLap) {
          this.score += 1000;
          if (this.bestLapMs === null || currentLapElapsed < this.bestLapMs) {
            this.bestLapMs = currentLapElapsed;
          }
          this.lapStartMs = this.totalTimeMs;

          const finishedRace = this.playerState.lap > this.totalLaps;
          this.audio.playLapChime(finishedRace);

          if (finishedRace) {
            this.finishRace('finished');
          }
        }

        // Step traffic vehicles & road obstacles + award score & near-miss overtakes
        const trafficRes = stepTrafficAndObstacles(
          this.track,
          this.trafficCars,
          this.roadObstacles,
          this.playerState,
          this.combo,
          dt
        );
        this.score += trafficRes.scoreDelta;
        this.combo = trafficRes.combo;
        this.overtakes += trafficRes.overtakesDelta;
        if (trafficRes.hitStrength > 0) {
          this.trauma = Math.min(1, this.trauma + trafficRes.hitStrength * 0.45);
          this.audio.playImpact(trafficRes.hitStrength);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.(Math.round(18 + trafficRes.hitStrength * 35));
          }
        }
        if (trafficRes.overtakesDelta > 0) {
          this.audio.playCountdownBeep(true);
        }
        this.syncTrafficAndObstacles();

        // Update AI rivals & resolve soft car-to-car bumper interactions
        if (this.raceMode === 'race') {
          for (let i = 0; i < this.rivalStates.length; i++) {
            this.rivalStates[i] = stepAiVehicle(
              this.rivalStates[i],
              this.track,
              dt,
              this.rivalLanes[i],
              this.rivalPaces[i]
            );

            // Car-to-car bump check
            const dx = this.playerState.x - this.rivalStates[i].x;
            const dz = this.playerState.z - this.rivalStates[i].z;
            const distSq = dx * dx + dz * dz;
            const minSep = 2.5;
            if (distSq > 0.01 && distSq < minSep * minSep) {
              const dist = Math.sqrt(distSq);
              const nx = dx / dist;
              const nz = dz / dist;
              const push = (minSep - dist) * 0.5;
              this.playerState.x += nx * push;
              this.playerState.z += nz * push;
              this.rivalStates[i].x -= nx * push;
              this.rivalStates[i].z -= nz * push;
              this.playerState.vx += nx * 3.2;
              this.playerState.vz += nz * 3.2;
              this.trauma = Math.min(1, this.trauma + 0.28);
              this.audio.playImpact(0.35);
            }

            this.syncCarVisual(this.rivalRigs[i], this.rivalStates[i], 0);
          }
        }

        // Spawn gravel/drift dust behind rear wheels
        const speedAbs = Math.abs(this.playerState.speed);
        if (
          speedAbs > 5 &&
          (this.playerState.surface !== 'asphalt' || this.playerState.slipAngle > 0.18 || this.input.handbrake)
        ) {
          const fx = Math.sin(this.playerState.heading);
          const fz = Math.cos(this.playerState.heading);
          const rx = -fz;
          const rz = fx;
          const rearX = this.playerState.x - fx * 1.65;
          const rearZ = this.playerState.z - fz * 1.65;
          const dustScale = this.playerState.surface === 'asphalt' ? 0.45 : 0.75;
          this.spawnDust(rearX + rx * 0.85, this.playerState.y, rearZ + rz * 0.85, this.playerState.vx, this.playerState.vz, dustScale);
          this.spawnDust(rearX - rx * 0.85, this.playerState.y, rearZ - rz * 0.85, this.playerState.vx, this.playerState.vz, dustScale);
        }

        this.syncCarVisual(this.playerCar, this.playerState, this.input.brake);
        this.syncGhostToTime(this.totalTimeMs);
        if (this.totalTimeMs - this.lastRecordTimeMs >= RECORD_INTERVAL_MS) {
          this.recordTelemetryFrame(this.input.brake);
        }

        this.audio.updateTelemetry(
          this.playerState.rpm,
          this.input.throttle,
          this.playerState.slipAngle,
          this.playerState.surface !== 'asphalt',
          this.playerState.gear
        );

        // Update directional shadow target to track player tightly
        this.sunLight.target.position.set(this.playerState.x, this.playerState.y, this.playerState.z);
        this.sunLight.position.set(
          this.playerState.x + 62,
          this.playerState.y + 38,
          this.playerState.z - 48
        );

        this.updateGameplayCamera(dt);
        this.updateDustParticles(dt);

        this.callbacks.onFastTelemetry(
          Math.round(speedAbs * 3.6),
          Math.round(this.playerState.rpm),
          this.playerState.gear
        );
        this.emitMinimapTelemetry();

        if (now - this.lastHudEmit > 95) {
          this.lastHudEmit = now;
          this.emitHudSnapshot(false, proj);
        }
      }
    } else if (this.gameState === 'replay' && this.lastRunRecording) {
      if (!this.replayPaused) {
        this.replayTimeMs += dt * 1000 * this.replaySpeed;
        if (this.replayTimeMs >= this.replayDurationMs) {
          this.replayTimeMs = this.replayDurationMs;
          this.replayPaused = true;
        }
      }

      const frame = sampleRunAtTime(this.lastRunRecording.frames, this.replayTimeMs);
      if (frame) {
        this.applyReplayFrame(frame, dt);
        this.callbacks.onReplayTick?.(
          this.replayTimeMs,
          this.replayDurationMs,
          this.replayPaused,
          frame.lap
        );
        if (now - this.lastHudEmit > 95) {
          this.lastHudEmit = now;
          const proj = this.track.project(frame.x, frame.z);
          this.callbacks.onHudUpdate({
            speedKmh: frame.speedKmh,
            rpm: frame.rpm,
            gear: frame.gear,
            lap: Math.min(this.lastRunRecording.totalLaps, frame.lap),
            totalLaps: this.lastRunRecording.totalLaps,
            position: 1,
            totalCars: this.lastRunRecording.mode === 'race' ? 1 + frame.rivals.length : 1,
            lapTimeMs: this.replayTimeMs,
            totalTimeMs: this.replayTimeMs,
            bestLapMs: this.lastRunRecording.bestLapMs,
            surface: frame.surface,
            paceNote: proj.paceNote,
            countdown: 0,
            wrongWay: false,
            ghostDeltaMs: null,
            hasGhost: false,
            score: 0,
            combo: 1,
            overtakes: 0,
          });
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
    if (!this.sceneReadyEmitted) {
      this.sceneReadyEmitted = true;
      this.callbacks.onSceneReady?.();
    }
    this.scheduleNextTick();
  };

  private updateGameplayCamera(dt: number): void {
    const fx = Math.sin(this.playerState.heading);
    const fz = Math.cos(this.playerState.heading);
    const speedAbs = Math.abs(this.playerState.speed);

    if (this.cameraMode === 'chase') {
      const dist = 7.6 + Math.min(1.8, speedAbs * 0.045);
      const height = 3.05;
      _camTargetPos.set(
        this.playerState.x - fx * dist,
        this.playerState.y + height,
        this.playerState.z - fz * dist
      );
      const terrainFloor = this.track.groundHeightAt(_camTargetPos.x, _camTargetPos.z) + 1.2;
      if (_camTargetPos.y < terrainFloor) _camTargetPos.y = terrainFloor;

      const damp = 1 - Math.exp(-9.5 * dt);
      this.camera.position.lerp(_camTargetPos, damp);

      _camLookTarget.set(
        this.playerState.x + fx * 9.5,
        this.playerState.y + 1.25,
        this.playerState.z + fz * 9.5
      );
      this.camera.lookAt(_camLookTarget);
    } else if (this.cameraMode === 'hood') {
      this.camera.position.set(
        this.playerState.x + fx * 0.4,
        this.playerState.y + 1.52,
        this.playerState.z + fz * 0.4
      );
      _camLookTarget.set(
        this.playerState.x + fx * 22,
        this.playerState.y + 1.15,
        this.playerState.z + fz * 22
      );
      this.camera.lookAt(_camLookTarget);
    } else {
      // Bumper cam
      this.camera.position.set(
        this.playerState.x + fx * 2.15,
        this.playerState.y + 0.85,
        this.playerState.z + fz * 2.15
      );
      _camLookTarget.set(
        this.playerState.x + fx * 24,
        this.playerState.y + 0.85,
        this.playerState.z + fz * 24
      );
      this.camera.lookAt(_camLookTarget);
    }

    // Dynamic speed FOV widening + decaying trauma shake
    const targetFov = 61 + Math.min(13, speedAbs * 0.32);
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-6 * dt));
    this.camera.updateProjectionMatrix();

    if (this.trauma > 0.001) {
      const shake = this.trauma * this.trauma;
      this.camera.rotation.z += (Math.random() - 0.5) * 0.06 * shake;
      this.camera.rotation.x += (Math.random() - 0.5) * 0.04 * shake;
      this.trauma = Math.max(0, this.trauma - dt * 2.4);
    }
  }

  private updateReplayCamera(frame: TelemetrySample, dt: number): void {
    if (this.replayCameraMode === 'broadcast') {
      const distToCam = this.replayCamSnapped
        ? Math.hypot(
            frame.x - this.replayCamAnchor.x,
            frame.z - this.replayCamAnchor.z
          )
        : Infinity;

      if (!this.replayCamSnapped || distToCam > 44) {
        const aheadProgress = (frame.progress + 0.036) % 1;
        const s = this.track.sampleAtProgress(aheadProgress);
        const side = s.curvature >= 0 ? -1 : 1;
        const lateral = s.halfWidth + 3.6;
        const cx = s.x + s.nx * side * lateral;
        const cz = s.z + s.nz * side * lateral;
        const terrainFloor = this.track.groundHeightAt(cx, cz) + 2.8;
        const cy = Math.max(terrainFloor, s.y + 4.8);
        this.replayCamAnchor.set(cx, cy, cz);
        this.camera.position.copy(this.replayCamAnchor);
        this.replayCamSnapped = true;
      }

      _camLookTarget.set(frame.x, frame.y + 1.05, frame.z);
      this.camera.lookAt(_camLookTarget);

      const d = Math.hypot(
        frame.x - this.camera.position.x,
        frame.z - this.camera.position.z
      );
      const targetFov = Math.max(42, Math.min(58, 60 - d * 0.35));
      this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-5 * dt));
      this.camera.updateProjectionMatrix();
    } else if (this.replayCameraMode === 'heli') {
      if (!this.replayPaused) {
        this.replayOrbitAngle += dt * 0.28 * this.replaySpeed;
      }
      const dist = 18.5;
      const cx = frame.x + Math.sin(this.replayOrbitAngle) * dist;
      const cz = frame.z + Math.cos(this.replayOrbitAngle) * dist;
      const floor = this.track.groundHeightAt(cx, cz) + 7.5;
      _camTargetPos.set(cx, Math.max(floor, frame.y + 11.2), cz);

      if (!this.replayCamSnapped) {
        this.camera.position.copy(_camTargetPos);
        this.replayCamSnapped = true;
      } else {
        this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-4.5 * dt));
      }
      _camLookTarget.set(frame.x, frame.y + 1.0, frame.z);
      this.camera.lookAt(_camLookTarget);
      this.camera.fov += (58 - this.camera.fov) * (1 - Math.exp(-5 * dt));
      this.camera.updateProjectionMatrix();
    } else {
      // Dynamic chase cam
      const fx = Math.sin(frame.heading);
      const fz = Math.cos(frame.heading);
      const dist = 7.8;
      _camTargetPos.set(frame.x - fx * dist, frame.y + 3.15, frame.z - fz * dist);
      const floor = this.track.groundHeightAt(_camTargetPos.x, _camTargetPos.z) + 1.2;
      if (_camTargetPos.y < floor) _camTargetPos.y = floor;

      if (!this.replayCamSnapped) {
        this.camera.position.copy(_camTargetPos);
        this.replayCamSnapped = true;
      } else {
        this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-9 * dt));
      }
      _camLookTarget.set(frame.x + fx * 9.5, frame.y + 1.2, frame.z + fz * 9.5);
      this.camera.lookAt(_camLookTarget);
      const targetFov = 61 + Math.min(11, frame.speedKmh * 0.08);
      this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-6 * dt));
      this.camera.updateProjectionMatrix();
    }
  }

  private updateDustParticles(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.dustPool.length; i++) {
      const p = this.dustPool[i];
      if (!p.active) continue;
      dirty = true;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        _dustDummy.position.set(0, -50, 0);
        _dustDummy.scale.setScalar(0.001);
        _dustDummy.updateMatrix();
        this.dustMesh.setMatrixAt(i, _dustDummy.matrix);
      } else {
        const t = p.age / p.life;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        const s = p.scale * (0.6 + t * 1.4) * (1 - t * 0.5);
        _dustDummy.position.set(p.x, p.y, p.z);
        _dustDummy.rotation.set(t * 2, t * 3, 0);
        _dustDummy.scale.setScalar(Math.max(0.01, s));
        _dustDummy.updateMatrix();
        this.dustMesh.setMatrixAt(i, _dustDummy.matrix);
      }
    }
    if (dirty) {
      this.dustMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private computeRacePosition(): number {
    if (this.raceMode !== 'race') return 1;
    let pos = 1;
    for (const rival of this.rivalStates) {
      if (rival.totalProgress > this.playerState.totalProgress) {
        pos += 1;
      }
    }
    return pos;
  }

  private emitMinimapTelemetry(): void {
    this.callbacks.onFastMinimap({
      playerX: this.playerState.x,
      playerZ: this.playerState.z,
      playerHeading: this.playerState.heading,
      rivals:
        this.raceMode === 'race'
          ? this.rivalStates.map((r) => ({ x: r.x, z: r.z }))
          : [],
      ghost: this.currentGhostPose,
    });
  }

  private emitHudSnapshot(force = false, projOverride?: ReturnType<RallyTrack['project']>): void {
    const proj = projOverride ?? this.track.project(this.playerState.x, this.playerState.z, this.playerState.sampleIndex);
    const fx = Math.sin(this.playerState.heading);
    const fz = Math.cos(this.playerState.heading);
    const dot = fx * proj.tx + fz * proj.tz;
    const wrongWay = this.playerState.speed > 4 && dot < -0.35;

    if (force) {
      this.lastHudEmit = performance.now();
    }

    this.callbacks.onHudUpdate({
      speedKmh: Math.round(Math.abs(this.playerState.speed) * 3.6),
      rpm: Math.round(this.playerState.rpm),
      gear: this.playerState.gear,
      lap: Math.min(this.totalLaps, this.playerState.lap),
      totalLaps: this.totalLaps,
      position: this.computeRacePosition(),
      totalCars: this.raceMode === 'race' ? 1 + this.rivalStates.length : 1,
      lapTimeMs: Math.max(0, this.totalTimeMs - this.lapStartMs),
      totalTimeMs: this.totalTimeMs,
      bestLapMs: this.bestLapMs,
      surface: this.playerState.surface,
      paceNote: proj.paceNote,
      countdown: 0,
      wrongWay,
      ghostDeltaMs: this.currentGhostDeltaMs,
      hasGhost: Boolean(this.activeGhost),
      score: Math.round(this.score),
      combo: this.combo,
      overtakes: this.overtakes,
    });
  }

  private finishRace(outcome: 'finished' | 'timeout'): void {
    // Capture final finish-line pose cleanly before saving telemetry & PB ghost
    this.recordTelemetryFrame(this.input.brake);
    this.lastRunRecording = {
      mapId: this.mapId,
      mode: this.raceMode,
      totalLaps: this.totalLaps,
      totalTimeMs: Math.round(this.totalTimeMs),
      bestLapMs: this.bestLapMs !== null ? Math.round(this.bestLapMs) : null,
      frames: this.runFrames.slice(),
    };

    const ghostSave = saveBestGhostIfFaster(this.lastRunRecording);
    if (ghostSave.updated && ghostSave.ghost) {
      this.activeGhost = ghostSave.ghost;
      this.rebuildGhostTrajectory(this.activeGhost);
      this.callbacks.onGhostUpdated?.(this.activeGhost);
    }

    this.gameState = 'gameover';
    this.audio.setPaused(true);
    this.updateGhostVisibility();

    const snapshot: RaceResultSnapshot = {
      mapId: this.mapId,
      mode: this.raceMode,
      outcome,
      position: this.computeRacePosition(),
      totalCars: this.raceMode === 'race' ? 1 + this.rivalStates.length : 1,
      totalTimeMs: Math.round(this.totalTimeMs),
      bestLapMs: this.bestLapMs !== null ? Math.round(this.bestLapMs) : null,
      topSpeedKmh: Math.round(this.playerState.topSpeedKmh),
      lapsCompleted: this.totalLaps,
      totalLaps: this.totalLaps,
      isNewGhostPb: ghostSave.updated,
      score: Math.round(this.score),
      overtakes: this.overtakes,
    };
    this.callbacks.onRaceComplete(snapshot);
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (status === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    window.removeEventListener('orientationchange', this.handleOrientationResize);
    window.visualViewport?.removeEventListener('resize', this.handleOrientationResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.playerCar.dispose();
    this.ghostCar.dispose();
    this.disposeGhostTrajectory();
    this.rivalRigs.forEach((r) => r.dispose());
    this.trafficRigs.forEach((r) => r.dispose());
    this.obstacleRigs.forEach((r) => r.dispose());
    this.dustGeo.dispose();
    this.dustMat.dispose();
    this.envMap.dispose();
    this.textures.dispose();
    this.envDispose();
    this.audio.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
