import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RallyGameEngine } from './game/engine';
import { createRallyTrack } from './game/track';
import {
  buildGhostMinimapPath,
  buildMinimapGeometry,
  computeStageSummary,
  headingToMinimapDeg,
  worldToMinimap,
} from './game/minimap';
import { formatRaceTime } from './components/formatTime';
import {
  MAP_INFO,
  type CameraMode,
  type GameState,
  type GhostData,
  type HudSnapshot,
  type MapId,
  type RaceMode,
  type RaceResultSnapshot,
  type ReplayCameraMode,
} from './game/types';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInWithGoogle, signOutDriver } from './firebase';
import {
  deleteStageRecord,
  saveStageResultToFirestore,
  subscribeDriverProfile,
  subscribeRecentStageRecords,
  type DriverProfileData,
  type StageRecordData,
} from './game/records';
import { TitleScreen } from './components/TitleScreen';
import { GameHud } from './components/GameHud';
import { TouchControls, type TouchPadState } from './components/TouchControls';
import { GameModals } from './components/GameModals';
import { LoadingScreen } from './components/LoadingScreen';
import { StageLaunchBanner } from './components/StageLaunchBanner';
import { ReplayControls } from './components/ReplayControls';
import { LandscapeGuard } from './components/LandscapeGuard';

const INITIAL_HUD: HudSnapshot = {
  speedKmh: 0,
  rpm: 1150,
  gear: 1,
  lap: 1,
  totalLaps: 2,
  position: 1,
  totalCars: 3,
  lapTimeMs: 0,
  totalTimeMs: 0,
  bestLapMs: null,
  surface: 'asphalt',
  paceNote: null,
  countdown: 0,
  wrongWay: false,
  ghostDeltaMs: null,
  hasGhost: false,
  score: 0,
  combo: 1,
  overtakes: 0,
};

