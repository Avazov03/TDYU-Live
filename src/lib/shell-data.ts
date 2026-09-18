import { prisma } from "@/lib/prisma";
import { maybeSendLessonReminders } from "@/lib/lesson-reminders";
import { isStudentRole } from "@/lib/roles";

export async function getShellData(userId?: string) {
  if (!userId) {
    return {
      loggedIn: false as const,
      userName: undefined as string | undefined,
      userEmail: undefined as string | undefined,
      userRole: undefined as string | undefined,
      unreadCount: 0,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true, role: true },
  });

  if (user && isStudentRole(user.role)) {
    try {
      await maybeSendLessonReminders(userId);
    } catch {
      // reminder xatosi kabinetni to‘xtatmasin
    }
  }

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return {
    loggedIn: true as const,
    userName: user?.fullName,
    userEmail: user?.email,
    userRole: user?.role,
    unreadCount,
  };
}
