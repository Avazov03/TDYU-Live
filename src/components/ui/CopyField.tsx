"use client";

import { useState } from "react";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setOk(true);
      window.setTimeout(() => setOk(false), 1600);
    } catch {
      setOk(false);
    }
  };

  return (
    <div className="copy-field">
      <div className="copy-field-label">{label}</div>
      <div className="copy-field-row">
        <code>{value}</code>
        <button type="button" className="btn btn-sm" onClick={copy}>
          {ok ? "Nusxa olindi" : "Nusxa"}
        </button>
      </div>
    </div>
  );
}
