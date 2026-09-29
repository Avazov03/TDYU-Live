"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
};

type Request = { opts: ConfirmOptions; resolve: (ok: boolean) => void };

const EVENT = "lx:confirm";
let hostMounted = false;

/** Styled replacement for window.confirm — resolves true only on the explicit confirm button. */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!hostMounted) {
    return Promise.resolve(window.confirm([opts.title, opts.message].filter(Boolean).join("\n\n")));
  }
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<Request>(EVENT, { detail: { opts, resolve } }));
  });
}

export function ConfirmDialogHost() {
  const ref = useRef<HTMLDialogElement>(null);
  const pending = useRef<Request | null>(null);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);

  useEffect(() => {
    const onRequest = (e: Event) => {
      const req = (e as CustomEvent<Request>).detail;
      pending.current?.resolve(false);
      pending.current = req;
      setOpts(req.opts);
      if (!ref.current?.open) ref.current?.showModal();
    };
    window.addEventListener(EVENT, onRequest);
    hostMounted = true;
    return () => {
      window.removeEventListener(EVENT, onRequest);
      hostMounted = false;
    };
  }, []);

  const finish = (ok: boolean) => {
    pending.current?.resolve(ok);
    pending.current = null;
    ref.current?.close();
  };

  const danger = (opts?.tone ?? "danger") === "danger";

  return (
    <dialog
      ref={ref}
      className="lx-dialog lx-confirm"
      aria-labelledby="lx-confirm-title"
      aria-describedby={opts?.message ? "lx-confirm-msg" : undefined}
      data-testid="confirm-dialog"
      onClose={() => {
        pending.current?.resolve(false);
        pending.current = null;
      }}
    >
      <div className="lx-dialog-head">
        <h2 id="lx-confirm-title">{opts?.title}</h2>
        <button type="button" className="iconbtn" onClick={() => finish(false)} aria-label="Yopish">
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="lx-dialog-body">
        {opts?.message ? (
          <p id="lx-confirm-msg" className="lx-dialog-note">
            {opts.message}
          </p>
        ) : null}
        <div className="lx-dialog-actions">
          <button type="button" className="btn" onClick={() => finish(false)} data-testid="confirm-cancel" autoFocus>
            {opts?.cancelLabel ?? "Bekor qilish"}
          </button>
          <button
            type="button"
            className={danger ? "btn btn-danger" : "btn btn-primary"}
            onClick={() => finish(true)}
            data-testid="confirm-ok"
          >
            {opts?.confirmLabel ?? "Tasdiqlash"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
