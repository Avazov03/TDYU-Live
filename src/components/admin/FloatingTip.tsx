"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type TipState = { text: string; x: number; y: number } | null;

const SPRING = { type: "spring" as const, stiffness: 380, damping: 26, mass: 0.5 };

export function useChartPointer(rootRef: React.RefObject<HTMLElement | null>) {
  const [tip, setTip] = useState<TipState>(null);
  const reduced = useReducedMotion();

  const pointFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const root = rootRef.current;
      if (!root) return null;
      const rect = root.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [rootRef],
  );

  const atEvent = useCallback(
    (e: React.MouseEvent, text: string) => {
      const p = pointFromEvent(e);
      if (!p) return;
      setTip({ text, x: p.x, y: p.y });
    },
    [pointFromEvent],
  );

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const p = pointFromEvent(e);
      if (!p) return;
      setTip((prev) => (prev ? { ...prev, x: p.x, y: p.y } : prev));
    },
    [pointFromEvent],
  );

  const clear = useCallback(() => setTip(null), []);

  return { tip, reduced, atEvent, onMove, clear };
}

export function FloatingTip({
  tip,
  reduced,
}: {
  tip: TipState;
  reduced: boolean | null;
}) {
  return (
    <AnimatePresence>
      {tip ? (
        <motion.div
          key="bubble"
          className="admin-tip-bubble"
          role="tooltip"
          initial={reduced ? false : { opacity: 0, scale: 0.84 }}
          animate={{
            opacity: 1,
            scale: 1,
            left: tip.x,
            top: tip.y,
          }}
          exit={reduced ? undefined : { opacity: 0, scale: 0.9 }}
          transition={
            reduced
              ? { duration: 0 }
              : {
                  left: SPRING,
                  top: SPRING,
                  opacity: { duration: 0.16 },
                  scale: { type: "spring", stiffness: 420, damping: 22 },
                }
          }
        >
          <span className="admin-tip-bubble-inner">{tip.text}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
