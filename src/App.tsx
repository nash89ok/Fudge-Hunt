import { lazy, Suspense, useEffect, useState } from 'react';
import { LandingPage } from './pages/LandingPage';

const ZapWorksCameraPreview = lazy(() =>
  import('./webar/ZapWorksCameraPreview').then((m) => ({ default: m.ZapWorksCameraPreview })),
);

type Screen = 'landing' | 'camera';

/**
 * Landing shows “hello”; user can open the ZapWorks camera preview.
 * The camera stack is lazy-loaded so the landing route does not execute ZapWorks on first paint.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>('landing');

  /**
   * Overlap network/CPU work with the landing view: Zappar’s WASM + workers (~multi‑MB) and the WebAR route chunk
   * start loading before the user taps “Open camera”, so that transition feels much faster (especially on Android).
   */
  useEffect(() => {
    void import('./webar/preloadZappar').then((m) => m.preloadZapparEngine());
    void import('./webar/ZapWorksCameraPreview');
  }, []);

  return (
    <div style={{ width: '100vw', minHeight: '100dvh', margin: 0 }}>
      {screen === 'landing' ? (
        <LandingPage onOpenCamera={() => setScreen('camera')} />
      ) : (
        <Suspense
          fallback={
            <div
              style={{
                minHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: 24,
                color: '#e8eaed',
                fontFamily: 'system-ui, sans-serif',
                textAlign: 'center',
              }}
            >
              <span>Loading WebAR…</span>
              <span style={{ fontSize: 13, opacity: 0.75, maxWidth: 320 }}>
                First launch downloads AR components; later opens are faster. Stay on Wi‑Fi if downloads are slow.
              </span>
            </div>
          }
        >
          <ZapWorksCameraPreview />
        </Suspense>
      )}
    </div>
  );
}
