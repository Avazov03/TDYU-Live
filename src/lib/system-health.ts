import { prisma } from "@/lib/prisma";

export type HealthCheck = {
  id: string;
  label: string;
  ok: boolean | null;
  detail: string;
};

/**
 * Live measurements only. A check stays unknown (ok: null) when this process
 * cannot observe it — never reported as healthy by default.
 */
export async function collectSystemHealth(): Promise<{
  checkedAt: string;
  checks: HealthCheck[];
}> {
  const checks: HealthCheck[] = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ id: "db", label: "Ma’lumotlar bazasi", ok: true, detail: "So‘rov javob berdi." });
  } catch {
    checks.push({
      id: "db",
      label: "Ma’lumotlar bazasi",
      ok: false,
      detail: "Bazaga ulanib bo‘lmadi.",
    });
  }

  const [openIntervals, liveLessons, openSessions, openIncidents, recordingGroups] = await Promise.all([
    prisma.attendanceInterval.count({ where: { leftAt: null } }),
    prisma.lesson.count({ where: { status: { in: ["live", "paused", "waiting_room", "lobby"] } } }),
    prisma.liveSession.count({ where: { status: { in: ["waiting", "live", "paused"] } } }),
    prisma.incident.count({ where: { status: "open" } }),
    prisma.recording.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  checks.push({
    id: "attendance",
    label: "Davomat intervallari",
    ok: openIntervals === 0,
    detail:
      openIntervals === 0
        ? "Ochiq interval yo‘q."
        : `${openIntervals} ta interval yopilmagan.`,
  });

  checks.push({
    id: "live",
    label: "Jonli darslar",
    ok: null,
    detail: `${liveLessons} ta ochiq dars · ${openSessions} ta jonli sessiya. Moslikni dars kartasidan tekshiring.`,
  });

  const recordingDetail =
    recordingGroups.length === 0
      ? "Yozuv qatori yo‘q."
      : recordingGroups.map((row) => `${row.status}: ${row._count._all}`).join(", ");
  const failed = recordingGroups.find((row) => row.status === "failed")?._count._all ?? 0;
  checks.push({
    id: "recording",
    label: "Yozuvlar",
    ok: failed === 0,
    detail: recordingDetail,
  });

  checks.push({
    id: "incidents",
    label: "Ochiq incidentlar",
    ok: openIncidents === 0,
    detail: openIncidents === 0 ? "Ochiq incident yo‘q." : `${openIncidents} ta ochiq incident.`,
  });

  checks.push({
    id: "cron",
    label: "Fon vazifalar",
    ok: null,
    detail: "Cron yurak urishi yozilmaydi. Avtomatik nashr va eslatma shu jarayonda ishlaydi, lekin oxirgi muvaffaqiyat vaqti o‘lchanmagan.",
  });

  return { checkedAt: new Date().toISOString(), checks };
}
