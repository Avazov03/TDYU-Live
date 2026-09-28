/**
 * Latest live-room page instance per (lesson, user).
 *
 * Peer ids are deterministic per user, so a reload or a second tab shares the
 * same peer id and attendance interval. A leave sent by the page being unloaded
 * (pagehide / effect cleanup) can arrive after the new page already joined; it
 * must not close the new page's attendance or drop its presence.
 */

const MAX_ENTRIES = 5_000;

const g = globalThis as typeof globalThis & { __tdyuLiveJoinInstances?: Map<string, string> };
const latest = g.__tdyuLiveJoinInstances ?? new Map<string, string>();
g.__tdyuLiveJoinInstances = latest;

function key(lessonId: string, userId: string) {
  return `${lessonId}:${userId}`;
}

export function markLiveJoinInstance(lessonId: string, userId: string, instance: string): void {
  const k = key(lessonId, userId);
  latest.delete(k);
  latest.set(k, instance);
  if (latest.size > MAX_ENTRIES) {
    const oldest = latest.keys().next().value;
    if (oldest !== undefined) latest.delete(oldest);
  }
}

/** True only when a newer page instance of the same user has joined since. */
export function isStaleLiveLeave(lessonId: string, userId: string, instance: string | undefined): boolean {
  if (!instance) return false;
  const current = latest.get(key(lessonId, userId));
  return current !== undefined && current !== instance;
}

export function clearLiveJoinInstancesForTests(): void {
  latest.clear();
}
