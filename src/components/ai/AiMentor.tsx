"use client";

import { ArrowUp, ChevronRight, Maximize2, Minimize2, Plus, Square, SquarePen, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AI_HISTORY_MAX, AI_MESSAGE_MAX_CHARS, parsePageContext } from "@/lib/ai/policy";
import { AiMarkdown } from "./AiMarkdown";
import type { AiStatus } from "./AiMentorMount";
import { RobotMark } from "./RobotMark";
import { suggestionsFor } from "./suggestions";

type Msg = { role: "user" | "model"; text: string; error?: boolean };
type Pos = { x: number; y: number };

const EDGE = 12;
const POS_KEY = "lx-ai-pos";
const GREETED_KEY = "lx-ai-greeted";
const GUEST_KEY = "lx-ai-guest";
const DRAG_SLOP = 6;

/** Must match `.lx-ai-fab` width/height (desktop / ≤640px). */
function fabSize() {
  return window.innerWidth <= 640 ? { w: 72, h: 95 } : { w: 92, h: 122 };
}

/** Space a page keeps for its own fixed bottom bar, from `--lx-fab-reserve` on :root. */
function bottomReserve() {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--lx-fab-reserve")) || 0;
}

function clampPos(p: Pos): Pos {
  const { w, h } = fabSize();
  const maxX = window.innerWidth - w - EDGE;
  const maxY = window.innerHeight - h - EDGE - bottomReserve();
  return { x: Math.min(Math.max(EDGE, p.x), maxX), y: Math.min(Math.max(EDGE, p.y), maxY) };
}

function defaultPos(): Pos {
  const { w, h } = fabSize();
  return { x: window.innerWidth - w - 20, y: window.innerHeight - h - 16 };
}

function snap(p: Pos): Pos {
  const { w } = fabSize();
  const mid = window.innerWidth / 2;
  return clampPos({ x: p.x + w / 2 < mid ? EDGE : window.innerWidth - w - EDGE, y: p.y });
}

