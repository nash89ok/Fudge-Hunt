import * as ZapparThree from '@zappar/zappar-threejs';
import { BrowserCompatibility, ZapparCamera, ZapparCanvas } from '@zappar/zappar-react-three-fiber';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MarkerImageContent, type TargetLoadState } from './MarkerImageContent';
import { MarkerWorldEnvironment } from './MarkerWorldEnvironment';
import { preloadZapparEngine } from './preloadZappar';
import { WorldSurfaceTestContent } from './WorldSurfaceTestContent';

/**
 * When `true`, skips image-target loading and places the cube on the first detected world-tracker surface (test mode).
 * Set to `false` to use marker recognition + handoff again.
 */
const WORLD_SURFACE_TEST_MODE = false;

/** Sequential hunt: train three targets as `fudge-marker1.zpt` … `fudge-marker3.zpt` in `public/`. */
const MARKER_ZPT_URLS = [
  `${import.meta.env.BASE_URL}fudge-marker1.zpt`,
  `${import.meta.env.BASE_URL}fudge-marker2.zpt`,
  `${import.meta.env.BASE_URL}fudge-marker3.zpt`,
] as const;

const MARKER_STEP_COUNT = MARKER_ZPT_URLS.length;

/** Brief cube flash duration after tapping collect (ms). */
const COLLECT_FEEDBACK_MS = 350;

/**
 * ZapWorks WebAR: world-surface test mode, or sequential marker hunt (`fudge-marker1–3.zpt`).
 */
