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
  const isLobby = status === "lobby" || status === "waiting_room";
  const canOpenLobby = status === "scheduled";
  const inRoom = isLive || isLobby;

  const act = async (action: "lobby" | "start" | "end") => {
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
    if (action === "end") {
      window.location.href = "/teacher";
      return;
    }
    router.refresh();
  };

  return (
    <section id="live" className={`live-studio${isLive ? " is-live" : ""}${isLobby ? " is-lobby" : ""}`}>
      <div className="live-studio-head">
        <div>
          {isLive ? (
            <span className="live-pill">
              <span className="live-dot" />
              Jonli efir
            </span>
          ) : isLobby ? (
            <span className="badge accent">Kutish xonasi</span>
          ) : (
            <span className="badge pending">Tanlangan dars</span>
          )}
          <p className="lx-kicker" style={{ marginTop: 8 }}>
            {courseTitle}
          </p>
          <h2>{titleUz}</h2>
          <p className="muted small">{whenLabel}</p>
        </div>
        <div className="live-studio-actions">
          {canOpenLobby ? (
            <button
              className="btn btn-primary"
              type="button"
              data-testid="live-open-waiting"
              disabled={loading}
              onClick={() => void act("lobby")}
            >
              {loading ? "Ochilmoqda..." : "Kutish xonasini ochish"}
            </button>
          ) : null}
          {isLobby ? (
            <button
              className="btn btn-primary"
              type="button"
              data-testid="live-start"
              disabled={loading}
              onClick={() => void act("start")}
            >
              {loading ? "Boshlanmoqda..." : "Jonli efirni boshlash"}
            </button>
          ) : null}
          {inRoom ? (
            <Link href={`/learn/${lessonId}`} className="btn">
              Talaba ko‘rinishi
            </Link>
          ) : null}
          {isLive ? (
            <button
              className="btn btn-danger"
              type="button"
              data-testid="live-end"
              disabled={loading}
              onClick={() => void act("end")}
            >
              {loading ? "Yozuv saqlanmoqda..." : "Efirni tugatish"}
            </button>
          ) : null}
          {isLobby ? (
            <button className="btn btn-danger" type="button" disabled={loading} onClick={() => void act("end")}>
              {loading ? "Yopilmoqda..." : "Kutishni yopish"}
            </button>
          ) : null}
        </div>
      </div>

      {canOpenLobby ? (
        <details className="live-steps-fold">
          <summary>Qanday ishlaydi?</summary>
          <ol className="live-steps">
            <li>Kutish xonasini oching — talabalar kirib chatda kutadi (yozuv yo‘q).</li>
            <li>«Jonli efirni boshlash» — shu paytdan REC ketadi.</li>
            <li>Tugatganda yozuv saqlanadi.</li>
          </ol>
        </details>
      ) : null}

      {isLobby ? (
        <div className="live-lobby-banner">
          <strong>Kutish rejimi</strong>
          <span className="small muted">
            Chat va kirish ochiq. Kamerani sinab ko‘ring. Yozuv faqat «Jonli efirni boshlash»dan keyin.
          </span>
        </div>
      ) : null}

      {inRoom ? (
        <div className="live-meet">
          <MeetRoom
            key={`${lessonId}-${status}`}
            ref={meetRef}
            lessonId={lessonId}
            displayName={displayName}
            subject={titleUz}
            moderator
            phase={isLive ? "live" : "lobby"}
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
          canPresent={false}
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
