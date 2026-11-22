# GymLog Pro — Jurnal de Sală & Analiză Progres

Aplicație web pentru antrenamentul cu greutăți: jurnal rapid tip tabel, cronometru de pauză, analiză vizuală a progresului și profil biometric.
Proiect pentru disciplina **Tehnologii de Programare în Internet (TPI)** — tema *„Claude AI and web development”*.

> Stack: **HTML5 + Tailwind CSS (CDN) + Chart.js (CDN) + Vanilla JavaScript modular**. Fără framework, fără server, fără build.

**Aplicația online:** <https://ionescuandrei1409.github.io/gymlog-pro/> — deschide link-ul pe telefon și instalează aplicația. După instalare merge și fără internet.

<img src="icons/qr.png" alt="Cod QR către aplicația online" width="160">

---

## Cum rulezi aplicația

1. **Dublu-click pe `index.html`.** Merge în Chrome, Edge sau Firefox, direct din fișier (`file://`).
2. La prima deschidere se încarcă automat **istoricul real: 9 antrenamente (22 Sept – 20 Nov 2026)**.
3. Totul se salvează automat în browser (`localStorage`). Pentru backup: **Setări → Export JSON**.

**Fără internet?** Tailwind și Chart.js se iau de pe CDN. Dacă CDN-ul nu răspunde, pagina folosește automat copiile locale din `js/vendor/`.

---

## Pe telefon, ca aplicație care merge fără internet (PWA)

Aplicația e o **PWA**: o deschizi o singură dată de pe un link `https`, o instalezi pe ecranul principal, iar apoi pornește cu iconiță proprie, pe tot ecranul, **fără internet**.

