# Lexify — Design System & Agent Tools

Bu fayl yangi chatlarda ham o‘qiladi. Landing, UI va tekshiruv shu qoidalarga tayanadi.

Mahalliy: `http://localhost:3000` · Production: `https://lexify.zonic.fit`

---

## Brend (asos)

| Token | Qiymat | Vazifa |
|---|---|---|
| Nom | **Lexify** | Hero’da eng katta signal |
| Qisqa | **Lx** | Logo mark |
| Tagline | Jonli dars va kurslar | Metadata / footer |
| Yo‘nalish | Dark, cinematic, toza | AWSA uslubidagi katta nom + markaziy stack |

### Hozirgi CSS tokenlar (`globals.css`)

**Dark**
- `--bg` `#0f0f0f`
- `--surface` `#1b1b1b`
- `--text` `#f1f1f1` · `--text-2` `#aaaaaa`
- `--accent` `#3b7bf0` · `--accent-700` `#2a5cc2`
- Hero nom gradienti: `#9fc9c4` → `#4a9a96` → `#d4e6e2`

**Light**
- `--bg` `#ffffff` · `--accent` `#2a5cc2`

> Rang palitrasi foydalanuvchi tasdiqlamaguncha ommaviy o‘zgartirilmasin.

---

## Landing qoidalari

1. Birinchi viewport — bitta kompozitsiya (dashboard emas).
2. **Lexify** hero’da eng katta matn; boshqa headline uni bosmasin.
3. Hero budjeti: brend + qisqa tag + lead + CTA. Stats / promo / card yo‘q.
4. Hero’da floating badge / sticker yo‘q.
5. Section = bitta maqsad, bitta sarlavha, odatda bitta izoh.
6. Card faqat interaktiv kerak bo‘lsa.
7. Motion: 2–3 ta maqsadli animatsiya; shovqin emas.
8. Kutubxonalar (zarurat bo‘yicha): [Vengeance UI](https://www.vengenceui.com/), [Magic UI](https://magicui.design/), [Aceternity UI](https://ui.aceternity.com/) — avval Tailwind + Motion qo‘shiladi.

### Hero joylashuv (tasdiqlangan)

```
[ LEXIFY ]          ← juda katta, gradient
[ tag matn ]        ← "TDYU professorlaridan…"
[ lead ]            ← tarif / yo‘nalish matni
[ CTA tugma(lar) ]  ← kattaroq pill
```

Matnlar o‘zgarmaydi — faqat joylashuv va o‘lcham.

---

## Agent vositalari (nima / qachon)

Bu 5 ta narsa **saytga npm kutubxona sifatida “dizayn paket” emas**. Ular AI + tekshiruv uchun.

### 1) Taste Skill — dizayn didi
- Manba: https://github.com/Leonxlnx/taste-skill
- Nima: professional UI didi (bo‘sh joy, tipografiya, ierarxiya).
- Lexifyda: landing/section tuzatishda shu didni ushla; “AI purple / cream / broadsheet” biasdan qoch.
- O‘rnatish: saytga emas · loyiha skill: `.cursor/skills/lexify-design/`

### 2) Vercel Web Interface Guidelines
- Manba: https://github.com/vercel-labs/web-interface-guidelines
- Nima: fokus, kontrast, mobil 44px hit, loading, forma, a11y tekshiruv ro‘yxati.
- Lexifyda: har landing o‘zgarishidan keyin mental audit; keyin Playwright smoke.
- Muhimlar: `:focus-visible`, `prefers-reduced-motion`, link = `<a>`, loading tugmada label saqlansin.

### 3) Awesome DESIGN.md
- Manba: https://github.com/VoltAgent/awesome-design-md
- Nima: Stripe / Linear / Vercel kabi tayyor dizayn-tizimlar.
- Lexifyda: referens sifatida (Linear tozalik + cinematic hero). Bu fayl (`DESIGN.md`) — bizning manba.

### 4) Image → Code
- Manba: https://github.com/openai/role-specific-plugins (image-to-code)
- Nima: skrinshot/maketdan layout.
- Lexifyda: foydalanuvchi rasm yuborsa — matnni o‘zgartirmay, joylashuvni mosla (hero shu tarzda qilindi).

### 5) Playwright — brauzerda o‘zini tekshirish
- Manba: https://github.com/microsoft/playwright-cli · loyihada: `@playwright/test`
- Nima: haqiqiy brauzerda ochish, click, screenshot, regressiya.
- Lexifyda: landing smoke (`e2e/landing.spec.ts`).
- Buyruqlar:
  ```bash
  npx playwright install chromium
  npm run test:e2e
  ```

**Cursor ichida** ham brauzer snapshot/screenshot ishlatiladi — tez vizual tekshiruv. Playwright — takrorlanadigan avto-test.

---

## UI oqimi (agent)

1. O‘zgarishdan oldin tushunishni qisqa tasdiqla (workflow qoidasi).
2. `DESIGN.md` + brend tokenlarga rioya qil.
3. Kod → lokal `localhost:3000` → brauzer yoki `npm run test:e2e`.
4. Commit / push / deploy — **faqat** foydalanuvchi «qil» deganda (`.cursor/rules/lexify.mdc`).

---

## Referenslar

- Vengeance UI · Magic UI · Aceternity UI — marketing animatsiyalari
- Vercel guidelines — professional tekshiruv
- Taste / Awesome DESIGN.md — did va tizim referenslari
