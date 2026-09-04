"use client";

import { HexAlphaColorPicker } from "react-colorful";
import { RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

function toHex(v: string): string {
  return /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ? v : v;
}

export function ColorField({
  label, value, baseValue, onChange, onReset, contrastHint,
}: { label: string; value: string; baseValue: string; onChange: (v: string) => void; onReset: () => void; contrastHint?: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const overridden = value !== baseValue;

  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function commitText(v: string) {
    setText(v);
    if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim())) onChange(v.trim().toLowerCase());
  }

  return (
    <div ref={wrap} className="relative flex items-center gap-2 py-1">
      <button
        type="button"
        aria-label={`${label} colour ${value}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="h-7 w-7 shrink-0 rounded-md border border-line shadow-inner"
        style={{ background: value }}
      />
      <label htmlFor={id} className="min-w-0 flex-1 truncate text-xs text-body">{label}</label>
      {contrastHint ? <span className="rounded bg-ice px-1 text-[10px] font-semibold text-muted" title="Contrast ratio against its halo/background">{contrastHint}</span> : null}
      <input
        id={id}
        value={text}
        onChange={(e) => commitText(e.target.value)}
        onBlur={() => setText(value)}
        spellCheck={false}
        className="w-[88px] rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink"
      />
      <button type="button" onClick={onReset} disabled={!overridden} aria-label={`Reset ${label} to base`} className="rounded p-1 text-muted hover:text-navy disabled:opacity-25">
        <RotateCcw size={13} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-line bg-white p-2 shadow-lg">
          <HexAlphaColorPicker color={toHex(value)} onChange={(v) => onChange(v.toLowerCase())} />
        </div>
      ) : null}
    </div>
  );
}