**1. Publică folderul (o singură dată), de exemplu pe GitHub Pages, gratuit:**
1. Pe [github.com](https://github.com) → **New repository** → nume, de exemplu `gymlog-pro` → **Public** → **Create**.
2. **uploading an existing file** → trage în pagină: `index.html`, `sw.js`, `manifest.webmanifest` și folderele `css/`, `js/`, `icons/` → **Commit changes**.
   Nu urca `screenshots_prezentare/`, `exemple_ce_notez_la_sala/` sau fișierele temei.
3. **Settings → Pages → Branch: `main`, folder `/ (root)` → Save.** După ~1 minut, site-ul e la `https://<utilizator>.github.io/gymlog-pro/`.

Alternativ: [app.netlify.com/drop](https://app.netlify.com/drop) (cont gratuit) → tragi aceleași fișiere și primești un link.

**2. Instalează pe telefon (cu internet, o singură dată):**
- **Android (Chrome):** deschide link-ul → **⋮ → Instalează aplicația**. Sau din aplicație: **Setări → Aplicație pe telefon → Instalează aplicația**.
- **iPhone (Safari):** deschide link-ul → **Partajează → Adaugă pe ecranul principal**.

**De știut:**
- Link-ul e public, iar `js/data.js` conține istoricul preîncărcat de antrenamente.
- Ce notezi pe telefon rămâne **doar pe telefon** (nu ajunge pe server). Pentru backup: **Setări → Export JSON**.
- Pe iPhone, aplicația instalată are datele ei, separate de Safari: instaleaz-o întâi, apoi notează în ea.
- Când modifici fișierele și le urci din nou, telefonul preia versiunea nouă la următoarele deschideri cu internet. Pentru o actualizare imediată, crește `VERSION` din `sw.js` (de exemplu `gymlog-v2`).
- Deschiderea directă a fișierului `index.html` din memoria telefonului nu merge: browserele de pe telefon blochează încărcarea fișierelor `css/` și `js/` de lângă el.

---

## Ce face

| Tab | Funcționalități |
|---|---|
| **Antrenament** | 4 șabloane de zi (Chest / Leg / Brațe + Umeri + Abd / Back) + șabloane proprii · tabel pe exerciții cu Încălzire + Seria 1–3 (`+ Adaugă serie`) · **„Ultima dată (20 Nov): Înc: 50×12 \| S1: 120×12 …”** în capul fiecărui exercițiu · valorile de data trecută apar gri în căsuțe · **drop-set** nativ (`+ Drop`) · bifă „La liber / 0 kg” · insigne live `▲ +5 kg` / `= egal` / `Record!` · tag de sală (General / Columbia / Salsa) · notițe rapide (Controlat / Lent, Cu ajutor, Greu, Obosit) |
| **Cronometru** | pornește la bifarea unei serii · 60s / 90s / 120s · Pauză / Reset / +15s · 3 bipuri discrete (Web Audio) + vibrație |
| **Istoric** | antrenamentele grupate pe luni, cu recordurile marcate · Editează / Repetă / Șterge |
| **Progres** | KPI: total antrenamente, frecvență/săptămână, PR-uri luna aceasta, cel mai mare progres · grafic pe exercițiu (greutate maximă + repetări totale) cu rezumat în cuvinte simple · **Azi vs. Tura trecută** (verde / galben / roșu) · donut pe grupe musculare (30 / 90 zile / tot) · constanță săptămânală · recorduri recente |
| **Corp** | sex, vârstă, înălțime, greutate, obiectiv (Hipertrofie / Forță / Definire), nivel de activitate · **IMC** cu bară colorată · **necesar caloric** (menținere vs. obiectiv) + proteine · grafic al greutății corporale |
| **Setări** | Export / Import JSON · **Resetează / Încarcă date reale** · **Șterge tot** · pauza implicită și sunetul · editor de șabloane · săli / aparate |

---

## Arhitectură

```
TEMA_TPI/
├── index.html              structura paginii: antet + navigație, 5 secțiuni goale, cronometrul, încărcarea scripturilor
├── css/style.css           design system Dark Mode: tokenuri de culoare + componente + adaptare mobil
├── js/
│   ├── data.js             GymData    – exerciții, grupe, săli, 4 șabloane, istoricul real (9 sesiuni), profil demo
│   ├── storage.js          GymStorage – localStorage (salvare automată), validare, Export / Import JSON
│   ├── stats.js            GymStats   – calcule pure: PR-uri, „Ultima dată”, comparații, rezumate, IMC, calorii
│   ├── charts.js           GymCharts  – graficele Chart.js (progres, donut, săptămânal, greutate) în Dark Mode
│   ├── app.js              interfața: randarea tab-urilor, tabelul de serii, cronometrul, modale, evenimente
│   └── vendor/             copii locale Chart.js 4.6.1 + Tailwind 4.3.5 (pentru lucru offline)
├── sw.js                   service worker: salvează aplicația pe dispozitiv → merge fără internet (PWA)
├── manifest.webmanifest    nume, iconițe, culori → aplicația se poate instala pe telefon
├── icons/                  iconițele aplicației (192, 512, maskable, Apple)
├── screenshots_prezentare/ scriptul Playwright + cele 5 capturi PNG
├── README.md
├── PREZENTARE_NOTE.md      notițe pentru slide-uri (arhitectură, etape, decizii tehnice)
└── GymLog_Pro_Prezentare_TPI.pptx   prezentarea (14 slide-uri, cu note pentru vorbitor)
```

Ordinea scripturilor contează: `data → storage → stats → charts → app`. Fiecare modul e un IIFE care expune un singur obiect global. `stats.js` nu atinge DOM-ul, deci calculele pot fi testate separat (de exemplu în Node).

---

## Screenshot-uri automate (pentru prezentare)

```powershell
cd screenshots_prezentare
npm install
npm run capture
```

Scriptul deschide `index.html` headless (Edge sau Chrome deja instalate). Dacă nu ai niciunul, rulează o dată `npx playwright install chromium`. Apoi completează un antrenament, adaugă un drop-set, pornește cronometrul și salvează:
`01_tabel_antrenament.png`, `02_rest_timer_dropset.png`, `03_analiza_progres.png`, `04_profil_biometric.png` (1440×900) și `05_mobile_responsive.png` (390×844).

---

## De reținut

- **Profilul biometric e demonstrativ:** 22 de ani, 180 cm, greutăți între 76 și 78,4 kg. Înlocuiește-l cu datele tale din tab-ul **Corp**. Antrenamentele sunt cele reale.
- Datele din `localStorage` sunt legate de browser. Pe alt calculator sau alt browser, mută-le cu Export / Import JSON.
- Când pui proiectul în arhiva temei, **nu include `screenshots_prezentare/node_modules/`** (~19 MB). Se reface cu `npm install`.
