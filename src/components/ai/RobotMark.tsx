"use client";

import { useEffect, useRef } from "react";

const ROBOT_JSON = "/ai/robot.json";
const STILL_FRAME = 20;

let dataPromise: Promise<unknown> | null = null;
function loadRobotData() {
  dataPromise ??= fetch(ROBOT_JSON).then((r) => {
    if (!r.ok) throw new Error(`robot ${r.status}`);
    return r.json();
  });
  dataPromise.catch(() => {
    dataPromise = null;
  });
  return dataPromise;
}

/** Lottie robot. `animate` loops it unless the user prefers reduced motion; otherwise a still frame. */
export function RobotMark({ animate = false, className = "" }: { animate?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let destroyed = false;
    let anim: { destroy: () => void } | null = null;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const play = animate && !reduce;

    Promise.all([import("lottie-web/build/player/lottie_light"), loadRobotData()])
      .then(([mod, data]) => {
        if (destroyed) return;
        const lottie = mod.default;
        const a = lottie.loadAnimation({
          container: el,
          renderer: "svg",
          loop: play,
          autoplay: play,
          animationData: structuredClone(data),
          rendererSettings: { preserveAspectRatio: "xMidYMid meet", progressiveLoad: true },
        });
        if (!play) a.goToAndStop(STILL_FRAME, true);
        anim = a;
      })
      .catch(() => {});

    return () => {
      destroyed = true;
      anim?.destroy();
    };
  }, [animate]);

  return <span ref={ref} className={`lx-ai-robot ${className}`.trim()} aria-hidden="true" />;
}
