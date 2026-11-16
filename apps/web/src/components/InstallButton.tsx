"use client";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Shows "Install app" only when the browser offers PWA installation. */
export function InstallButton({ className = "", label = "Install app" }: { className?: string; label?: string }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); };
    const done = () => setEvt(null);
    window.addEventListener("beforeinstallprompt", on);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);
  if (!evt) return null;
  return (
    <button type="button" className={className} onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); }}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {label}
    </button>
  );
}
