"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MUX_RTMP_URL } from "@/lib/mux-player";
import { CopyField } from "@/components/ui/CopyField";

type LiveStudioProps = {
  lessonId: string;
  titleUz: string;
  courseTitle: string;
  whenLabel: string;
  status: string;
  streamKey?: string | null;
};

export function LiveStudio({
  lessonId,
  titleUz,
  courseTitle,
  whenLabel,
  status,
  streamKey,
}: LiveStudioProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [key, setKey] = useState(
    streamKey && !streamKey.startsWith("demo_") ? streamKey : "",
  );

  const isLive = status === "live";
  const canStart = status === "scheduled";

  const act = async (action: "start" | "end") => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/teacher/lessons/${lessonId}/${action}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Xatolik");
      return;
    }
    const nextKey = data.lesson?.streamKey as string | undefined;
    if (nextKey && !nextKey.startsWith("demo_")) setKey(nextKey);
    if (data.demo) {
      setError("Mux ulanmagan. Haqiqiy efir ishlamaydi.");
      return;
    }
    router.refresh();
  };

  return (
    <section id="live" className={`live-studio${isLive ? " is-live" : ""}`}>
      <div className="live-studio-head">
        <div>
          {isLive ? (
            <span className="live-pill">
              <span className="live-dot" />
              Jonli efir
            </span>
          ) : (
            <span className="badge pending">Reja</span>
          )}
          <h2>{titleUz}</h2>
          <p className="muted small">
            {courseTitle} · {whenLabel}
          </p>
        </div>
        <div className="live-studio-actions">
          {canStart ? (
            <button className="btn btn-primary" type="button" disabled={loading} onClick={() => act("start")}>
              {loading ? "Ochilmoqda..." : "Efirni boshlash"}
            </button>
          ) : null}
          {isLive ? (
            <>
              <Link href={`/learn/${lessonId}`} className="btn">
                Talaba ko‘rinishi
              </Link>
              <button className="btn btn-danger" type="button" disabled={loading} onClick={() => act("end")}>
                {loading ? "Yopilmoqda..." : "Efirni tugatish"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {canStart ? (
        <ol className="live-steps">
          <li>Efirni boshlang — Mux stream key beriladi.</li>
          <li>OBS → Settings → Stream: Server va key ni qo‘ying.</li>
          <li>OBS da Start Streaming. Talabalar (2/3-tarif) darhol ko‘radi.</li>
        </ol>
      ) : null}

      {isLive && key ? (
        <div className="live-obs">
          <p className="small" style={{ margin: "0 0 10px" }}>
            OBS ochiq bo‘lsin. Kalitni hech kimga bermang.
          </p>
          <CopyField label="Server" value={MUX_RTMP_URL} />
          <CopyField label="Stream key" value={key} />
        </div>
      ) : null}

      {error ? (
        <div className="live-error">
          <p>{error}</p>
          {error.includes("dashboard.mux.com") ? (
            <a href="https://dashboard.mux.com/settings/billing" target="_blank" rel="noreferrer">
              Mux Billing ni ochish
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
