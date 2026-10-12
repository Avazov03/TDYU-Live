export function notifiedNotice(notified: { students: number; telegram: number }): string {
  return notified.students > 0
    ? `✓ ${notified.students} talabaga xabar yuborildi (sayt, email; Telegram: ${notified.telegram})`
    : "Kursda hali faol talaba yo‘q — xabar yuboriladigan hech kim topilmadi";
}