export function ZapWorksCameraPreview() {
  const [sdkReady, setSdkReady] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [markerTracked, setMarkerTracked] = useState(false);
  /** How many markers have been collected (0 … {@link MARKER_STEP_COUNT}). */
  const [collectedCount, setCollectedCount] = useState(0);
  const [showCollectedCube, setShowCollectedCube] = useState(false);
  const [targetLoadState, setTargetLoadState] = useState<TargetLoadState>('idle');
  const [targetLoadMessage, setTargetLoadMessage] = useState<string | undefined>(undefined);
  const [worldSurfacePlaced, setWorldSurfacePlaced] = useState(false);

  useEffect(() => {
    if (!cameraOn) {
      setMarkerTracked(false);
      setCollectedCount(0);
      setShowCollectedCube(false);
      setTargetLoadState('idle');
      setTargetLoadMessage(undefined);
      setWorldSurfacePlaced(false);
    }
  }, [cameraOn]);

  const onMarkerTrackedChange = useCallback((tracked: boolean) => {
    setMarkerTracked((prev) => (prev === tracked ? prev : tracked));
  }, []);

  const onTargetLoadState = useCallback((state: TargetLoadState, message?: string) => {
    setTargetLoadState(state);
    setTargetLoadMessage(message);
  }, []);

  const onWorldSurfacePlaced = useCallback(() => {
    setWorldSurfacePlaced(true);
  }, []);

  /** Collect action: flash cube, then advance to the next marker (or finish after the third). */
  const onCollect = useCallback(() => {
    if (!markerTracked || collectedCount >= MARKER_STEP_COUNT) {
      return;
    }
    setShowCollectedCube(true);
    window.setTimeout(() => {
      setCollectedCount((c) => Math.min(c + 1, MARKER_STEP_COUNT));
      setShowCollectedCube(false);
    }, COLLECT_FEEDBACK_MS);
  }, [markerTracked, collectedCount]);

  const huntComplete = collectedCount >= MARKER_STEP_COUNT;
  const huntActive = collectedCount < MARKER_STEP_COUNT;

  /**
   * Image indices that need a secondary tracker: the last collected marker (yellow cube), and while the collect
   * flash runs, the current marker’s .zpt is preloaded so the handoff does not blink when `collectedCount` increments.
   */
  const persistLayerIndices = useMemo(() => {
    if (!cameraOn || !huntActive) {
      return [] as number[];
    }
    const out: number[] = [];
    if (collectedCount > 0) {
      out.push(collectedCount - 1);
    }
    if (showCollectedCube && collectedCount < MARKER_STEP_COUNT) {
      const preloadIdx = collectedCount;
      if (!out.includes(preloadIdx)) {
        out.push(preloadIdx);
      }
    }
    return out;
  }, [cameraOn, huntActive, collectedCount, showCollectedCube]);

  useEffect(() => {
    let cancelled = false;
    void preloadZapparEngine()
      .then(() => {
        if (!cancelled) setSdkReady(true);
      })
      .catch((e: unknown) => {
        console.error(e);
        if (!cancelled) setError('Could not load the Zappar engine. Use HTTPS or localhost.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Browsers only show the camera prompt if `getUserMedia` runs in direct response to a user gesture.
   * Zappar's `permissionRequestUI()` awaits work first, which drops that activation, so the prompt may
   * never appear. We call `getUserMedia` in the same click turn, then Zappar for motion / internal state.
   */
  const onStart = useCallback(() => {
    setError(null);
    if (!window.isSecureContext) {
      setError(
        'Camera requires a secure context. Use https:// (this dev server uses HTTPS) or http://localhost — not plain http:// on a LAN IP.',
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support camera access from web pages.');
      return;
    }
    setBusy(true);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        return ZapparThree.permissionRequestUI();
      })
      .then((ok) => {
        if (ok) setCameraOn(true);
        else {
          ZapparThree.permissionDeniedUI();
          setError('Permission denied. Allow camera (and motion if asked) in site settings.');
        }
      })
      .catch((e: unknown) => {
        console.error(e);
        const name = e && typeof e === 'object' && 'name' in e ? String((e as DOMException).name) : '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError(
            'Camera was blocked. Use the lock or camera icon in the address bar to allow the camera for this site, then try again.',
          );
        } else {
          setError(
            'Could not open the camera. If another app is using it, close it; otherwise use localhost or HTTPS.',
          );
        }
      })
      .finally(() => setBusy(false));
  }, []);

  const showStart = sdkReady && !cameraOn && !error;
  const showErr = sdkReady && error && !cameraOn;

  const bannerText = WORLD_SURFACE_TEST_MODE
    ? worldSurfacePlaced
      ? 'World test: cube is anchored to a detected surface. Walk around to verify tracking.'
      : 'World test: move slowly until tracking is good (blue points); a surface will be found and the cube placed automatically.'
    : targetLoadState === 'error'
      ? `Image target failed to load: ${targetLoadMessage ?? 'unknown error'}`
      : targetLoadState === 'loading'
        ? `Loading marker ${Math.min(collectedCount + 1, MARKER_STEP_COUNT)} of ${MARKER_STEP_COUNT}…`
        : huntComplete
          ? 'All markers collected!'
          : markerTracked
            ? `Marker ${collectedCount + 1} of ${MARKER_STEP_COUNT} — tap “collect it!” when ready.`
            : `Find marker ${collectedCount + 1} of ${MARKER_STEP_COUNT} — aim the camera at the print.`;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100dvh',
        background: '#000',
      }}
    >
      <BrowserCompatibility />
      {!sdkReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.9)',
            color: '#eee',
          }}
        >
          Preparing AR engine…
        </div>
      )}
      {showStart && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 24,
            background: 'rgba(0,0,0,0.88)',
          }}
        >
          <p style={{ color: '#eee', textAlign: 'center', maxWidth: 360, margin: 0 }}>
            Tap below, then allow camera access when your browser asks (required on phones).
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={onStart}
            style={{
              padding: '14px 28px',
              fontSize: 17,
              fontWeight: 600,
              border: 'none',
              borderRadius: 8,
              background: '#e8b923',
              color: '#111',
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? '…' : 'Start camera'}
          </button>
        </div>
      )}
      {showErr && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            background: 'rgba(0,0,0,0.88)',
          }}
        >
          <p style={{ color: '#f88', textAlign: 'center', maxWidth: 420, margin: 0 }}>{error}</p>
          <button
            type="button"
            onClick={onStart}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #666',
              background: 'transparent',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )}
      {cameraOn && (
        <p
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 12,
            zIndex: 3,
            margin: 0,
            padding: '10px 16px',
            fontSize: 14,
            textAlign: 'center',
            color: !WORLD_SURFACE_TEST_MODE && targetLoadState === 'error' ? '#faa' : '#eee',
            background: 'rgba(0,0,0,0.55)',
            pointerEvents: 'none',
          }}
        >
          {bannerText}
        </p>
      )}
      {!WORLD_SURFACE_TEST_MODE && cameraOn ? (
        <div
          style={{
            position: 'absolute',
            left: 12,
            top: 52,
            zIndex: 6,
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            color: '#eee',
            background: 'rgba(0,0,0,0.65)',
            border: '1px solid rgba(255,255,255,0.2)',
            pointerEvents: 'none',
          }}
        >
          Collected: {collectedCount} / {MARKER_STEP_COUNT}
        </div>
      ) : null}
      {!WORLD_SURFACE_TEST_MODE && cameraOn && huntActive ? (
        <button
          type="button"
          onClick={onCollect}
          disabled={!markerTracked}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 92,
            transform: 'translateX(-50%)',
            zIndex: 4,
            minWidth: 168,
            padding: '12px 22px',
            borderRadius: 999,
            border: 'none',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 0.2,
            color: '#fff',
            background: markerTracked ? '#2f7dff' : '#80858f',
            cursor: markerTracked ? 'pointer' : 'not-allowed',
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
          }}
        >
          {markerTracked ? 'collect it!' : 'detecting'}
        </button>
      ) : null}
      {!WORLD_SURFACE_TEST_MODE && cameraOn && huntComplete ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            padding: 24,
          }}
        >
          <p
            style={{
              margin: 0,
              maxWidth: 420,
              padding: '20px 28px',
              borderRadius: 12,
              fontSize: 20,
              fontWeight: 700,
              textAlign: 'center',
              color: '#111',
              background: 'rgba(232,185,35,0.95)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            }}
          >
            Congratulations, you collected all markers!
          </p>
        </div>
      ) : null}
      <p
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1,
          margin: 0,
          padding: 12,
          fontSize: 13,
          background: 'rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      >
        Fudge Hunt · ZapWorks WebAR · Register your domain with ZapWorks for production
      </p>
      <ZapparCanvas style={{ width: '100%', height: '100dvh', display: 'block' }} gl={{ antialias: true }}>
        <ambientLight intensity={2} />
        <directionalLight position={[2, 4, 3]} intensity={1.2} />
        <ZapparCamera userFacing={false} start={cameraOn} permissionRequest={false} />
        {!WORLD_SURFACE_TEST_MODE && cameraOn ? <MarkerWorldEnvironment enabled /> : null}
        {WORLD_SURFACE_TEST_MODE ? (
          <WorldSurfaceTestContent enabled={cameraOn} onSurfacePlaced={onWorldSurfacePlaced} />
        ) : (
          <>
            {persistLayerIndices.map((persistZptIndex) => (
              <MarkerImageContent
                key={`persist-zpt-${persistZptIndex}`}
                enabled
                persistentCollected
                reportTracking={false}
                reportTargetLoad={false}
                targetZptUrl={MARKER_ZPT_URLS[persistZptIndex]}
                showPersistentCollectedMesh={collectedCount > 0 && persistZptIndex === collectedCount - 1}
              />
            ))}
            <MarkerImageContent
              key={`hunt-${collectedCount}`}
              enabled={cameraOn && huntActive}
              targetZptUrl={MARKER_ZPT_URLS[Math.min(collectedCount, MARKER_STEP_COUNT - 1)]}
              showCollectedCube={showCollectedCube}
              onTrackedChange={onMarkerTrackedChange}
              onTargetLoadState={onTargetLoadState}
            />
          </>
        )}
      </ZapparCanvas>
    </div>
  );
}
