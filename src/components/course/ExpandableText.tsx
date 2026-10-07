"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export function ExpandableText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setClipped(el.scrollHeight - el.clientHeight > 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div className={`lx-cd-expand${open ? " is-open" : ""}`}>
      <p ref={ref} className={className}>
        {text}
      </p>
      {clipped || open ? (
        <button type="button" className="lx-cd-more" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? "Yig‘ish" : "To‘liq o‘qish"}
          <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />
        </button>
      ) : null}
    </div>
  );
}
