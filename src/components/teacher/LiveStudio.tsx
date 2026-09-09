"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MUX_RTMP_URL } from "@/lib/mux-player";
import { CopyField } from "@/components/ui/CopyField";
import { MeetRoom } from "@/components/live/MeetRoom";

type LiveStudioProps = {
  lessonId: string;
  titleUz: string;
  courseTitle: string;
  whenLabel: string;
  status: string;
  streamKey?: string | null;
  displayName: string;
};

export function LiveStudio({
  lessonId,
  titleUz,
  courseTitle,
  whenLabel,
  status,
  streamKey,
  displayName,
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
          <li>Efirni boshlang — kamera va mikrofon shu sahifada ochiladi (Zoom / Google Meet kabi).</li>
          <li>Brauzer so‘rasa, kameraga ruxsat bering. Talabalar dars sahifasidan kiradi.</li>
          <li>2/3-tarifdagi o‘quvchilar sizni va bir-birini ko‘radi.</li>
        </ol>
      ) : null}

      {isLive ? (
        <div className="live-meet">
          <p className="small muted" style={{ margin: "0 0 10px" }}>
            Kamerani yoqing. Talabalar «Talaba ko‘rinishi» yoki o‘z dars sahifasidan shu xonaga kiradi.
          </p>
          <MeetRoom
            lessonId={lessonId}
            displayName={displayName}
            subject={titleUz}
            moderator
          />
        </div>
      ) : null}

      {isLive && key ? (
        <details className="live-obs-extra">
          <summary>OBS orqali yozib olish (ixtiyoriy)</summary>
          <p className="small" style={{ margin: "10px 0" }}>
            Dars brauzerda allaqachon ketmoqda. OBS faqat yozuv uchun.
          </p>
          <CopyField label="Server" value={MUX_RTMP_URL} />
          <CopyField label="Stream key" value={key} />
        </details>
      ) : null}

      {error ? (
        <div className="live-error">
          <p>{error}</p>
        </div>
      ) : null}
    </section>
  );
}
