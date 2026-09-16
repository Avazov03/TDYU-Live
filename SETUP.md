# Lexify — O'rnatish bo'yicha qo'llanma

Mahalliy ish: `http://localhost:3000`.

**Open Tsul (`https://open.okina.uz`) bu loyiha emas — o‘sha serverga hech narsa yuborilmasin.**

## Muhit o'zgaruvchilari (.env)

`.env.example` faylini `.env` ga nusxalang va to'ldiring:

| O'zgaruvchi | Majburiy | Izoh |
|---|---|---|
| `DATABASE_URL` | Ha | PostgreSQL ulanish satri |
| `AUTH_SECRET` | Ha (prod) | `openssl rand -base64 32` |
| `AUTH_URL` | Ha | Mahalliy: `http://localhost:3000` |
| `NEXTAUTH_URL` | Tavsiya | `AUTH_URL` bilan bir xil |
| `AUTH_GOOGLE_ID` | Google uchun | Google Cloud OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Google uchun | Google Cloud OAuth Client Secret |
| `RESEND_API_KEY` | Parol tiklash uchun | [Resend](https://resend.com) API kaliti |
| `EMAIL_FROM` | Tavsiya | Masalan: `Lexify <noreply@lexify.zonic.fit>` |

**Google OAuth** local: `http://localhost:3000/api/auth/callback/google`.  
**Google OAuth** prod: `https://lexify.zonic.fit/api/auth/callback/google`.

### Google — Testing vs Production (muhim)

OAuth consent screen **Testing** rejimida bo‘lsa, faqat **Test users** ro‘yxatidagi emaillar Google orqali kira oladi. Boshqalar `Access blocked` / cheklov ko‘radi.

**Variant A — tez (test):**
1. [Google Auth Platform → Audience / OAuth consent](https://console.cloud.google.com/auth/audience)
2. **Test users** ga o‘zingizning Gmail(lar)ingizni qo‘shing
3. Origins: `http://localhost:3000`, `https://lexify.zonic.fit`
4. Redirect: `.../api/auth/callback/google` (local + prod)

**Variant B — hammaga ochiq:**
1. Consent screen → **Publish app** / Production
2. Faqat `email`, `profile`, `openid` (non-sensitive) bo‘lsa odatda Google verification kerak emas
3. Branding: app nomi Lexify, support email, privacy policy URL (agar so‘ralsa)

### Parolni tiklash

Login → **Parolni unutdingizmi?** → email → `/reset-password?token=...`.  
Production’da `RESEND_API_KEY` + `EMAIL_FROM` bo‘lishi shart. Kalit bo‘lmasa developmentda havola log/javobda chiqadi (`devResetUrl`).

---

## Mahalliy development

### Variant A — Prisma Dev (Docker kerak emas)

```bash
npx prisma dev
npm run db:migrate
npm run db:seed
npm run dev
```

### Variant B — Neon / Supabase

1. Bulut PostgreSQL yarating
2. `DATABASE_URL` ni `.env` ga qo'ying
3. `npm run db:migrate:deploy && npm run db:seed && npm run dev`

### Variant C — Docker Compose

```bash
docker compose up -d
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Port 5432 band bo‘lsa, `.env` dagi `DATABASE_URL` da boshqa port (masalan 5434) ishlatiladi.

---

## Production

Domen: **https://lexify.zonic.fit** (server `3.79.57.253`).  
Open Tsul (`https://open.okina.uz`) ga deploy qilinmasin.

App: `/var/www/tdyu-live`, PM2 `tdyu-live`, port `3100`.

Admin (mahalliy):

```bash
npm run admin:create -- admin@tdyu.live "KuchliParol123!" "Admin Ism"
```

---

## Ma'lumotlar bazasi buyruqlari

| Buyruq | Vazifasi |
|---|---|
| `npm run db:migrate` | Development: migratsiya yaratish/qo'llash |
| `npm run db:migrate:deploy` | Migratsiyalarni qo'llash |
| `npm run db:push` | Tez prototip |
| `npm run db:seed` | **Faqat local test** |
| `npm run admin:create` | Admin yaratish |
