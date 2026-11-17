# Gemmets Resa

**Gemmets Resa** är ett handritat 2D/2.5D-plattformsspel i webbläsaren där du styr ett levande metallgem genom en 1 200 enheter lång skolbok. Spelet kombinerar klassisk *boiling lines*-blyertsestetik med **Three.js 2.5D-djup**, dynamiska skuggor och en automatisk **2D → 3D-progression** över fyra skolämneskapitel.

Spelet körs direkt i webbläsaren utan konton, spårning eller externa bild-/ljudfiler — all grafik ritas procedurellt med HTML5 Canvas och WebGL, och allt ljud syntetiseras i realtid via Web Audio API.

---

## Huvudfunktioner

### 1. Automatisk 2D → 3D-progression över 4 Kapitel (`X: 0 → 1200`)
Världen vecklar ut sig gradvis i takt med att du tar dig framåt genom skissblocket, medan plattformsfysiken förblir exakt och responsiv i 2D:
1. **Kapitel 1: Svenska (`0–300`)** – Platt 2D-anteckningsbok med blå linjer, röd marginal, post-it-lappar och boktorn. Vid dash och suddgummistuds fjädrar världen tillfälligt ut i 3D.
2. **Kapitel 2: Matematik (`300–600`)** – Övergår till 2.5D-ritningspapper med rörliga linjaler, vinkelhakar och vägghopps-schakt.
3. **Kapitel 3: NO & Labb (`600–900`)** – Prickat labbpapper med hala glasblock (`iceblock`), labbfjädrar (`springpad`) och djupare 3D-skuggor.
4. **Kapitel 4: Slöjd & Bild (`900–1200`)** – Full papercraft-3D på kraftpapper med snabbt sönderfallande `crumble`-block som tippar utåt i Z-led, snabba träplankor och en intensiv final mot målbokmärket.

### 2. Spelkänsla & Plattformsfysik
- **Tajta kontroller**: Inbyggd *coyote time*, *wall coyote time* för förlåtande vägghopp, *jump buffering* och variabel hopphöjd.
- **Fjäder-dash**: Koboltblå tråd visar när dashen är redo; grå tråd visar att den är förbrukad tills du landar eller glider längs en vägg.
- **Checkpoints & Samlarobjekt**: **11 checkpoints** (en var 100:e enhet) och **48 stjärnor** (12 per kapitel).
- **Statistik & Personbästa**: Timer, omstartsräknare och lokal sparning av bästa tid och flest stjärnor i `localStorage`.
- **Mobil- & Pekstöd**: Touch-kontroller visas automatiskt på telefoner och surfplattor (`@media (pointer: coarse)`).

### 3. Handritad Grafik & Procedurellt Ljud
- **Boiling Lines (`sketch2d.js` + `textures3d.js`)**: Handritade texturer animerade i 8 FPS (3 frames per stil) kombinerat med Three.js `PCFSoftShadowMap`-skuggor och dolly-zoom-kamera.
- **Web Audio API (`audio.js`)**: Procedurellt syntetiserade ljudeffekter för hopp, metallisk dash, studs, landning, väggskrap, stjärnor, checkpoints och sidbläddring.

---

## Kontroller

| Tangent | Funktion |
|---|---|
| `A` / `D` eller `←` / `→` | Spring vänster / höger |
| `Space` / `W` / `↑` | Hoppa & Vägghopp |
| `Shift` / `X` / `K` | Fjäder-dash |
| `R` | Tillbaka till senaste checkpoint |
| `Shift + R` | Starta om från början |
| `P` / `Esc` | Pausa / Öppna meny |
| `M` | Ljud på / av |

---

## Lokal utveckling & Bygge

### Starta lokalt
Eftersom `feature/threejs-25d` använder ES-moduler och `importmap` behöver spelet köras över en lokal webbserver:

```bash
python3 -m http.server 8080
```

Öppna sedan `http://localhost:8080` i webbläsaren.

### Bygga fristående HTML-fil
Kör byggskriptet för att baka ihop `index.html`, `css/style.css` och `js/*.js` till `gemmets-resa.html`:

```bash
python3 build.py
```

### Rensa cache under iteration
- Projektet innehåller `_headers` med `Cache-Control: no-cache, no-store, must-revalidate` för Cloudflare Pages.
- På startskärmen och i pausmenyn finns dessutom knappen **🔄 Rensa cache & hämta senaste**, som rensar webbläsarens cache/Service Workers och laddar om sidan med en ny versionsparameter (`?v=`).
