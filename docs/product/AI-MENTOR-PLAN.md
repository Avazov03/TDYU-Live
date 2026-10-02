# Lexify — AI mentor (reja)

**Holat:** tasdiqlangan (2026-10-02). Ishchi nom: **AI mentor**.
**Provayder:** Google Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL`, default `gemini-flash-latest`). Kalit faqat server `.env` da.

## Qarorlar

| Mavzu | Qaror |
|------|-------|
| Ko‘rinish | Alohida sahifa yo‘q. Ekranda suzib yuradigan robot; sichqoncha/barmoq bilan suriladi; bosilganda chat ochiladi |
| Robot rasmi | Foydalanuvchi beradi (PNG/SVG) |
| Mehmon (kirmagan) | Faqat katalog: kurslar/o‘qituvchilar; kuniga 10 xabar |
| Jonli dars xonasi | Robot yashirin |
| O‘qituvchi ko‘radigan faollik | Faqat umumlashtirilgan ("bu hafta faol", "yozuvning 30%") |
| Boshlanish | Darhol, 1-bosqichdan (W7 tozalash keyinga) |

## Xavfsizlik qoidalari (loyihaga zarar bermaslik)

1. `FF_AI_MENTOR_V1` (default `false`). Ochish: staging → prod admin → o‘qituvchi → hamma.
2. Faqat **additive** jadvallar; mavjud ma'lumot o‘zgarmaydi; prod migratsiya `pg_dump` bilan.
3. AI **faqat o‘qiydi**: baho, kirish, pul qaytarish, sertifikat qarorlari yo‘q.
4. Ruxsat **tool funksiyalarida** tekshiriladi (prompt'ga ishonilmaydi): talaba faqat o‘zini, o‘qituvchi faqat o‘z kurslarini.
5. Widget lazy-load; Gemini xatosi sahifani buzmaydi; so‘rovga timeout.
6. Limitlar: talaba 50/kun, o‘qituvchi 100/kun, mehmon 10/kun, daqiqalik limit, global kunlik byudjet → avtomatik to‘xtash.
7. Gemini'ga email/telefon yuborilmaydi; o‘qituvchi so‘rovlarida talaba ismlari `Talaba-1…` taxallus bilan, ekranda haqiqiy ism.
8. Production oldidan Google Cloud billing (pullik tarif — ma'lumot o‘qitishga ishlatilmaydi) + oylik xarajat limiti.
9. Testlar: tool ruxsat unit testlari; e2e soxta Gemini bilan (`AI_MENTOR_FAKE=1`); har bosqich staging → «qil».

## Bosqichlar

### 1. Suzuvchi robot + chat (talaba, mehmon)
- Robot: pastki o‘ng burchak, sekin suzish animatsiyasi, drag (pointer events), ekran chegarasida, joy `localStorage`.
- Salom pufakchasi (vaqtga qarab), X bilan yopiladi, sessiyada bir marta.
- Chat paneli: sarlavha (nom, yangi suhbat, to‘liq ekran, yopish), "Salom, {ism}" + "Bizga nima xizmat?", kontekstli takliflar + "Boshqa takliflar", kiritish maydoni, "AI xato qilishi mumkin".
- Mobil: pastdan to‘liq ekran panel. 0.38s `cubic-bezier(0.22,1,0.36,1)`; `prefers-reduced-motion` da animatsiya yo‘q.
- Server: `POST /api/ai/chat` (streaming), Gemini function calling.
- Talaba tool'lari: mening kurslarim/progress, yaqin darslar, topshiriqlar, davomat, sertifikatlar, joriy sahifadagi dars, katalog qidiruvi.
- Mehmon tool'lari: faqat katalog qidiruvi.
- Sahifa konteksti: klient `pathname` yuboradi, server id'larni o‘zi tekshiradi.

### 2. Faollik + mentor eslatmalari
- `activity_events` (sahifa, vaqt, yozuv progressi, topshiriq ochilishi); 90 kun, keyin kunlik agregat.
- Robot pufakchasida qoidaga asoslangan eslatmalar (kuniga ≤3).
- Chat ichida "Mentor men haqimda nimani biladi" bo‘limi.
- Haftalik shaxsiy hisobot (sayt + Telegram).

### 3. O‘qituvchi yordamchisi
- "Diqqat talab qiladi" ro‘yxati sabablari bilan; dars hisoboti; sertifikat uchun xulosa; xabar/izoh loyihalari (o‘qituvchi tasdiqlaydi).

### 4. Yozuvlar
- Dars xulosasi, konspekt, vaqt belgilari, o‘z-o‘zini tekshirish savollari (o‘zbek tilida sifat avval sinovdan o‘tadi).

### 5. Admin
- Kurs sifati, o‘qituvchi ko‘rsatkichlari, support saralash.

## Jadval (additive)

- `ai_conversations`, `ai_messages` — suhbat tarixi (foydalanuvchi o‘chira oladi).
- `ai_usage` — kunlik so‘rov/token hisobi (limit va byudjet).
- `activity_events` (2-bosqich).

## Env (server `.env`)

| O‘zgaruvchi | Ma'nosi |
| --- | --- |
| `FF_AI_MENTOR_V1` | `1` — yoqilgan (default o‘chiq: robot ko‘rinmaydi, API 404) |
| `FF_AI_MENTOR_AUDIENCE` | `admin` (default) → `staff` → `students` → `all` (mehmonlar ham) |
| `GEMINI_API_KEY` | Google AI Studio kaliti (gitga kiritilmaydi) |
| `GEMINI_MODEL` | default `gemini-flash-latest` |
| `GEMINI_FALLBACK_MODEL` | band bo‘lsa (503/429): default `gemini-flash-lite-latest` |
| `AI_DAILY_TOKEN_BUDGET` | butun sayt uchun kunlik token chegarasi (default 2 000 000) |
| `AI_DAILY_LIMIT_GUEST` / `_STUDENT` / `_TEACHER` / `_ADMIN` | kunlik so‘rov limiti (default 10/50/100/200) |
| `AI_MENTOR_FAKE` | `1` — oflayn soxta model, faqat staging/dev (e2e uchun) |

Robot rasmi: `src/components/ai/RobotMark.tsx` dagi `ROBOT_IMAGE` ga `/ai/robot.png` yoziladi va fayl `public/ai/` ga qo‘yiladi.
