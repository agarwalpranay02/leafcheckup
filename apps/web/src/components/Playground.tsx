"use client";
import { useState } from "react";

export function Playground({ label, body }: { label: string; body: string }) {
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [out, setOut] = useState<string>("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-[var(--radius-frame)] bg-[var(--surface)] p-6 ring-1 ring-[var(--rule)]">
      <p className="title text-2xl">{label}</p>
      <p className="mt-1 text-[var(--muted)]">{body}</p>
      <form className="mt-4 grid gap-3" onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        setBusy(true);
        const fd = new FormData();
        fd.append("image", file);
        try {
          const r = await fetch("/api/v1/diagnose", { method: "POST", headers: { Authorization: `Bearer ${key.trim()}` }, body: fd });
          setOut(`HTTP ${r.status}\n` + JSON.stringify(await r.json(), null, 2));
        } catch (err) { setOut(String(err)); }
        setBusy(false);
      }}>
        <input className="field font-mono text-sm" placeholder="lc_live_…" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} aria-label="API key" />
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Leaf photo" />
        <button type="submit" className="btn btn-leaf w-fit" disabled={busy || !file || !key}>POST /api/v1/diagnose</button>
      </form>
      {out && <pre className="mt-4 max-h-96 overflow-auto rounded-2xl bg-[#0e1913] p-4 text-sm text-[#d7e6d1]">{out}</pre>}
    </div>
  );
}
