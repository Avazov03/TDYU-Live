import { prisma } from "@/lib/prisma";

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

  const [user, unreadCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, email: true, role: true },
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    loggedIn: true as const,
    userName: user?.fullName,
    userEmail: user?.email,
    userRole: user?.role,
    unreadCount,
  };
}
