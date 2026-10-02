import Link from "next/link";
import type { ReactNode } from "react";
import { isKnownAppHref } from "@/lib/ai/policy";

const INLINE = /\*\*([^*]+)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function inline(text: string, onNavigate?: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={key++}>{m[1]}</strong>);
    } else if (m[2] !== undefined) {
      out.push(<em key={key++}>{m[2]}</em>);
    } else if (isKnownAppHref(m[4])) {
      out.push(
        <Link key={key++} href={m[4]} onClick={onNavigate}>
          {m[3]}
        </Link>,
      );
    } else {
      out.push(m[3]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Minimal, XSS-free renderer: paragraphs, "- " / "1. " lists, **bold**, internal links. No raw HTML. */
export function AiMarkdown({ text, onNavigate }: { text: string; onNavigate?: () => void }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, onNavigate)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const num = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = Boolean(num);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(
      heading ? (
        <p key={blocks.length}>
          <strong>{inline(heading[1], onNavigate)}</strong>
        </p>
      ) : (
        <p key={blocks.length}>{inline(line, onNavigate)}</p>
      ),
    );
  }
  flush();
  return <>{blocks}</>;
}
