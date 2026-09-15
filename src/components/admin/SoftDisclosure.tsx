"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const expandTransition = (reduced: boolean | null) =>
  reduced
    ? { duration: 0 }
    : { duration: 0.4, ease: EASE };

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
      <button type="button" className="soft-disclosure-trigger" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span className="soft-disclosure-right">
          {badge}
          <span className="soft-disclosure-chevron" aria-hidden />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            className="soft-disclosure-body"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? undefined : { height: 0, opacity: 0 }}
            transition={expandTransition(reduced)}
          >
            <div className="soft-disclosure-inner">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function SoftExpand({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="expand"
          className="soft-expand"
          initial={reduced ? false : { height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={reduced ? undefined : { height: 0, opacity: 0 }}
          transition={expandTransition(reduced)}
        >
          <div className="soft-expand-inner">{children}</div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
