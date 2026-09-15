"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

function expandTransition(reduced: boolean | null) {
  return reduced ? { duration: 0 } : { duration: 0.4, ease: EASE };
}

/**
 * Keeps content mounted and animates height 0 ↔ auto.
 * Parent must always render this (do not gate with `{open && ...}`),
 * otherwise enter/exit animations are skipped.
 */
export function SoftExpand({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="soft-expand"
      initial={false}
      animate={
        open
          ? { height: "auto", opacity: 1 }
          : { height: 0, opacity: 0 }
      }
      transition={expandTransition(reduced)}
      style={{ overflow: "hidden", pointerEvents: open ? "auto" : "none" }}
      aria-hidden={!open}
    >
      <div className="soft-expand-inner">{children}</div>
    </motion.div>
  );
}

export function SoftDisclosure({
  title,
  children,
  defaultOpen = false,
  badge,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = useReducedMotion();

  return (
    <div className={`soft-disclosure${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="soft-disclosure-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span className="soft-disclosure-right">
          {badge}
          <span className="soft-disclosure-chevron" aria-hidden />
        </span>
      </button>
      <motion.div
        className="soft-disclosure-body"
        initial={false}
        animate={
          open
            ? { height: "auto", opacity: 1 }
            : { height: 0, opacity: 0 }
        }
        transition={expandTransition(reduced)}
        style={{ overflow: "hidden", pointerEvents: open ? "auto" : "none" }}
        aria-hidden={!open}
      >
        <div className="soft-disclosure-inner">{children}</div>
      </motion.div>
    </div>
  );
}
