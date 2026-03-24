type QuantAgentLogoProps = {
  className?: string
  compact?: boolean
}

export function QuantAgentLogo({ className = '', compact = false }: QuantAgentLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="h-10 w-10 flex-none drop-shadow-[0_10px_24px_rgba(14,165,233,0.28)]"
      >
        <defs>
          <linearGradient id="qa-shell" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#102033" />
            <stop offset="1" stopColor="#0B1420" />
          </linearGradient>
          <linearGradient id="qa-accent" x1="16" y1="16" x2="52" y2="52" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#38BDF8" />
            <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        <rect x="4" y="4" width="56" height="56" rx="18" fill="url(#qa-shell)" />
        <rect x="4.75" y="4.75" width="54.5" height="54.5" rx="17.25" fill="none" stroke="#233044" />

        <path d="M16 46H48" stroke="#1F3144" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 35H48" stroke="#172535" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 24H48" stroke="#172535" strokeWidth="1.5" strokeLinecap="round" />

        <path d="M18 42L27 32L34 36L46 20" fill="none" stroke="url(#qa-accent)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M41.8 20H46V24.2" fill="none" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        <path d="M21 39V47" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        <rect x="18.5" y="34" width="5" height="9" rx="1.5" fill="#38BDF8" />

        <path d="M31 28V39" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        <rect x="28.5" y="30.5" width="5" height="7" rx="1.5" fill="#F59E0B" />

        <path d="M41 18V31" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
        <rect x="38.5" y="21" width="5" height="8" rx="1.5" fill="#38BDF8" />

        <circle cx="49.5" cy="18.5" r="3.5" fill="#F59E0B" />
      </svg>

      {!compact && (
        <div className="min-w-0">
          <div className="text-[19px] font-semibold tracking-[0.01em] text-dark-text">QuantAgent</div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-dark-muted">Multi-Market Terminal</div>
        </div>
      )}
    </div>
  )
}
