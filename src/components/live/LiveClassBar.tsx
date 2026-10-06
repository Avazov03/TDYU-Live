"use client";

import { useEffect, useId, useRef, useState } from "react";

type Clock = {
  status: string;
  remainingSec: number;
  warning: 55 | 58 | 59 | null;
  manualPause: boolean;
  autoEnd: boolean;
  projectedTeachingSeconds: number;
};

type Stroke = { id: string; d: string; color: string; size: number; tool: "pen" | "erase" };

function fmt(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function LiveClassBar({
  lessonId,
  displayName,
  moderator,
  phase,
  sharing,
}: {
  lessonId: string;
  displayName: string;
  moderator?: boolean;
  phase?: "lobby" | "live";
  sharing?: boolean;
}) {
  const [instanceId] = useState(() => ({
    current:
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `inst-${Date.now()}`,
  }));
  const [clock, setClock] = useState<Clock | null>(null);
  const [latchedWarning, setLatchedWarning] = useState<55 | 58 | 59 | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [capture, setCapture] = useState(false);
  const [superseded, setSuperseded] = useState(false);
  const [board, setBoard] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const draw = useRef<string>("");
  const boardId = useId();

  useEffect(() => {
    if (phase !== "live" || superseded) return;
    let stop = false;
    let claimed = false;
    const tick = async (manualPause?: boolean) => {
      const res = await fetch("/api/live/clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          instanceId: instanceId.current,
          claim: !claimed && !moderator,
          ...(manualPause === undefined ? {} : { manualPause }),
          ...(moderator ? { capture: Boolean(sharing) } : {}),
        }),
      });
      claimed = true;
      const data = await res.json().catch(() => ({}));
      if (stop) return;
      if (data.superseded) {
        setSuperseded(true);
        return;
      }
      if (data.courseTitle) setCourseTitle(data.courseTitle);
      if (typeof data.capture === "boolean") setCapture(data.capture);
      if (data.clock) {
        setClock(data.clock);
        if (data.clock.warning) setLatchedWarning(data.clock.warning);
      }
      if (data.clock?.autoEnd) window.location.reload();
    };
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [instanceId, lessonId, moderator, phase, sharing, superseded]);

  useEffect(() => {
    if (!board) return;
    let stop = false;
    const pull = async () => {
      const res = await fetch(`/api/live/whiteboard?lessonId=${encodeURIComponent(lessonId)}`);
      const data = await res.json().catch(() => ({}));
      if (!stop && Array.isArray(data.strokes)) setStrokes(data.strokes);
    };
    void pull();
    const id = window.setInterval(() => void pull(), 1000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [board, lessonId]);

  const sendStroke = async (stroke: Stroke) => {
    const res = await fetch("/api/live/whiteboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, action: "stroke", stroke }),
    });
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.strokes)) setStrokes(data.strokes);
  };

  const boardAction = async (action: "undo" | "clear") => {
    const res = await fetch("/api/live/whiteboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (Array.isArray(data.strokes)) setStrokes(data.strokes);
  };

  const pause = async (next: boolean) => {
    await fetch("/api/live/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId,
        instanceId: instanceId.current,
        manualPause: next,
        capture: Boolean(sharing),
      }),
    });
  };

  if (phase !== "live") return null;

  const stamp = new Date().toLocaleString("uz-UZ", { hour12: false });

  return (
    <>
      <span className="small" data-testid="live-teaching-clock" style={{ marginLeft: 8 }}>
        {clock?.manualPause ? "Pauza" : "Dars"} {clock ? fmt(clock.remainingSec) : "60:00"}
        {(clock?.warning ?? latchedWarning) ? ` · ${clock?.warning ?? latchedWarning} daqiqa qoldi` : ""}
      </span>
      {moderator ? (
        <button
          type="button"
          className="btn btn-sm"
          data-testid="live-pause-btn"
          onClick={() => void pause(!clock?.manualPause)}
        >
          {clock?.manualPause ? "Davom ettirish" : "Pauza"}
        </button>
      ) : null}
      <button type="button" className="btn btn-sm" data-testid="live-whiteboard-btn" onClick={() => setBoard((v) => !v)}>
        Doska
      </button>
      {superseded ? (
        <p className="small" data-testid="live-superseded">
          Bu dars boshqa qurilmada ochildi. Shu oynani yoping.
        </p>
      ) : null}
      {capture ? (
        <div
          data-testid="live-watermark"
          style={{
            position: "absolute",
            right: 16,
            bottom: 72,
            zIndex: 5,
            color: "rgba(255,255,255,0.85)",
            fontSize: 13,
            pointerEvents: "none",
          }}
        >
          {displayName} · {courseTitle || "Kurs"} · {stamp}
        </div>
      ) : null}
      {board ? (
        <div
          data-testid="live-whiteboard"
          style={{ position: "absolute", inset: 64, zIndex: 4, background: "rgba(8,10,16,0.72)" }}
        >
          <svg
            aria-label={boardId}
            width="100%"
            height="100%"
            style={{ touchAction: "none" }}
            onPointerDown={(e) => {
              if (!moderator) return;
              const box = e.currentTarget.getBoundingClientRect();
              draw.current = `M ${e.clientX - box.left} ${e.clientY - box.top}`;
            }}
            onPointerMove={(e) => {
              if (!moderator || !draw.current) return;
              const box = e.currentTarget.getBoundingClientRect();
              draw.current += ` L ${e.clientX - box.left} ${e.clientY - box.top}`;
            }}
            onPointerUp={() => {
              if (!moderator || !draw.current) return;
              const stroke: Stroke = {
                id: `${Date.now()}`,
                d: draw.current,
                color: "#f4f1ea",
                size: 3,
                tool: "pen",
              };
              draw.current = "";
              void sendStroke(stroke);
            }}
          >
            {strokes.map((s) => (
              <path key={s.id} d={s.d} stroke={s.color} strokeWidth={s.size} fill="none" />
            ))}
          </svg>
          {moderator ? (
            <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-sm" onClick={() => void boardAction("undo")}>
                Undo
              </button>
              <button type="button" className="btn btn-sm" onClick={() => void boardAction("clear")}>
                Tozalash
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
