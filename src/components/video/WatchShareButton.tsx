"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

export function WatchShareButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button type="button" className="btn btn-sm" onClick={share}>
      <Icon name="share" size={16} />
      {copied ? "Nusxa olindi" : "Ulashish"}
    </button>
  );
}
