"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export function LessonListToggle({
  total,
  visible,
  children,
}: {
  total: number;
  visible: number;
  children: ReactNode;
}) {
  const [all, setAll] = useState(false);
  const collapsible = total > visible;
  return (
    <div className="lx-cd-lessons-wrap" data-all={all || !collapsible ? "" : undefined}>
      <ol className="lx-cd-lessons">{children}</ol>
      {collapsible ? (
        <button type="button" className="lx-cd-more lx-cd-more-list" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? "Yig‘ish" : `Barcha ${total} darsni ko‘rsatish`}
          <Icon name={all ? "chevronUp" : "chevronDown"} size={16} />
        </button>
      ) : null}
    </div>
  );
}