export function AiMentor({ status, pathname }: { status: AiStatus; pathname: string }) {
  const page = useMemo(() => parsePageContext(pathname), [pathname]);
  const suggestions = useMemo(() => suggestionsFor(status.role, page), [status.role, page]);
  const isGuest = status.role === "guest";

  const [pos, setPos] = useState<Pos>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as Pos | null;
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return clampPos(saved);
    } catch {}
    return clampPos(defaultPos());
  });
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [greet, setGreet] = useState(false);
  const [hiddenByPage, setHiddenByPage] = useState(false);
  const [moreTips, setMoreTips] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [toolNote, setToolNote] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onResize = () => setPos((cur) => clampPos(cur));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setPos((cur) => clampPos(cur)));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const hidden = Boolean(document.querySelector("[data-ai-mentor-hide]"));
      setHiddenByPage(hidden);
      if (hidden) setOpen(false);
    };
    frame = requestAnimationFrame(check);
    const obs = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(check);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(GREETED_KEY)) return;
    } catch {
      return;
    }
    const show = window.setTimeout(() => {
      setGreet(true);
      try {
        sessionStorage.setItem(GREETED_KEY, "1");
      } catch {}
    }, 1500);
    const hide = window.setTimeout(() => setGreet(false), 11_500);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  const restoreOnce = () => {
    if (loaded) return;
    setLoaded(true);
    if (isGuest) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(GUEST_KEY) ?? "[]") as Msg[];
        if (Array.isArray(saved)) setMessages(saved.slice(-30));
      } catch {}
      return;
    }
    fetch("/api/ai/conversation", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.conversation) return;
        setConversationId((cur) => cur ?? j.conversation.id);
        setMessages((cur) => (cur.length ? cur : (j.conversation.messages as Msg[])));
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!isGuest || !loaded) return;
    try {
      sessionStorage.setItem(GUEST_KEY, JSON.stringify(messages.filter((m) => !m.error).slice(-30)));
    } catch {}
  }, [messages, isGuest, loaded]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, toolNote]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        fabRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_SLOP) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
      setGreet(false);
    }
    setPos(clampPos({ x: d.ox + dx, y: d.oy + dy }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    justDragged.current = true;
    window.setTimeout(() => {
      justDragged.current = false;
    }, 0);
    setDragging(false);
    setPos((cur) => {
      const next = snap(cur);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const onFabClick = (e: React.MouseEvent) => {
    if (justDragged.current) {
      justDragged.current = false;
      e.preventDefault();
      return;
    }
    setGreet(false);
    if (!open) restoreOnce();
    setOpen(!open);
  };

  const onFabKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 48 : 16;
    const delta: Record<string, Pos> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const next = clampPos({ x: pos.x + d.x, y: pos.y + d.y });
    setPos(next);
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(next));
    } catch {}
  };

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setConversationId(null);
    setToolNote(null);
    setBusy(false);
    setMoreTips(false);
    inputRef.current?.focus();
  }, []);

  const stop = () => abortRef.current?.abort();

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, AI_MESSAGE_MAX_CHARS);
    if (!text || busy) return;
    const history = messages.filter((m) => !m.error).slice(-AI_HISTORY_MAX);
    setMessages((cur) => [...cur, { role: "user", text }, { role: "model", text: "" }]);
    setInput("");
    setBusy(true);
    setMoreTips(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const patchLast = (fn: (m: Msg) => Msg) => {
      if (abortRef.current !== ctrl) return;
      setMessages((cur) => {
        if (cur.length === 0) return cur;
        const copy = cur.slice();
        copy[copy.length - 1] = fn(copy[copy.length - 1]);
        return copy;
      });
    };

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          pathname,
          ...(conversationId ? { conversationId } : {}),
          ...(isGuest ? { history } : {}),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => null);
        patchLast(() => ({ role: "model", text: j?.error ?? "Xatolik yuz berdi. Qayta urinib ko‘ring.", error: true }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as
            | { type: "meta"; conversationId: string | null }
            | { type: "text"; t: string }
            | { type: "tool"; name: string }
            | { type: "done"; conversationId?: string | null }
            | { type: "error"; error: string };
          if (ev.type === "meta" || ev.type === "done") {
            if (ev.conversationId && abortRef.current === ctrl) setConversationId(ev.conversationId);
          } else if (ev.type === "text") {
            setToolNote(null);
            patchLast((m) => ({ ...m, text: m.text + ev.t }));
          } else if (ev.type === "tool") {
            setToolNote("Ma'lumotlar tekshirilmoqda…");
          } else if (ev.type === "error") {
            patchLast((m) => ({ ...m, text: m.text || ev.error, error: !m.text }));
          }
        }
      }
    } catch {
      if (ctrl.signal.aborted) {
        patchLast((m) => (m.text ? m : { ...m, text: "To‘xtatildi.", error: true }));
      } else {
        patchLast(() => ({ role: "model", text: "Aloqa uzildi. Qayta urinib ko‘ring.", error: true }));
      }
    } finally {
      if (abortRef.current === ctrl) {
        abortRef.current = null;
        setBusy(false);
        setToolNote(null);
      }
    }
  };

  if (hiddenByPage) return null;

  const fab = fabSize();
  const side = pos.x + fab.w / 2 < window.innerWidth / 2 ? "left" : "right";
  const above = pos.y > window.innerHeight / 2;
  const name = status.firstName;
  const visibleTips = moreTips ? suggestions : suggestions.slice(0, 3);
  const empty = messages.length === 0;

  return (
    <>
      {greet && !open ? (
        <div
          className="lx-ai-greet"
          data-side={side}
          data-above={above ? "" : undefined}
          style={{
            top: above ? undefined : pos.y + fab.h + 8,
            bottom: above ? window.innerHeight - pos.y + 4 : undefined,
            [side]: side === "left" ? pos.x : window.innerWidth - pos.x - fab.w,
          }}
          data-testid="ai-greet"
        >
          <span className="lx-ai-pill">AI mentor</span>
          <p>
            Salom{name ? `, ${name}` : ""}! Men AI mentorman{"\u00a0"}👋
            <br />
            Savolingiz bo‘lsa, yozing.
          </p>
          <button type="button" className="lx-ai-icon-btn" aria-label="Yopish" onClick={() => setGreet(false)}>
            <X size={14} />
          </button>
        </div>
      ) : null}

      <button
        ref={fabRef}
        type="button"
        className="lx-ai-fab"
        data-dragging={dragging ? "" : undefined}
        data-open={open ? "" : undefined}
        style={{ left: pos.x, top: pos.y }}
        aria-label={open ? "AI mentorni yopish" : "AI mentorni ochish"}
        aria-expanded={open}
        aria-controls="lx-ai-panel"
        title="AI mentor — sudrab joyini o‘zgartiring"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onFabClick}
        onKeyDown={onFabKey}
        data-testid="ai-fab"
      >
        <RobotMark animate />
      </button>

      <section
        id="lx-ai-panel"
        className="lx-ai-panel"
        data-open={open ? "" : undefined}
        data-full={full ? "" : undefined}
        data-side={side}
        role="dialog"
        aria-label="AI mentor"
        aria-hidden={!open}
        inert={!open}
        data-testid="ai-panel"
      >
        <header className="lx-ai-head">
          <span className="lx-ai-head-title">
            <span className="lx-ai-head-mark">
              <RobotMark />
            </span>
            AI mentor
          </span>
          <span className="lx-ai-head-actions">
            <button type="button" className="lx-ai-icon-btn" aria-label="Yangi chat" title="Yangi chat" onClick={newChat} data-testid="ai-new-chat">
              <SquarePen size={17} />
            </button>
            <button
              type="button"
              className="lx-ai-icon-btn lx-ai-only-desktop"
              aria-label={full ? "Kichraytirish" : "To‘liq ekran"}
              title={full ? "Kichraytirish" : "To‘liq ekran"}
              onClick={() => setFull((v) => !v)}
            >
              {full ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <button type="button" className="lx-ai-icon-btn" aria-label="Yopish" title="Yopish" onClick={() => setOpen(false)} data-testid="ai-close">
              <X size={18} />
            </button>
          </span>
        </header>

        <div className="lx-ai-body" ref={listRef} aria-live="polite">
          {empty ? (
            <div className="lx-ai-hello">
              <h2>Salom{name ? `, ${name}` : ""}</h2>
              <p>Bizga nima xizmat?</p>
            </div>
          ) : (
            <div className="lx-ai-msgs">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="lx-ai-msg lx-ai-msg-user">
                    {m.text}
                  </div>
                ) : (
                  <div key={i} className="lx-ai-msg lx-ai-msg-ai" data-error={m.error ? "" : undefined} data-testid="ai-answer">
                    {m.text ? (
                      <AiMarkdown text={m.text} onNavigate={() => setOpen(false)} />
                    ) : (
                      <span className="lx-ai-typing" aria-label="Yozmoqda">
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>
                ),
              )}
              {toolNote ? <div className="lx-ai-note">{toolNote}</div> : null}
            </div>
          )}

          {empty || moreTips ? (
            <div className="lx-ai-tips">
              {visibleTips.map((s) => (
                <button key={s} type="button" className="lx-ai-chip" onClick={() => void send(s)} disabled={busy}>
                  {s}
                </button>
              ))}
              {!moreTips && suggestions.length > 3 ? (
                <button type="button" className="lx-ai-more" onClick={() => setMoreTips(true)}>
                  Boshqa takliflar <ChevronRight size={15} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <form
          className="lx-ai-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="lx-ai-inputbox">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={AI_MESSAGE_MAX_CHARS}
              placeholder="Savolingizni yozing…"
              aria-label="Xabar"
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              data-testid="ai-input"
            />
            <div className="lx-ai-input-row">
              <button
                type="button"
                className="lx-ai-icon-btn lx-ai-plus"
                aria-label="Takliflar"
                title="Takliflar"
                aria-pressed={moreTips}
                onClick={() => setMoreTips((v) => !v)}
              >
                <Plus size={18} />
              </button>
              {busy ? (
                <button type="button" className="lx-ai-send" aria-label="To‘xtatish" onClick={stop} data-testid="ai-stop">
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button type="submit" className="lx-ai-send" aria-label="Yuborish" disabled={!input.trim()} data-testid="ai-send">
                  <ArrowUp size={18} />
                </button>
              )}
            </div>
          </div>
          <p className="lx-ai-disclaimer">AI xato qilishi mumkin. Muhim ma&apos;lumotni tekshiring.</p>
        </form>
      </section>
    </>
  );
}
