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

/** Color UI icons for each slot after that marker is collected. */
const FUDGE_MARKER_UI_URLS = [
  `${import.meta.env.BASE_URL}hunt/FudgeMarker1.png`,
  `${import.meta.env.BASE_URL}hunt/FudgeMarker2.png`,
  `${import.meta.env.BASE_URL}hunt/FudgeMarker3.png`,
] as const;

/** Shared grayscale fudge for slots that are not collected yet. */
const FUDGE_MARKER_DEFAULT_URL = `${import.meta.env.BASE_URL}hunt/FudgeMarkerDefault.png`;

const TREASURE_MAP_URL = `${import.meta.env.BASE_URL}hunt/treasure-map.png`;

/**
 * Solid light-grey HUD surfaces + dark outline (collection strip + map chip).
 * @see https://www.figma.com/design/NvCn1Y6oG9WEw6IwwznGi1/Untitled?node-id=33-6
 */
const HUNT_HUD_CHIP_BG = '#e4e4e6';
const HUNT_HUD_CHIP_BORDER = '#6e6e73';

/** Blue gradient primary action when the marker is tracked (“Collect it!”). */
const COLLECT_CTA_TRACKED_GRADIENT =
  'linear-gradient(180deg, #5aa6ff 0%, #2d87ff 45%, #1a6de8 100%)';
const COLLECT_CTA_TRACKED_BORDER = 'rgba(255,255,255,0.82)';
const COLLECT_CTA_TRACKED_SHADOW = '0 6px 20px rgba(26, 109, 232, 0.38)';

/** Brief cube flash duration after tapping collect (ms). */
const COLLECT_FEEDBACK_MS = 350;

/** Handwritten face aligned with the landing / Figma hunt-intro frame (`index.html` loads Architects Daughter). */
const BRAND_FONT = "'Architects Daughter', cursive, system-ui, sans-serif";

/**
 * Body copy from the “Start the hunt” screen frame — guides players before the camera turns on.
 * @see https://www.figma.com/design/NvCn1Y6oG9WEw6IwwznGi1/Untitled?node-id=27-23
 */
const HUNT_INTRO_COPY =
  'There are three fudges hidden in this world, fudge elves marked their locations on the treasure map. Go Find them, you will be rewarded with a real fudge!';

