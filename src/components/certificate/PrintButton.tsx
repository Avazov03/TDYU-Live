"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-primary no-print" onClick={() => window.print()}>
      Yuklab olish / chop etish
    </button>
  );
}
