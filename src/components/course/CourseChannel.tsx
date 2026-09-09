"use client";

import { useState, type ReactNode } from "react";
import { initials } from "@/lib/utils";

export function CourseChannel({
  titleUz,
  descriptionUz,
  teacherName,
  facultyName,
  subjectName,
  subscriberCount,
  subscribed,
  lessons,
  tariffs,
  initial = "lessons",
}: {
  titleUz: string;
  descriptionUz: string;
  teacherName: string;
  facultyName: string;
  subjectName: string;
  subscriberCount: number;
  subscribed: boolean;
  lessons: ReactNode;
  tariffs: ReactNode;
  initial?: "lessons" | "tariffs";
}) {
  const [tab, setTab] = useState<"lessons" | "tariffs">(initial);

  return (
    <>
      <div className="channel-banner" />
      <div className="channel-head">
        <span className="avatar xl">{initials(teacherName)}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="small muted">
            {facultyName} · {subjectName}
          </div>
          <h2 style={{ fontSize: 22, margin: "4px 0 6px" }}>{titleUz}</h2>
          <div className="muted small">
            {teacherName} · {subscriberCount} obunachi
          </div>
        </div>
        {subscribed ? (
          <span className="btn btn-sm sub-btn">Obuna</span>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setTab("tariffs")}>
            Obuna bo&apos;lish
          </button>
        )}
      </div>
      <p className="muted channel-desc">{descriptionUz}</p>
      <div className="tabs">
        <button
          type="button"
          className={`tab${tab === "lessons" ? " active" : ""}`}
          onClick={() => setTab("lessons")}
        >
          Darslar
        </button>
        <button
          type="button"
          className={`tab${tab === "tariffs" ? " active" : ""}`}
          onClick={() => setTab("tariffs")}
        >
          Tariflar
        </button>
      </div>
      {tab === "lessons" ? lessons : tariffs}
    </>
  );
}
