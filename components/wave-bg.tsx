export function WaveBackground({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden>
      <svg
        className="absolute -bottom-8 left-1/2 h-[55%] w-[160%] -translate-x-1/2 opacity-80"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
      >
        <path
          fill="#4A89EA"
          fillOpacity="0.18"
          d="M0,192L48,176C96,160,192,128,288,133.3C384,139,480,181,576,181.3C672,181,768,139,864,133.3C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        >
          <animate
            attributeName="d"
            dur="12s"
            repeatCount="indefinite"
            values="
              M0,192L48,176C96,160,192,128,288,133.3C384,139,480,181,576,181.3C672,181,768,139,864,133.3C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L0,320Z;
              M0,160L48,170C96,181,192,203,288,197C384,192,480,149,576,144C672,139,768,181,864,192C960,203,1056,181,1152,160C1248,139,1344,117,1392,106L1440,96L1440,320L0,320Z;
              M0,192L48,176C96,160,192,128,288,133.3C384,139,480,181,576,181.3C672,181,768,139,864,133.3C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L0,320Z"
          />
        </path>
        <path
          fill="#6BA3F0"
          fillOpacity="0.28"
          d="M0,224L60,213C120,203,240,181,360,181C480,181,600,203,720,197C840,192,960,160,1080,149C1200,139,1320,149,1380,154L1440,160L1440,320L0,320Z"
        />
      </svg>
    </div>
  );
}

export function ButtonWave() {
  return (
    <span
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px] opacity-50"
      aria-hidden
    >
      <svg className="h-full w-full" viewBox="0 0 400 80" preserveAspectRatio="none">
        <path
          fill="#6BA3F0"
          d="M0,40 C80,10 120,70 200,40 C280,10 320,70 400,40 L400,80 L0,80 Z"
        />
      </svg>
    </span>
  );
}
