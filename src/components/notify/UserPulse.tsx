"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Send, X } from "lucide-react";
import type { PulseLive, PulseResponse } from "@/app/api/me/pulse/route";
import { tashkentParts } from "@/lib/utils";

const POLL_MS = 30_000;
const FAST_POLL_MS = 4_000;
const FAST_POLL_FOR_MS = 3 * 60_000;
const NUDGE_DELAY_MS = 2_000;
const LIVE_DISMISS_KEY = "lx-live-dismissed";
const NUDGE_CLOSED_KEY = "lx-tg-nudge-closed";

const HIDDEN_PATHS = /^\/(login|register|forgot-password|reset-password|onboard|invite|teacher\/live)(\/|$)/;
const NUDGE_HIDDEN_PATHS = /^\/(checkout|learn|admin)(\/|$)/;
/** /app already renders its own "Hozir efirda" focus card. */
const BAR_HIDDEN_PATHS = /^\/app\/?$/;

function readSession(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

function clock(iso: string) {
  const p = tashkentParts(new Date(iso));
  return `${p.hour}:${p.minute}`;
}

function liveMeta(item: PulseLive, now: number) {
  if (item.state === "live") {
    const mins = Math.floor((now - Date.parse(item.startedAt ?? item.scheduledAt)) / 60_000);
    if (mins < 1) return "hozirgina boshlandi";
    if (mins < 60) return `${mins} daqiqa oldin boshlandi`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h} soat${m ? ` ${m} daqiqa` : ""} oldin boshlandi`;
  }
  const left = Math.ceil((Date.parse(item.scheduledAt) - now) / 60_000);
  if (left > 0) return `${clock(item.scheduledAt)} da boshlanadi · ${left} daqiqadan keyin`;
  return "o‘qituvchi efirni boshlashi kutilmoqda";
}

/** Header bottom edge, so the floating bar never covers the navigation. */
function headerBottom() {
  let bottom = 0;
  document.querySelectorAll<HTMLElement>(".vn-header, .topbar").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height && r.bottom > bottom && r.top < 120) bottom = r.bottom;
  });
  return Math.max(8, Math.round(bottom) + 8);
}

function setFabReserve(px: number | null) {
  const root = document.documentElement;
  if (px == null) root.style.removeProperty("--lx-fab-reserve");
  else root.style.setProperty("--lx-fab-reserve", `${px}px`);
  window.dispatchEvent(new Event("resize"));
}

export function UserPulse() {
  const pathname = usePathname() ?? "/";
  const { status } = useSession();
  const [polled, setPulse] = useState<PulseResponse | null>(null);
  const pulse = status === "authenticated" ? polled : null;
  const [now, setNow] = useState(() => Date.now());
  const [fastUntil, setFastUntil] = useState(0);
  const [liveDismissed, setLiveDismissed] = useState<string | null>(null);
  const [nudgeClosed, setNudgeClosed] = useState(true);
  const [nudgeReady, setNudgeReady] = useState(false);
  const [justLinked, setJustLinked] = useState(false);
  const [barTop, setBarTop] = useState(72);
  const wasUnlinked = useRef(false);
  const nudgeRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/me/pulse", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as PulseResponse;
      setPulse(data);
      setNow(Date.now());
      if (data.loggedIn) window.dispatchEvent(new CustomEvent("lx:unread", { detail: data.unread }));
    } catch {}
  }, []);

  useEffect(() => {
    const restore = window.setTimeout(() => {
      setLiveDismissed(readSession(LIVE_DISMISS_KEY));
      setNudgeClosed(readSession(NUDGE_CLOSED_KEY) === "1");
    }, 0);
    const ready = window.setTimeout(() => setNudgeReady(true), NUDGE_DELAY_MS);
    return () => {
      window.clearTimeout(restore);
      window.clearTimeout(ready);
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [status, pathname, load]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const fast = fastUntil > Date.now();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
      if (fast && Date.now() > fastUntil) setFastUntil(0);
    }, fast ? FAST_POLL_MS : POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [status, fastUntil, load]);

  const linked = pulse?.loggedIn ? pulse.telegram.linked : true;
  useEffect(() => {
    if (!pulse?.loggedIn) return;
    if (!linked) {
      wasUnlinked.current = true;
      return;
    }
    if (!wasUnlinked.current) return;
    wasUnlinked.current = false;
    setJustLinked(true);
    setFastUntil(0);
    const t = window.setTimeout(() => setJustLinked(false), 2_500);
    return () => window.clearTimeout(t);
  }, [pulse, linked]);

  const hiddenHere = HIDDEN_PATHS.test(pathname);
  const live = pulse?.loggedIn && !hiddenHere && !BAR_HIDDEN_PATHS.test(pathname)
    ? pulse.live.filter((l) => !pathname.startsWith(`/learn/${l.lessonId}`))
    : [];
  const first = live[0] ?? null;
  const firstKey = first ? `${first.lessonId}:${first.state}` : null;
  const showBar = Boolean(first && firstKey !== liveDismissed);

  const nudgeRole = pulse?.loggedIn && (pulse.role === "student" || pulse.role === "teacher") ? pulse.role : null;
  const nudgeLink = pulse?.loggedIn ? pulse.telegram.link : null;
  const showNudge =
    nudgeReady &&
    !hiddenHere &&
    !NUDGE_HIDDEN_PATHS.test(pathname) &&
    nudgeRole != null &&
    (justLinked || (!linked && !nudgeClosed && Boolean(nudgeLink)));

  useLayoutEffect(() => {
    if (!showBar) return;
    let raf = 0;
    const place = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBarTop(headerBottom()));
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, { capture: true });
    };
  }, [showBar, pathname]);

  useEffect(() => {
    const el = nudgeRef.current;
    if (!showNudge || !el) return;
    const sync = () => {
      const visible = getComputedStyle(el).display !== "none";
      setFabReserve(visible ? Math.ceil(el.getBoundingClientRect().height) + 12 : null);
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setFabReserve(null);
    };
  }, [showNudge]);

  if (!showBar && !showNudge) return null;

  return (
    <>
      {showBar && first ? (
        <div
          className="lx-live-bar"
          data-state={first.state}
          role="status"
          style={{ top: barTop }}
          data-testid="live-now-bar"
        >
          <span className="lx-live-pill">
            <span className="lx-live-dot" aria-hidden />
            {first.state === "live" ? "Jonli efir" : "Kutish xonasi"}
          </span>
          <span className="lx-live-text">
            <strong title={first.title}>{first.title}</strong>
            <span>
              <span className="lx-live-course">{first.courseTitle} · </span>
              {liveMeta(first, now)}
            </span>
          </span>
          {live.length > 1 ? <span className="lx-live-more">+{live.length - 1}</span> : null}
          <Link href={`/learn/${first.lessonId}`} className="lx-live-cta" data-testid="live-now-join">
            {first.state === "live" ? "Darsga kirish" : "Kirish"}
          </Link>
          <button
            type="button"
            className="lx-live-close"
            aria-label="Yopish"
            onClick={() => {
              if (!firstKey) return;
              writeSession(LIVE_DISMISS_KEY, firstKey);
              setLiveDismissed(firstKey);
            }}
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : null}

      {showNudge ? (
        <aside
          ref={nudgeRef}
          className={`lx-tg-nudge${justLinked ? " is-linked" : ""}`}
          aria-label="Telegram bildirishnomalari"
          data-testid="telegram-nudge"
        >
          {!justLinked ? (
            <button
              type="button"
              className="lx-tg-close"
              aria-label="Yopish"
              onClick={() => {
                writeSession(NUDGE_CLOSED_KEY, "1");
                setNudgeClosed(true);
              }}
            >
              <X size={16} aria-hidden />
            </button>
          ) : null}
          <span className="lx-tg-ico" aria-hidden>
            {justLinked ? <Check size={20} /> : <Send size={19} />}
          </span>
          <div className="lx-tg-body">
            {justLinked ? (
              <>
                <strong>Telegram ulandi</strong>
                <p>Endi darslar haqida xabarlar Telegram’ga keladi.</p>
              </>
            ) : (
              <>
                <strong>{nudgeRole === "teacher" ? "Telegram’da xabardor bo‘ling" : "Darslarni o‘tkazib yubormang"}</strong>
                <p>
                  {nudgeRole === "teacher"
                    ? "Kurs tekshiruvi natijalari va dars eslatmalari Telegram’ga keladi."
                    : "Jonli efir boshlanganda Telegram’da darhol xabar olasiz."}
                </p>
                <a
                  href={nudgeLink ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lx-tg-cta"
                  data-testid="telegram-nudge-connect"
                  onClick={() => setFastUntil(Date.now() + FAST_POLL_FOR_MS)}
                >
                  Telegram’ga ulash
                </a>
              </>
            )}
          </div>
        </aside>
      ) : null}
    </>
  );
}
