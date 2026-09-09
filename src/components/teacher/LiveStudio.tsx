"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MUX_RTMP_URL } from "@/lib/mux-player";
import { CopyField } from "@/components/ui/CopyField";
import { MeetRoom, type MeetRoomHandle } from "@/components/live/MeetRoom";
import { LessonInventory } from "@/components/teacher/LessonInventory";

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
  const meetRef = useRef<MeetRoomHandle>(null);
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
    let recordingUrl: string | undefined;
    if (action === "end") {
      try {
        recordingUrl = (await meetRef.current?.saveRecording()) ?? undefined;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Yozuv yuklanmadi, dars yopiladi.");
      }
    }
    const res = await fetch(`/api/teacher/lessons/${lessonId}/${action}`, {
      method: "POST",
      headers: action === "end" ? { "Content-Type": "application/json" } : undefined,
      body: action === "end" ? JSON.stringify({ recordingUrl }) : undefined,
    });
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
            <button className="btn btn-primary" type="button" disabled={loading} onClick={() => void act("start")}>
              {loading ? "Ochilmoqda..." : "Efirni boshlash"}
            </button>
          ) : null}
          {isLive ? (
            <>
              <Link href={`/learn/${lessonId}`} className="btn">
                Talaba ko‘rinishi
              </Link>
              <button className="btn btn-danger" type="button" disabled={loading} onClick={() => void act("end")}>
                {loading ? "Yozuv saqlanmoqda..." : "Efirni tugatish"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {canStart ? (
        <ol className="live-steps">
          <li>Kerakli slayd yoki faylni pastdagi inventarga yuklang.</li>
          <li>Efirni boshlang — kamera shu sahifada ochiladi. Talabalar yon qatorda ko‘rinadi.</li>
          <li>Qo‘l ko‘targan o‘quvchiga mikrofon yoki kameraga ruxsat bering.</li>
          <li>Tugatganda dars avtomatik yozib olinadi va talabalar keyin ko‘ra oladi.</li>
        </ol>
      ) : null}

      {isLive ? (
        <div className="live-meet">
          <MeetRoom
            ref={meetRef}
            lessonId={lessonId}
            displayName={displayName}
            subject={titleUz}
            moderator
          />
        </div>
      ) : null}

      {isLive ? (
        <details className="lesson-inventory is-live-files">
          <summary>Dars fayllari — namoyish qilish</summary>
          <LessonInventory
            lessonId={lessonId}
            canPresent={isLive}
            onPresent={(file) => meetRef.current?.presentFile(file)}
          />
        </details>
      ) : (
        <LessonInventory
          lessonId={lessonId}
          canPresent={isLive}
          onPresent={(file) => meetRef.current?.presentFile(file)}
        />
      )}

      {isLive && key ? (
        <details className="live-obs-extra">
          <summary>OBS orqali yozib olish (ixtiyoriy)</summary>
          <p className="small" style={{ margin: "10px 0" }}>
            Brauzer allaqachon yozmoqda. OBS faqat zaxira uchun.
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
