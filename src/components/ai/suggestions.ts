import type { AiRole, PageContext } from "@/lib/ai/policy";

const GUEST = [
  "Qanday kurslar bor?",
  "O‘qituvchilar kimlar?",
  "Kursni qanday sotib olaman?",
  "Platforma qanday ishlaydi?",
  "Jinoyat huquqi bo‘yicha kurs bormi?",
];

const STUDENT = [
  "Keyingi darsim qachon?",
  "Topshiriqlarim bormi?",
  "Davomatim qanday?",
  "Kurslarim holati",
  "Sertifikatlarim",
  "Huquqiy atamani tushuntirib ber",
  "Yangi kurs tavsiya qil",
];

const TEACHER = [
  "Kurslarim statistikasi",
  "Qaysi kursimda davomat past?",
  "Keyingi darsim qachon?",
  "Har bir kursimda nechta talaba bor?",
  "Ochiq kurslar ro‘yxati",
];

const ADMIN = ["Ochiq kurslar ro‘yxati", "O‘qituvchilar kimlar?", "Eng yangi kurslar"];

export function suggestionsFor(role: AiRole, page: PageContext): string[] {
  const base = role === "student" ? STUDENT : role === "teacher" ? TEACHER : role === "admin" ? ADMIN : GUEST;
  const contextual: string[] = [];
  if (page.kind === "lesson" && (role === "student" || role === "teacher" || role === "admin")) {
    contextual.push("Bu dars haqida qisqacha", "Shu mavzu bo‘yicha 3 ta savol ber");
  } else if (page.kind === "course") {
    contextual.push("Bu kurs haqida gapirib ber", "Bu kurs menga mosmi?");
  } else if (page.kind === "assignments" && role === "student") {
    contextual.push("Qaysi topshiriq muddati yaqin?");
  } else if (page.kind === "schedule" && role === "student") {
    contextual.push("Shu haftadagi darslarim");
  }
  return [...new Set([...contextual, ...base])];
}
