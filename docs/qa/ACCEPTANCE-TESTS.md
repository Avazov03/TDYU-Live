# Lexify — Acceptance Tests (Non-negotiable + Student/Teacher/Admin)

**Authority:** `docs/product/FINAL-SYSTEM-SPEC.md` §20
**Rule:** Every implementation phase ships automated and/or scripted E2E coverage for its slice.

---

## A. Security / access

| ID | Given | When | Then |
|----|-------|------|------|
| AT-SEC-01 | User not enrolled | Opens shared lesson URL | Access denied |
| AT-SEC-02 | Enrolled in Course A | Requests Course B lesson/recording/material/chat | Denied |
| AT-SEC-03 | No enrollment | GET chat / recording / material | Denied |
| AT-SEC-04 | Refund completed | Uses old live/recording/material links | Denied immediately |
| AT-SEC-05 | Short-lived join token expired/forged | Signal/join | Denied |
| AT-SEC-06 | Teacher of Course A | Accesses Course B teacher APIs | Denied |
| AT-SEC-07 | Student A | Opens Student B certificate | Denied |
| AT-SEC-08 | Account restricted for purchase | Attempts checkout | Purchase blocked; existing enrollments not wiped |
| AT-SEC-09 | Mux webhook without valid signature | POST webhook | Rejected; lesson unchanged |

---

## B. Commerce

| ID | Given | When | Then |
|----|-------|------|------|
| AT-PAY-01 | Published course, capacity OK | Demo confirm once | Purchase COMPLETED + Enrollment ACTIVE |
| AT-PAY-02 | Same Idempotency-Key twice | Confirm twice | One Purchase, one Enrollment |
| AT-PAY-03 | Duplicate provider/webhook event | Replay | No duplicate enrollment |
| AT-PAY-04 | Payment failed/pending | — | No enrollment |
| AT-PAY-05 | Client sends wrong amount | Checkout | Server uses listPrice; mismatch rejected |
| AT-PAY-06 | Student already enrolled | Buy again while ACTIVE | Rejected or no-op policy (document); no duplicate active |
| AT-PAY-07 | Multi-course A then B | Buy both | Both ACTIVE; neither expires the other |
| AT-PAY-08 | Demo payment | Admin revenue | Excluded from real net revenue |

---

## C. Refund / cancel

| ID | Given | When | Then |
|----|-------|------|------|
| AT-REF-01 | Before course start | Student 100% request + approve | Full refund; access closed |
| AT-REF-02 | After start, progress &lt; 50%, justified | Admin 50% | Half refund; access closed |
| AT-REF-03 | Progress ≥ 50% | Special 50% | Not applicable / denied by rule |
| AT-REF-04 | Course cancelled by Admin | — | 100% all purchasers + site + Telegram if linked |
| AT-REF-05 | Duplicate refund request | — | Idempotent; one money path |

---

## D. Course / admin / schedule

| ID | Given | When | Then |
|----|-------|------|------|
| AT-CRS-01 | Teacher submits draft | Admin approve+price+publish | Public catalog shows; atomic |
| AT-CRS-02 | Double publish click | — | Idempotent; one published state |
| AT-CRS-03 | Overlapping schedule same teacher | Publish/reschedule | Blocked |
| AT-CRS-04 | Reschedule &lt; 24h | Teacher | Blocked (except early start no-conflict rule) |
| AT-CRS-05 | Capacity full | Purchase | Closed; UI `Joylar tugagan` |
| AT-CRS-06 | Price change after sales | New vs old buyers | Old keep paid snapshot; new see new price |
| AT-CRS-07 | Planned lessons remain | Teacher finish | Denied |
| AT-CRS-08 | All planned done | Finish | History; recordings permanent |
| AT-CRS-09 | Teacher replacement | Admin | Conflict check; students notified |

---

## E. Live / waiting / timers

| ID | Given | When | Then |
|----|-------|------|------|
| AT-LIVE-01 | Waiting room open | Student enrolled joins | Chat OK; no teaching media |
| AT-LIVE-02 | Teacher never starts | Timeout/policy | Admin+students notified; reschedule required |
| AT-LIVE-03 | Teacher start | — | LIVE; enrolled notified; timer starts |
| AT-LIVE-04 | Pause | — | Chat remains; teaching timer paused |
| AT-LIVE-05 | Resume | — | Timer continues from paused teaching seconds |
| AT-LIVE-06 | 55/58/59m teaching | — | Warnings emitted |
| AT-LIVE-07 | 60m teaching | — | Auto-end |
| AT-LIVE-08 | Late join during LIVE | — | Allowed with token |
| AT-LIVE-09 | Reconnect | — | Without teacher permission |
| AT-LIVE-10 | Second device join | — | Old session closed; attendance continues |
| AT-LIVE-11 | Teacher remove student | — | Session only; enrollment remains |
| AT-LIVE-12 | Shared rooms across instances | Two app nodes | Same room state |

---

## F. Recording

| ID | Given | When | Then |
|----|-------|------|------|
| AT-REC-01 | Lesson ended | Processing | Student sees preparing |
| AT-REC-02 | READY | Teacher window | 24h review; PROCESSING time excluded |
| AT-REC-03 | Publish confirm | — | Students notified; My Courses shows |
| AT-REC-04 | No teacher action 24h after READY | Cron | Auto-publish |
| AT-REC-05 | Technical failure | — | Incident; Teacher+Admin+student informed; lesson still held |
| AT-REC-06 | Pre-publish | Student | Cannot watch final recording |

---

## G. Notifications

| ID | Event | Then |
|----|-------|------|
| AT-NTF-01 | Purchase success | Site notification (Telegram if linked) |
| AT-NTF-02 | Course starts tomorrow | Fired once (idempotent) |
| AT-NTF-03 | Teacher start | Enrolled students |
| AT-NTF-04 | Schedule change | Enrolled students |
| AT-NTF-05 | Recording published | Enrolled students |
| AT-NTF-06 | Refund / cancel | Affected students |

---

## H. Ops / health

| ID | Given | When | Then |
|----|-------|------|------|
| AT-OPS-01 | Approaching disk/quota | — | Predictive alert |
| AT-OPS-02 | Safe retry succeeds | — | No primary data loss |
| AT-OPS-03 | Safe recovery fails | — | Critical + Incident + Action Required |
| AT-OPS-04 | Privileged destroy | — | Audit log entry |

---

## I. Test harness notes

- Prefer Playwright for Student/Teacher/Admin E2E; API integration tests for idempotency/webhooks.
- Use demo payment only in test; assert `isDemo` revenue exclusion.
- Multi-instance live tests require shared store (Redis) in CI or staging.
- Do not assert CAPTCHA.
