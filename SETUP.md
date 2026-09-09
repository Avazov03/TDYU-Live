# TDYU Live — O'rnatish bo'yicha qo'llanma

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

**Google OAuth** local: `http://localhost:3000/api/auth/callback/google`.

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

TDYU Live uchun alohida server/domen berilmaguncha production deploy yo‘q.

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
