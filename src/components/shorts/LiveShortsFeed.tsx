"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { muxPlayerUrl } from "@/lib/mux-player";

export type LiveShort = {
  id: string;
  titleUz: string;
  teacherName: string;
  teacherId: string;
  playbackId: string | null;
  viewHint: string;
};

export function LiveShortsFeed({ shorts }: { shorts: LiveShort[] }) {
  const [index, setIndex] = useState(0);
  const current = shorts[index];
  if (!current) return null;

  const playback = current.playbackId && !current.playbackId.startsWith("demo_")
    ? muxPlayerUrl(current.playbackId)
    : null;

  return (
    <div className="shorts-viewport">
      <div className="shorts-progress">
        {index + 1} / {shorts.length}
      </div>
      <div className="shorts-nav-arrows">
        <button
          type="button"
          className="shorts-nav-btn"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          aria-label="Oldingi"
        >
          <Icon name="chevronUp" />
        </button>
        <button
          type="button"
          className="shorts-nav-btn"
          disabled={index === shorts.length - 1}
          onClick={() => setIndex((i) => Math.min(shorts.length - 1, i + 1))}
          aria-label="Keyingi"
        >
          <Icon name="chevronDown" />
        </button>
      </div>
      <div className="shorts-slide">
        <div className="shorts-stage-inner">
          <div className="shorts-stack">
            <div className="shorts-player">
              {playback ? (
                <iframe src={playback} title={current.titleUz} allow="autoplay; encrypted-media" allowFullScreen />
              ) : (
                <div className="shorts-player-placeholder" />
              )}
              <div className="shorts-gradient" />
              <div className="shorts-bottom-info">
                <div className="shorts-channel">
                  <span className="shorts-channel-name">{current.teacherName}</span>
                </div>
                <p className="shorts-caption">{current.titleUz}</p>
                <div className="shorts-stats">{current.viewHint}</div>
              </div>
            </div>
            <div className="shorts-rail">
              <Link href={`/learn/${current.id}`} className="shorts-rail-btn" aria-label="To'liq dars">
                <Icon name="play" />
                <span>Dars</span>
              </Link>
              <Link href={`/learn/${current.id}`} className="shorts-rail-btn" aria-label="Ulashish">
                <Icon name="share" />
                <span>Ulashish</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