/**
 * ZapWorks WebAR: world-surface test mode, or sequential marker hunt (`fudge-marker1–3.zpt`).
 * In-hunt HUD matches Figma frame 32:2 (camera + top fudge row + bottom bar + map).
 * @see https://www.figma.com/design/NvCn1Y6oG9WEw6IwwznGi1/Untitled?node-id=32-2
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
  /** Full-screen treasure map overlay from the bottom-right control. */
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    if (!cameraOn) {
      setMarkerTracked(false);
      setCollectedCount(0);
      setShowCollectedCube(false);
      setTargetLoadState('idle');
      setTargetLoadMessage(undefined);
      setWorldSurfacePlaced(false);
      setMapOpen(false);
    }
  }, [cameraOn]);

  useEffect(() => {
    if (!mapOpen) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMapOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mapOpen]);

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
   * While hunting the next marker, turn off CV on the “collected” tracker so only the hunt
   * {@link ImageTracker} runs — dual active trackers often prevent the next `.zpt` from ever locking.
   */
  const pausePersistImageCv = cameraOn && huntActive && !markerTracked && collectedCount > 0;

  /**
   * Secondary tracker only for the last collected marker (persistent yellow cube).
   * Do not mount a second tracker for the same `.zpt` as the hunt layer during the collect flash — duplicate
   * `ImageTracker` instances on one target can break recognition for the next step.
   */
  const persistLayerIndices = useMemo(() => {
    if (!cameraOn || !huntActive || collectedCount <= 0) {
      return [] as number[];
    }
    return [collectedCount - 1];
  }, [cameraOn, huntActive, collectedCount]);

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
            ? `Marker ${collectedCount + 1} of ${MARKER_STEP_COUNT} — tap “Collect it!” when ready.`
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
            boxSizing: 'border-box',
            padding: 'clamp(20px, 5vh, 40px) clamp(20px, 5vw, 32px)',
            background: '#ffffff',
            color: '#000000',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 28,
              width: '100%',
              maxWidth: 402,
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}hunt/treasure-map.png`}
              alt=""
              width={210}
              height={302}
              style={{
                width: 'min(100%, 210px)',
                height: 'auto',
                maxHeight: 302,
                display: 'block',
                objectFit: 'contain',
              }}
            />
            <p
              style={{
                margin: 0,
                maxWidth: 350,
                fontFamily: BRAND_FONT,
                fontSize: 14,
                lineHeight: 1.35,
                fontWeight: 400,
                textAlign: 'center',
                color: '#000000',
              }}
            >
              {HUNT_INTRO_COPY}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={onStart}
              style={{
                width: '100%',
                maxWidth: 208,
                minHeight: 38,
                padding: '0 16px',
                fontFamily: BRAND_FONT,
                fontSize: 14,
                fontWeight: 400,
                border: '1px solid #000000',
                borderRadius: 6,
                background: '#000000',
                color: '#ffffff',
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy ? 0.75 : 1,
              }}
            >
              {busy ? '…' : 'Start the hunt'}
            </button>
          </div>
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
      <ZapparCanvas
        style={{
          width: '100%',
          height: '100dvh',
          display: 'block',
          position: 'relative',
          zIndex: 0,
        }}
        gl={{ antialias: true }}
      >
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
                pauseImageTrackerCv={pausePersistImageCv}
                reportTracking={false}
                reportTargetLoad={false}
                targetZptUrl={MARKER_ZPT_URLS[persistZptIndex]}
                showPersistentCollectedMesh={collectedCount > 0 && persistZptIndex === collectedCount - 1}
              />
            ))}
            <MarkerImageContent
              enabled={cameraOn && huntActive}
              targetZptUrl={MARKER_ZPT_URLS[Math.min(collectedCount, MARKER_STEP_COUNT - 1)]}
              showCollectedCube={showCollectedCube}
              onTrackedChange={onMarkerTrackedChange}
              onTargetLoadState={onTargetLoadState}
            />
          </>
        )}
      </ZapparCanvas>
      {cameraOn ? (
        <p
          style={{
            position: 'absolute',
            left: 8,
            right: 8,
            top: 'max(104px, calc(env(safe-area-inset-top, 0px) + 92px))',
            zIndex: 12,
            margin: 0,
            padding: '8px 12px',
            fontSize: 13,
            lineHeight: 1.35,
            textAlign: 'center',
            color: !WORLD_SURFACE_TEST_MODE && targetLoadState === 'error' ? '#faa' : '#eee',
            background: 'rgba(0,0,0,0.45)',
            borderRadius: 10,
            pointerEvents: 'none',
          }}
        >
          {bannerText}
        </p>
      ) : null}
      {!WORLD_SURFACE_TEST_MODE && cameraOn ? (
        <div
          style={{
            position: 'absolute',
            left: 'clamp(7px, 2.2vw, 12px)',
            top: 'max(12px, env(safe-area-inset-top, 0px))',
            zIndex: 14,
            boxSizing: 'border-box',
            width: 'min(287px, calc(100vw - 24px))',
            height: 87,
            padding: '0 10px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            borderRadius: 20,
            border: `1px solid ${HUNT_HUD_CHIP_BORDER}`,
            background: HUNT_HUD_CHIP_BG,
            isolation: 'isolate',
            pointerEvents: 'none',
          }}
          aria-label="Collection progress"
        >
          {FUDGE_MARKER_UI_URLS.map((coloredSrc, index) => {
            const collected = collectedCount > index;
            return (
              <span
                key={coloredSrc}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 'min(80px, 22vw)',
                  height: 54,
                  borderRadius: 8,
                  backgroundColor: HUNT_HUD_CHIP_BG,
                }}
              >
                <img
                  src={collected ? coloredSrc : FUDGE_MARKER_DEFAULT_URL}
                  alt=""
                  width={80}
                  height={54}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </span>
            );
          })}
        </div>
      ) : null}
      {!WORLD_SURFACE_TEST_MODE && cameraOn && huntActive ? (
        <div
          style={{
            position: 'absolute',
            left: 'clamp(7px, 2.2vw, 12px)',
            right: 'clamp(7px, 2.2vw, 12px)',
            bottom: 'max(44px, calc(env(safe-area-inset-bottom, 0px) + 36px))',
            zIndex: 16,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'stretch',
            gap: 10,
            pointerEvents: 'none',
          }}
        >
          <button
            type="button"
            onClick={onCollect}
            disabled={!markerTracked}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 87,
              padding: '0 clamp(14px, 4vw, 22px)',
              borderRadius: 18,
              border: markerTracked
                ? `1px solid ${COLLECT_CTA_TRACKED_BORDER}`
                : `1px solid ${HUNT_HUD_CHIP_BORDER}`,
              background: markerTracked ? COLLECT_CTA_TRACKED_GRADIENT : HUNT_HUD_CHIP_BG,
              color: markerTracked ? '#ffffff' : '#2c2c2e',
              fontFamily: BRAND_FONT,
              fontSize: markerTracked ? 'clamp(20px, 5.2vw, 26px)' : 'clamp(17px, 4.4vw, 21px)',
              fontWeight: 400,
              letterSpacing: markerTracked ? '0.02em' : 'normal',
              textShadow: markerTracked ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
              cursor: markerTracked ? 'pointer' : 'not-allowed',
              /** Let touches reach the canvas while detecting; disabled buttons can still steal hits on some engines. */
              pointerEvents: markerTracked ? 'auto' : 'none',
              WebkitTapHighlightColor: 'transparent',
              boxShadow: markerTracked ? COLLECT_CTA_TRACKED_SHADOW : '0 3px 10px rgba(0,0,0,0.12)',
              transition:
                'background 0.22s ease, border-color 0.22s ease, color 0.22s ease, box-shadow 0.22s ease',
            }}
          >
            {markerTracked ? 'Collect it!' : 'Detecting ……'}
          </button>
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            style={{
              width: 'min(88px, 20vw)',
              flexShrink: 0,
              minHeight: 87,
              borderRadius: 18,
              border: `1px solid ${HUNT_HUD_CHIP_BORDER}`,
              background: HUNT_HUD_CHIP_BG,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              cursor: 'pointer',
              pointerEvents: 'auto',
              boxShadow: '0 3px 10px rgba(0,0,0,0.12)',
            }}
            aria-label="Open treasure map"
          >
            <img
              src={TREASURE_MAP_URL}
              alt=""
              width={72}
              height={72}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          </button>
        </div>
      ) : null}
      {mapOpen ? (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
            background: 'rgba(0,0,0,0.72)',
            pointerEvents: 'auto',
          }}
          onClick={() => setMapOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Treasure map"
            style={{ position: 'relative', maxWidth: 'min(420px, 100%)', maxHeight: '85dvh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={TREASURE_MAP_URL}
              alt="Treasure map"
              width={420}
              height={604}
              style={{ width: '100%', height: 'auto', maxHeight: '85dvh', display: 'block', borderRadius: 8 }}
            />
            <button
              type="button"
              onClick={() => setMapOpen(false)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                width: 36,
                height: 36,
                borderRadius: 999,
                border: 'none',
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                fontSize: 22,
                lineHeight: 1,
                cursor: 'pointer',
              }}
              aria-label="Close map"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
      {!WORLD_SURFACE_TEST_MODE && cameraOn && huntComplete ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 24,
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
          zIndex: 10,
          margin: 0,
          padding: '8px 12px',
          fontSize: 11,
          background: 'rgba(0,0,0,0.45)',
          pointerEvents: 'none',
          opacity: cameraOn ? 0.72 : 1,
        }}
      >
        Fudge Hunt · ZapWorks WebAR · Register your domain with ZapWorks for production
      </p>
    </div>
  );
}