const EMPTY_TOUCH: TouchPadState = {
  left: false,
  right: false,
  gas: false,
  brake: false,
  handbrake: false,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RallyGameEngine | null>(null);

  // Direct DOM refs for 60Hz telemetry without React reconciliation
  const speedRef = useRef<HTMLSpanElement | null>(null);
  const gearRef = useRef<HTMLSpanElement | null>(null);
  const rpmBarRef = useRef<HTMLDivElement | null>(null);
  const playerMarkerRef = useRef<SVGGElement | null>(null);
  const rival1Ref = useRef<SVGCircleElement | null>(null);
  const rival2Ref = useRef<SVGCircleElement | null>(null);
  const ghostMarkerRef = useRef<SVGGElement | null>(null);
  const scrubberRef = useRef<HTMLInputElement | null>(null);
  const replayTimeRef = useRef<HTMLSpanElement | null>(null);

  const initialMapParam: MapId = useMemo(() => {
    if (typeof window === 'undefined') return 'alpine';
    return new URLSearchParams(window.location.search).get('map') === 'city' ? 'city' : 'alpine';
  }, []);

  const [mapId, setMapId] = useState<MapId>(initialMapParam);
  const mapInfo = MAP_INFO[mapId];

  const activeTrack = useMemo(() => createRallyTrack(480, mapId), [mapId]);
  const minimapGeometry = useMemo(() => buildMinimapGeometry(activeTrack), [activeTrack]);
  const minimapBoundsRef = useRef(minimapGeometry.bounds);

  useEffect(() => {
    minimapBoundsRef.current = minimapGeometry.bounds;
  }, [minimapGeometry.bounds]);

  const isAutostart = useMemo(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1',
    []
  );

  const [gameState, setGameState] = useState<GameState>('title');
  const [raceMode, setRaceMode] = useState<RaceMode>('race');
  const [laps, setLaps] = useState<number>(2);
  const stageSummary = useMemo(
    () => computeStageSummary(activeTrack, laps),
    [activeTrack, laps]
  );
  const [sceneReady, setSceneReady] = useState<boolean>(isAutostart);
  const [loaderFading, setLoaderFading] = useState<boolean>(false);
  const [loaderDismissed, setLoaderDismissed] = useState<boolean>(isAutostart);
  const [launchKey, setLaunchKey] = useState<number>(0);
  const [showLaunchBanner, setShowLaunchBanner] = useState<boolean>(false);
  const launchTimerRef = useRef<number | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [muted, setMuted] = useState<boolean>(false);
  const [touchEnabled, setTouchEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 900 || navigator.maxTouchPoints > 0;
  });
  const manualTouchOverrideRef = useRef<boolean>(false);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [result, setResult] = useState<RaceResultSnapshot | null>(null);
  const [contextLost, setContextLost] = useState<boolean>(false);

  // Ghost Car & Post-Race Replay state
  const [ghostData, setGhostData] = useState<GhostData | null>(null);
  const [ghostEnabled, setGhostEnabled] = useState<boolean>(true);
  const ghostEnabledRef = useRef<boolean>(true);
  const [hasReplay, setHasReplay] = useState<boolean>(false);
  const [replayPaused, setReplayPaused] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<0.5 | 1 | 2>(1);
  const [replayCamera, setReplayCamera] = useState<ReplayCameraMode>('broadcast');
  const [replayDurationMs, setReplayDurationMs] = useState<number>(0);

  const ghostPathD = useMemo(
    () => (ghostData ? buildGhostMinimapPath(ghostData.frames, minimapGeometry.bounds) : ''),
    [ghostData, minimapGeometry.bounds]
  );

  // Firebase Auth & Cloud Logbook state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authBusy, setAuthBusy] = useState<boolean>(false);
  const [driverProfile, setDriverProfile] = useState<DriverProfileData | null>(null);
  const [recentRecords, setRecentRecords] = useState<StageRecordData[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [fatalError, setFatalError] = useState<Error | null>(null);

  // Mutable refs for keyboard + touch merging & event listener closure safety
  const gameStateRef = useRef<GameState>('title');
  const raceModeRef = useRef<RaceMode>('race');
  const lapsRef = useRef<number>(2);
  const mutedRef = useRef<boolean>(false);
  const userRef = useRef<User | null>(null);
  const resultRef = useRef<RaceResultSnapshot | null>(null);
  const keysPressedRef = useRef<Set<string>>(new Set());
  const touchStateRef = useRef<TouchPadState>(EMPTY_TOUCH);

  useEffect(() => {
    ghostEnabledRef.current = ghostEnabled;
  }, [ghostEnabled]);

  useEffect(() => {
    gameStateRef.current = gameState;
    document.body.dataset.state = gameState;
  }, [gameState]);

  useEffect(() => {
    raceModeRef.current = raceMode;
  }, [raceMode]);

  useEffect(() => {
    lapsRef.current = laps;
  }, [laps]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      userRef.current = nextUser;
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setDriverProfile(null);
        setRecentRecords([]);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;
    const unsubProfile = subscribeDriverProfile(
      user.uid,
      setDriverProfile,
      (err) => setFatalError(err)
    );
    const unsubRecords = subscribeRecentStageRecords(
      user.uid,
      setRecentRecords,
      (err) => setFatalError(err)
    );
    return () => {
      unsubProfile();
      unsubRecords();
    };
  }, [authReady, user]);

  const persistResult = useCallback(async (activeUser: User, raceResult: RaceResultSnapshot) => {
    setSaveStatus('saving');
    try {
      await saveStageResultToFirestore(activeUser, raceResult);
      setSaveStatus('saved');
    } catch (error) {
      console.error('Failed to save stage result:', error);
      setSaveStatus('error');
    }
  }, []);

  const handleSignIn = useCallback(async () => {
    setAuthBusy(true);
    try {
      const signedInUser = await signInWithGoogle();
      userRef.current = signedInUser;
      if (gameStateRef.current === 'gameover' && resultRef.current) {
        await persistResult(signedInUser, resultRef.current);
      }
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        console.error('Sign-in failed:', error);
      }
    } finally {
      setAuthBusy(false);
    }
  }, [persistResult]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOutDriver();
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  }, []);

  const handleDeleteRecord = useCallback(async (recordId: string) => {
    try {
      await deleteStageRecord(recordId);
    } catch (error) {
      setFatalError(error instanceof Error ? error : new Error(String(error)));
    }
  }, []);

  const syncControlInput = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const keys = keysPressedRef.current;
    const touch = touchStateRef.current;

    const up = keys.has('KeyW') || keys.has('ArrowUp') || touch.gas;
    const down = keys.has('KeyS') || keys.has('ArrowDown') || touch.brake;
    const left = keys.has('KeyA') || keys.has('ArrowLeft') || touch.left;
    const right = keys.has('KeyD') || keys.has('ArrowRight') || touch.right;
    const handbrake = keys.has('Space') || touch.handbrake;

    engine.setControlInput({
      throttle: up ? 1 : 0,
      brake: down ? 1 : 0,
      steer: (right ? 1 : 0) - (left ? 1 : 0),
      handbrake,
    });
  }, []);

  const triggerLaunchBanner = useCallback(() => {
    if (launchTimerRef.current !== null) {
      window.clearTimeout(launchTimerRef.current);
    }
    setLaunchKey((k) => k + 1);
    setShowLaunchBanner(true);
    launchTimerRef.current = window.setTimeout(() => {
      setShowLaunchBanner(false);
      launchTimerRef.current = null;
    }, 1550);
  }, []);

  useEffect(() => {
    if (isAutostart || loaderDismissed) return;
    if (!sceneReady) {
      const safetyTimer = window.setTimeout(() => setSceneReady(true), 2400);
      return () => window.clearTimeout(safetyTimer);
    }
    const fadeTimer = window.setTimeout(() => setLoaderFading(true), 420);
    const dismissTimer = window.setTimeout(() => setLoaderDismissed(true), 780);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(dismissTimer);
    };
  }, [isAutostart, loaderDismissed, sceneReady]);

  useEffect(() => {
    return () => {
      if (launchTimerRef.current !== null) {
        window.clearTimeout(launchTimerRef.current);
      }
    };
  }, []);

  const clearInputs = useCallback(() => {
    keysPressedRef.current.clear();
    touchStateRef.current = EMPTY_TOUCH;
    syncControlInput();
  }, [syncControlInput]);

  const handleStart = useCallback(() => {
    const activeEl = document.activeElement as HTMLElement | null;
    activeEl?.blur?.();
    try {
      const orientation = window.screen?.orientation as unknown as {
        lock?: (mode: string) => Promise<void>;
      };
      void orientation?.lock?.('landscape')?.catch?.(() => {});
    } catch {
      // Ignore unsupported orientation lock in desktop/non-fullscreen browsers
    }
    clearInputs();
    resultRef.current = null;
    setResult(null);
    setHasReplay(false);
    setSaveStatus('idle');
    setGameState('playing');
    document.body.dataset.state = 'playing';
    triggerLaunchBanner();
    engineRef.current?.startRace(raceModeRef.current, lapsRef.current);
  }, [clearInputs, triggerLaunchBanner]);

  const handlePauseToggle = useCallback(() => {
    const current = gameStateRef.current;
    if (current === 'playing') {
      clearInputs();
      setGameState('paused');
      engineRef.current?.setPaused(true);
    } else if (current === 'paused') {
      clearInputs();
      setGameState('playing');
      engineRef.current?.setPaused(false);
    }
  }, [clearInputs]);

  const handleRestart = useCallback(() => {
    const activeEl = document.activeElement as HTMLElement | null;
    activeEl?.blur?.();
    clearInputs();
    resultRef.current = null;
    setResult(null);
    setHasReplay(false);
    setSaveStatus('idle');
    setGameState('playing');
    triggerLaunchBanner();
    engineRef.current?.restartRace();
  }, [clearInputs, triggerLaunchBanner]);

  const handleReturnTitle = useCallback(() => {
    clearInputs();
    resultRef.current = null;
    setResult(null);
    setHasReplay(false);
    setSaveStatus('idle');
    setShowLaunchBanner(false);
    setGameState('title');
    engineRef.current?.returnToTitle();
  }, [clearInputs]);

  const handleCycleCamera = useCallback(() => {
    const next = engineRef.current?.cycleCamera();
    if (next) setCameraMode(next);
  }, []);

  const handleToggleGhost = useCallback(() => {
    const next = !ghostEnabledRef.current;
    ghostEnabledRef.current = next;
    setGhostEnabled(next);
    engineRef.current?.setGhostEnabled(next);
  }, []);

  const handleWatchReplay = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    clearInputs();
    if (engine.startReplay()) {
      setReplayPaused(false);
      setReplaySpeed(1);
      setReplayCamera('broadcast');
      setReplayDurationMs(resultRef.current?.totalTimeMs ?? 0);
      setGameState('replay');
    }
  }, [clearInputs]);

  const handleExitReplay = useCallback(() => {
    engineRef.current?.stopReplay();
    setGameState('gameover');
  }, []);

  const handleReplayTogglePlay = useCallback(() => {
    setReplayPaused((prev) => {
      const next = !prev;
      engineRef.current?.setReplayPaused(next);
      return next;
    });
  }, []);

  const handleReplaySelectSpeed = useCallback((speed: 0.5 | 1 | 2) => {
    setReplaySpeed(speed);
    engineRef.current?.setReplaySpeed(speed);
  }, []);

  const handleReplayCycleCamera = useCallback(() => {
    const next = engineRef.current?.cycleReplayCamera();
    if (next) setReplayCamera(next);
  }, []);

  const handleReplaySeek = useCallback((timeMs: number) => {
    engineRef.current?.seekReplay(timeMs);
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    engineRef.current?.setMuted(next);
  }, []);

  const handleToggleTouch = useCallback(() => {
    manualTouchOverrideRef.current = true;
    setTouchEnabled((prev) => !prev);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (!manualTouchOverrideRef.current) {
        setTouchEnabled(window.innerWidth <= 900 || navigator.maxTouchPoints > 0);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Prevent accidental pinch-zoom, browser wheel zoom, or gesture scroll during play
  useEffect(() => {
    const preventGesture = (e: Event) => {
      e.preventDefault();
    };
    const preventWheelZoom = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    window.addEventListener('wheel', preventWheelZoom, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      window.removeEventListener('wheel', preventWheelZoom);
    };
  }, []);

  // Mount Three.js engine once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new RallyGameEngine(container, {
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onFastTelemetry: (speedKmh, rpm, gear) => {
        if (speedRef.current) {
          speedRef.current.textContent = String(speedKmh);
        }
        if (gearRef.current) {
          gearRef.current.textContent = String(gear);
        }
        if (rpmBarRef.current) {
          const ratio = Math.max(0.08, Math.min(1, rpm / 8200));
          rpmBarRef.current.style.transform = `scaleX(${ratio.toFixed(3)})`;
          rpmBarRef.current.style.backgroundColor =
            rpm > 6800 ? '#ef4444' : rpm > 5400 ? '#f59e0b' : '#e05a2b';
        }
      },
      onFastMinimap: (payload) => {
        const bounds = minimapBoundsRef.current;
        if (playerMarkerRef.current) {
          const pt = worldToMinimap(
            payload.playerX,
            payload.playerZ,
            bounds
          );
          const deg = headingToMinimapDeg(payload.playerHeading);
          playerMarkerRef.current.setAttribute(
            'transform',
            `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) rotate(${deg.toFixed(1)})`
          );
        }
        const rivalRefs = [rival1Ref.current, rival2Ref.current];
        for (let i = 0; i < rivalRefs.length; i++) {
          const el = rivalRefs[i];
          const r = payload.rivals[i];
          if (el && r) {
            const pt = worldToMinimap(r.x, r.z, bounds);
            el.setAttribute('cx', pt.x.toFixed(1));
            el.setAttribute('cy', pt.y.toFixed(1));
          }
        }
        if (ghostMarkerRef.current) {
          if (payload.ghost && ghostEnabledRef.current) {
            const pt = worldToMinimap(payload.ghost.x, payload.ghost.z, bounds);
            const deg = headingToMinimapDeg(payload.ghost.heading);
            ghostMarkerRef.current.style.display = 'block';
            ghostMarkerRef.current.setAttribute(
              'transform',
              `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)}) rotate(${deg.toFixed(1)})`
            );
          } else {
            ghostMarkerRef.current.style.display = 'none';
          }
        }
      },
      onReplayTick: (timeMs, durationMs, paused) => {
        setReplayDurationMs(durationMs);
        setReplayPaused(paused);
        if (scrubberRef.current) {
          scrubberRef.current.max = String(Math.max(1, durationMs));
          scrubberRef.current.value = String(Math.round(timeMs));
        }
        if (replayTimeRef.current) {
          replayTimeRef.current.textContent = formatRaceTime(timeMs);
        }
      },
      onGhostUpdated: (ghost) => {
        setGhostData(ghost);
      },
      onRaceComplete: (raceResult) => {
        clearInputs();
        resultRef.current = raceResult;
        setResult(raceResult);
        setHasReplay(engine.hasReplay());
        setGameState('gameover');
        if (userRef.current) {
          void persistResult(userRef.current, raceResult);
        } else {
          setSaveStatus('idle');
        }
      },
      onContextLost: (lost) => {
        setContextLost(lost);
      },
      onSceneReady: () => {
        setSceneReady(true);
      },
    }, initialMapParam);

    engineRef.current = engine;
    setGhostData(engine.getActiveGhost());

    // Support ?autostart=1 to launch directly into gameplay (defer audio unlock until user gesture)
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      setGameState('playing');
      document.body.dataset.state = 'playing';
      engine.startRace(raceModeRef.current, lapsRef.current, false);
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [clearInputs, initialMapParam, persistResult]);

  // Swap 3D circuit & lap ghost target inside mounted WebGL scene when user changes lobby selections
  useEffect(() => {
    engineRef.current?.setMap(mapId);
  }, [mapId]);

  useEffect(() => {
    engineRef.current?.setTotalLaps(laps);
  }, [laps]);

  // Unified window keyboard + focus-loss input hygiene
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const state = gameStateRef.current;

      if (state === 'title' && loaderDismissed && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        handleStart();
        return;
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (state === 'playing' || state === 'paused') {
          e.preventDefault();
          handlePauseToggle();
        }
        return;
      }

      if (e.code === 'KeyC') {
        if (state === 'playing') {
          e.preventDefault();
          handleCycleCamera();
        } else if (state === 'replay') {
          e.preventDefault();
          handleReplayCycleCamera();
        }
        return;
      }

      if (e.code === 'KeyG' && state === 'playing') {
        e.preventDefault();
        handleToggleGhost();
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (e.code === 'KeyT' && state === 'playing') {
        e.preventDefault();
        handleToggleTouch();
        return;
      }

      if (e.code === 'KeyR' && (state === 'playing' || state === 'paused')) {
        e.preventDefault();
        handleRestart();
        return;
      }

      if (e.code === 'Space' && state === 'replay') {
        e.preventDefault();
        handleReplayTogglePlay();
        return;
      }

      if (
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' ||
        e.code === 'Space'
      ) {
        if (state === 'playing') e.preventDefault();
      }

      engineRef.current?.unlockAudio();
      keysPressedRef.current.add(e.code);
      syncControlInput();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (keysPressedRef.current.has(e.code)) {
        keysPressedRef.current.delete(e.code);
        syncControlInput();
      }
    };

    const onVisibilityOrBlur = () => {
      clearInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onVisibilityOrBlur);
    document.addEventListener('visibilitychange', onVisibilityOrBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onVisibilityOrBlur);
      document.removeEventListener('visibilitychange', onVisibilityOrBlur);
    };
  }, [
    clearInputs,
    handleCycleCamera,
    handlePauseToggle,
    handleReplayCycleCamera,
    handleReplayTogglePlay,
    handleRestart,
    handleStart,
    handleToggleGhost,
    handleToggleMute,
    handleToggleTouch,
    loaderDismissed,
    syncControlInput,
  ]);

  const handleTouchChange = useCallback(
    (nextTouch: TouchPadState) => {
      engineRef.current?.unlockAudio();
      touchStateRef.current = nextTouch;
      syncControlInput();
    },
    [syncControlInput]
  );

  if (fatalError) {
    throw fatalError;
  }

  return (
    <main className="relative w-full h-full overflow-hidden bg-[#0d1015]">
      {/* Isolated WebGL Canvas Mount (never torn down on HUD updates) */}
      <div
        ref={mountRef}
        data-testid="rally-canvas-mount"
        className="fixed inset-0 w-full h-full"
      />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1015]/95 p-6 text-center">
          <div className="max-w-sm bg-[#161a24] border border-white/15 rounded-xl p-6">
            <h2 className="font-display text-xl font-bold text-stone-100 mb-2">
              Graphics Context Restoring
            </h2>
            <p className="text-sm text-stone-400">
              WebGL context was interrupted. Waiting for hardware recovery...
            </p>
          </div>
        </div>
      )}

      {!loaderDismissed && (
        <LoadingScreen
          mapInfo={mapInfo}
          geometry={minimapGeometry}
          sceneReady={sceneReady}
          fadingOut={loaderFading}
          visible={!loaderDismissed}
        />
      )}

      {gameState === 'title' && loaderDismissed && (
        <TitleScreen
          mapId={mapId}
          mode={raceMode}
          laps={laps}
          minimapGeometry={minimapGeometry}
          stageSummary={stageSummary}
          user={user}
          authReady={authReady}
          driverProfile={driverProfile}
          recentRecords={recentRecords}
          authBusy={authBusy}
          onSelectMap={setMapId}
          onSelectMode={setRaceMode}
          onSelectLaps={setLaps}
          onStart={handleStart}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onDeleteRecord={handleDeleteRecord}
        />
      )}

      {gameState === 'playing' && (
        <>
          <StageLaunchBanner
            launchKey={launchKey}
            mapInfo={mapInfo}
            mode={raceMode}
            laps={laps}
            visible={showLaunchBanner}
          />
          <GameHud
            hud={hud}
            cameraMode={cameraMode}
            muted={muted}
            touchEnabled={touchEnabled}
            ghostEnabled={ghostEnabled}
            ghostPathD={ghostPathD}
            minimapGeometry={minimapGeometry}
            speedRef={speedRef}
            gearRef={gearRef}
            rpmBarRef={rpmBarRef}
            playerMarkerRef={playerMarkerRef}
            rival1Ref={rival1Ref}
            rival2Ref={rival2Ref}
            ghostMarkerRef={ghostMarkerRef}
            onCycleCamera={handleCycleCamera}
            onToggleGhost={handleToggleGhost}
            onToggleTouch={handleToggleTouch}
            onToggleMute={handleToggleMute}
            onPause={handlePauseToggle}
            onRestart={handleRestart}
          />
          {touchEnabled && <TouchControls onChange={handleTouchChange} />}
        </>
      )}

      {gameState === 'replay' && (
        <ReplayControls
          mapTitle={mapInfo.title}
          hud={hud}
          durationMs={replayDurationMs}
          replayPaused={replayPaused}
          replaySpeed={replaySpeed}
          replayCamera={replayCamera}
          minimapGeometry={minimapGeometry}
          speedRef={speedRef}
          gearRef={gearRef}
          rpmBarRef={rpmBarRef}
          scrubberRef={scrubberRef}
          replayTimeRef={replayTimeRef}
          playerMarkerRef={playerMarkerRef}
          rival1Ref={rival1Ref}
          rival2Ref={rival2Ref}
          onTogglePlay={handleReplayTogglePlay}
          onSelectSpeed={handleReplaySelectSpeed}
          onCycleCamera={handleReplayCycleCamera}
          onSeek={handleReplaySeek}
          onExitReplay={handleExitReplay}
          onRestart={handleRestart}
        />
      )}

      <GameModals
        gameState={gameState}
        mapTitle={mapInfo.title}
        result={result}
        hasReplay={hasReplay}
        user={user}
        saveStatus={saveStatus}
        authBusy={authBusy}
        onSignInToSave={handleSignIn}
        onWatchReplay={handleWatchReplay}
        onResume={handlePauseToggle}
        onRestart={handleRestart}
        onTitle={handleReturnTitle}
      />

      <LandscapeGuard />
    </main>
  );
}
