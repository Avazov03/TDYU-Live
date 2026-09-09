import Link from "next/link";
import { fmt, formatDuration, formatRelativeDate, initials } from "@/lib/utils";
import { coverUrl } from "@/lib/thumbs";

export type VideoCardData = {
  id: string;
  titleUz: string;
  href: string;
  teacherName: string;
  teacherHref?: string;
  metaLine: string;
  durationSec?: number | null;
  viewCount?: number;
  createdAt: Date;
  playbackId?: string | null;
  live?: boolean;
  locked?: boolean;
};

export function VideoCard({ video, variant = "grid" }: { video: VideoCardData; variant?: "grid" | "search" }) {
  const dur = formatDuration(video.durationSec ?? null);
  const src = coverUrl(video.id, video.titleUz, video.playbackId);

  const thumb = (
    <div className={variant === "search" ? "search-thumb" : "thumb"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={video.titleUz} />
      {video.locked ? <span className="dur live-dur">YOPIQ</span> : video.live ? <span className="dur live-dur">JONLI</span> : dur ? <span className="dur">{dur}</span> : null}
    </div>
  );

  if (variant === "search") {
    return (
      <Link className="search-result" href={video.href}>
        {thumb}
        <div className="search-meta">
          <h3>{video.titleUz}</h3>
          <p>
            {video.viewCount != null ? `${fmt(video.viewCount)} ko'rish · ` : null}
            {formatRelativeDate(video.createdAt)}
          </p>
          <div className="row gap-8" style={{ margin: "8px 0" }}>
            <span className="avatar sm">{initials(video.teacherName)}</span>
            <span className="small muted">{video.teacherName}</span>
          </div>
          <p className="search-desc">{video.metaLine}</p>
        </div>
      </Link>
    );
  }

  return (
    <Link className="vcard" href={video.href}>
      {thumb}
      <div className="vmeta">
        <span className="avatar sm">{initials(video.teacherName)}</span>
        <div className="vinfo">
          <h3>{video.titleUz}</h3>
          <p>
            {video.teacherName} · {video.metaLine}
            {video.viewCount != null ? ` · ${fmt(video.viewCount)} ko'rish` : ""} · {formatRelativeDate(video.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}
