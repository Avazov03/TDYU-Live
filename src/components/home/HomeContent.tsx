"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { VideoCard, type VideoCardData } from "@/components/video/VideoCard";

type ChipFilterProps = {
  chips: string[];
  videos: VideoCardData[];
  facultyMap: Record<string, string[]>;
};

export function HomeContent({ chips, videos, facultyMap }: ChipFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("filter") ?? "Hammasi";

  const filtered =
    active === "Hammasi"
      ? videos
      : facultyMap[active]
        ? videos.filter((v) => facultyMap[active].includes(v.id))
        : videos.filter((v) => v.metaLine.includes(active));

  const setFilter = (name: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (name === "Hammasi") params.delete("filter");
    else params.set("filter", name);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <>
      <div className="chiprow">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip${active === c ? " active" : ""}`}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid">
        {filtered.length > 0 ? (
          filtered.map((v) => <VideoCard key={v.id} video={v} />)
        ) : (
          <div className="empty">Bu mavzu bo&apos;yicha dars topilmadi.</div>
        )}
      </div>
    </>
  );
}
