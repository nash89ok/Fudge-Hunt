type LandingPageProps = {
  /** Navigate to the ZapWorks camera experience */
  onOpenCamera: () => void;
};

/**
 * Default route: greeting and entry into WebAR.
 */
export function LandingPage({ onOpenCamera }: LandingPageProps) {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        gap: '1.5rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 600 }}>hello</h1>
      <p style={{ margin: 0, maxWidth: 360, opacity: 0.85 }}>Fudge Hunt · ZapWorks WebAR</p>
      <button
        type="button"
        onClick={onOpenCamera}
        style={{
          padding: '12px 24px',
          fontSize: 16,
          fontWeight: 600,
          borderRadius: 8,
          border: 'none',
          background: '#e8b923',
          color: '#111',
          cursor: 'pointer',
        }}
      >
        Open camera
      </button>
    </main>
  );
}
