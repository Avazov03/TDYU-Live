import Link from "next/link";

/** Bo‘sh holat: bitta maqsad, bitta CTA. */
export function EmptyGuide({
  title,
  text,
  href,
  cta,
}: {
  title: string;
  text: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="lx-empty">
      <h3>{title}</h3>
      <p className="muted small">{text}</p>
      <Link href={href} className="btn btn-primary">
        {cta}
      </Link>
    </div>
  );
}
