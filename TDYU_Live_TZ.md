# TDYU Live — Texnik topshiriq

**TDYU Live** — Toshkent davlat yuridik universiteti uchun pulli jonli-dars va kurs platformasi. Interfeys **YouTube uslubida** (dark/light, sidebar, video kartochka, watch layout). Videolar YouTube’da saqlanmaydi — **Mux** live + VOD.

Mahalliy: http://localhost:3000

Bu loyiha Open Tsul (`https://open.okina.uz`) emas.

---

## 1. Nima qoladi (dizayn DNK)

- Dark `#0F0F0F` / light rejim, Inter, accent ko‘k
- Sticky topbar 56px: logo, qidiruv, qo‘ng‘iroq, avatar
- Chap sidebar 240px, hamburger bilan 72px
- Video kartochka: 16:9 thumb, hover scale, avatar + sarlavha + meta
- Watch sahifa: katta pleyer, o‘qituvchi paneli, o‘ngda tavsiya/dars ro‘yxati
- Jonli tasma: Shorts kabi vertikal feed (`/shorts`) — faqat **jonli efirlar**
- Auth: glass forma
- Admin: YouTube Studio uslubidagi sidebar

## 2. Rollar

| Rol | Vazifa |
|---|---|
| Admin | O‘qituvchi qo‘shadi (invite link), kurs/tarif, statistika, to‘lovlar |
| O‘qituvchi | Invite orqali parol qo‘yadi, jadval, efirni boshlaydi/tugatadi, guruh, topshiriq, baho, sertifikat |
| O‘quvchi | Ro‘yxat, tarif + demo to‘lov, dars, chat (2/3), topshiriq, sertifikat |

## 3. Tarif

| | 1-tarif | 2-tarif | 3-tarif |
|---|---|---|---|
| Yozuv | ha | ha | ha |
| Jonli efir | yo‘q | ha | ha |
| Chat | yo‘q | ha | ha + ustuvor |
| Topshiriq navbati | oddiy | oddiy | birinchi |

To‘lov: hozir **demo** (Payme/Click keyin). Obuna 30 kun, muddat tugasa yopiladi.

## 4. Dars oqimi

1. O‘qituvchi «Efirni boshlash» → Mux live (yoki demo)
2. 2/3-tarifga bildirishnoma (sayt + Telegram + email, kalit bo‘lsa)
3. Tomosha + chat; davomat yoziladi
4. Tugatish → Mux VOD webhook → 1-tarif ham yozuvni ko‘radi

YouTube’ga yuklash **yo‘q**.

## 5. Sahifalar

- `/` katalog (chip filtr, video-grid)
- `/courses/[id]` kanal/kurs (tarif, dars ro‘yxati)
- `/learn/[id]` watch + paywall + chat
- `/shorts` jonli efirlar (Shorts UI)
- `/my-courses` `/schedule` `/assignments` `/certificates`
- `/teacher` `/teacher/group` `/teacher/assignments`
- `/admin` `/admin/teachers` `/admin/courses` `/admin/payments`
- `/invite/[token]` o‘qituvchi parol

## 6. Qasddan yo‘q

- YouTube embed / unlisted yuklash
- Layk, pleylist, “Keyinroq” (YouTube ijtimoiy)
- Ota-ona paneli, test, video-konsultatsiya — keyingi bosqich
