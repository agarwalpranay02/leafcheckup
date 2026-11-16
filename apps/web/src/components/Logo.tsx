/**
 * LeafCheckup mark: a leaf held inside two viewfinder corners, the frame
 * every checkup starts from.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <path d="M4 13V8a4 4 0 0 1 4-4h5M36 27v5a4 4 0 0 1-4 4h-5" fill="none" stroke="var(--color-bloom)" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M12.5 28.5c-1.4-8.6 4.2-16.3 15.6-17.4.9 10.4-5.6 17.6-15.6 17.4Z"
        fill="currentColor"
      />
      <path d="M12.5 28.5c3.2-4.6 6.9-8.6 11.6-11.8" fill="none" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.5 28.5c-.6 1.7-1.6 3.1-3 4.2" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="h-9 w-9 text-[var(--color-leaf)] dark:text-[var(--color-sprout)]" />
      <span className="text-[1.65rem] leading-none tracking-[-0.01em]" style={{ fontVariationSettings: '"wdth" 80', fontWeight: 720 }}>
        LeafCheckup
      </span>
    </span>
  );
}
