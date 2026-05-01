type LandingPageProps = {
  /** Navigate to the ZapWorks camera experience */
  onOpenCamera: () => void;
};

/** Handwritten brand face from the Figma landing frame. */
const BRAND_FONT = "'Architects Daughter', cursive, system-ui, sans-serif";

/**
 * Landing screen matching the Figma frame (white canvas, brownie art, “Start” CTA, Virtual Fudge footer).
 * {@link onOpenCamera} is wired to the primary “Start” control.
 */
export function LandingPage({ onOpenCamera }: LandingPageProps) {
  const base = import.meta.env.BASE_URL;
  const brownieSrc = `${base}landing/brownie.png`;
  const logoSrc = `${base}landing/virtual-fudge-logo.png`;

  return (
    <main
      style={{
        minHeight: '100dvh',
        margin: 0,
        background: '#ffffff',
        color: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
        padding: 'clamp(24px, 6vh, 48px) clamp(20px, 6vw, 32px) max(16px, env(safe-area-inset-bottom, 0))',
      }}
    >
      <div
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'clamp(12px, 3vh, 20px)',
          width: '100%',
          maxWidth: 402,
        }}
      >
        <img
          src={brownieSrc}
          alt=""
          width={178}
          height={121}
          style={{
            width: 'min(100%, 178px)',
            height: 'auto',
            display: 'block',
            objectFit: 'contain',
          }}
        />
        <h1
          style={{
            margin: 0,
            fontFamily: BRAND_FONT,
            fontSize: 'clamp(2rem, 9vw, 2.5rem)',
            fontWeight: 400,
            lineHeight: 1.1,
            textAlign: 'center',
          }}
        >
          Fudge Hunt
        </h1>
        <button
          type="button"
          onClick={onOpenCamera}
          style={{
            marginTop: 4,
            width: '100%',
            maxWidth: 202,
            minHeight: 38,
            padding: '0 20px',
            borderRadius: 6,
            border: 'none',
            background: '#000000',
            color: '#ffffff',
            fontFamily: BRAND_FONT,
            fontSize: 24,
            fontWeight: 400,
            cursor: 'pointer',
          }}
        >
          Start
        </button>
      </div>

      <footer
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          width: '100%',
          maxWidth: 402,
          flexShrink: 0,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: BRAND_FONT,
            fontSize: 12,
            lineHeight: 1.2,
            textAlign: 'center',
          }}
        >
          Powered by
        </p>
        <img
          src={logoSrc}
          alt="Virtual Fudge"
          width={133.1}
          height={14.52}
          style={{
            width: 133.1,
            height: 14.52,
            display: 'block',
            objectFit: 'contain',
            objectPosition: 'center',
            transform: 'translateY(-8px)',
          }}
        />
      </footer>
    </main>
  );
}
