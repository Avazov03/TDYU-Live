# Phase 8 / Recording Wave 2 — Signed Mux Playback

**Status:** Staging via `FF_RECORDING_SIGNED_PLAYBACK_V1=true` (requires Wave 1 `FF_RECORDING_REVIEW_V1`)  
**Production untouched** — flag defaults **OFF**.

---

## 1. Existing Mux architecture

| Piece | Implementation |
|-------|----------------|
| SDK | **None** — raw `fetch` to Mux REST (`src/lib/mux.ts`) |
| Live create | `playback_policy: public` for live; VOD via `new_asset_settings` |
| Player | `https://player.mux.com/{playbackId}` (`mux-player.ts`) |
| Wave 1 | Recording lifecycle + publish gate + media authz |

Wave 1 limitation: Mux VOD playback IDs were **public** at CDN.

---

## 2. Wave 1 lifecycle (unchanged)

`processing → teacher_review → published`  
Students still require `published` + Enrollment.

---

## 3–6. Signed playback + authorization

```
session → Enrollment (getLessonAccess) → Recording published
  → server loads recording.muxPlaybackId (never from client)
  → RS256 Mux JWT (or fixture/local mode)
  → playerUrl with ?token=…
```

Endpoint: `POST /api/recording/playback-token`  
Body: `{ recordingId }` **or** `{ lessonId }` — **`playbackId` rejected** (`PLAYBACK_ID_NOT_ACCEPTED`).

---

## 7–10. Token generation / TTL / claims / refresh

| Item | Value |
|------|-------|
| Algorithm | RS256 (Mux URL signing key) |
| Env | `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY` (base64 PEM) |
| Claims | `sub`=playbackId, `aud`=`v`, `exp`, `kid` |
| TTL | **10 minutes** (`MUX_PLAYBACK_TOKEN_TTL_SEC`) |
| Storage | Not stored in DB |
| Refresh | Client re-calls endpoint; **re-runs authz** every time |

Secrets never in `NEXT_PUBLIC_*` / browser.

---

## 11. Mux playback policy (new assets)

When Wave 2 flag on, `createLiveStream` sets:

```json
"new_asset_settings": { "playback_policy": ["signed"] }
```

Live ingest preview remains `public` (OBS monitoring). Student **VOD** uses signed.

Existing public assets are **not** bulk-migrated (esp. production). Staging fixtures mostly use local `storageKey` / fixture tokens.

---

## 12. Direct URL behavior

| Case | Result |
|------|--------|
| Public Mux URL without token (signed assets) | Mux DENY |
| Flag on + app never emits public VOD player URL | App DENY |
| Unpublished | `403 NOT_PUBLISHED` |
| No Enrollment | `403 NOT_ENROLLED` |
| Client `playbackId` | `400 PLAYBACK_ID_NOT_ACCEPTED` |

---

## 13–14. Teacher / Admin

Course teacher + admin: preview if reviewable/published via same token endpoint. Other-course teacher: DENY.

---

## 15. Closed Enrollment

Short-lived token may work until `exp`. Refresh → DENY. No long-lived tokens.

---

## 16. IDOR

Authorization is Enrollment/course ownership — not UUID obscurity. Arbitrary `recordingId`/`playbackId` cannot obtain another course’s token.

---

## 17. Webhook

Wave 1 Mux webhook signature + `markRecordingReady` unchanged.

---

## 18–19. Existing / future recordings

- **Future** VOD from live: signed policy when flag on.  
- **Existing public** Mux playback IDs: document; migrate manually later (create signed playback ID / re-encode). Production: **no mutation**.  
- Staging E2E often uses **local** `storageKey` → `mediaUrl` mode (already gated by media route).

---

## 20. Staging without Mux signing keys

If `MUX_SIGNING_*` unset and recording has a real Mux id → `503 SIGNING_NOT_CONFIGURED` (**no public fallback**).  
Demo/fixture ids → HMAC `fixture.` token (authz still required). Local files → `mediaUrl`.

---

## 21–22. Tests / E2E

- Unit: `src/lib/recording-wave2-signed.test.ts`  
- E2E: `e2e/recording/wave2-signed-playback.spec.ts` (`E2E_RECORDING_WAVE2=1`)

---

## 23–24. Staging / Production

```
FF_RECORDING_SIGNED_PLAYBACK_V1=true   # staging only
```

Optional: `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY`.  
Production: flag unset; no Mux asset mutation; PID unchanged.

---

## 25. Remaining limitations

- Existing public Mux assets remain playable at CDN until migrated  
- Live (not VOD) playback policy still public for OBS  
- Mux signed CDN validation requires real signing keys in env  
- No DRM / playback restriction IDs in this wave  

## 26. Next Recording Wave

Migrate existing public VOD → signed playback IDs, or trim/review UX.
