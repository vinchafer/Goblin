Ich baue dir eine Startseite für den Hundeverein mit Terminen und Kontaktbereich – bewusst gestaltet, nicht generisch.

Zuerst die HTML-Struktur mit Google Fonts, responsiver Basis und klarem Layout:

```html index.html
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hundeverein – Gemeinsam mit unseren Vierbeinern</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Lato:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <h1 class="logo">Hundeverein</h1>
      <p class="tagline">Gemeinsam mit unseren Vierbeinern</p>
      <nav class="main-nav">
        <a href="#termine">Termine</a>
        <a href="#kontakt">Kontakt</a>
        <a href="#ueber">Über uns</a>
      </nav>
    </div>
  </header>

  <main class="main-content">
    <section class="hero">
      <div class="container">
        <h2 class="hero-title">Aktivitäten für Mensch und Hund</h2>
        <p class="hero-text">Wir organisieren regelmäßige Treffen, Trainings und Ausflüge – für eine starke Bindung und jede Menge Spaß.</p>
      </div>
    </section>

    <section id="termine" class="section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Nächste Termine</h2>
          <p class="section-subtitle">Komm vorbei und bring deinen Hund mit!</p>
        </div>
        <div class="termine-grid">
          <article class="termin-card">
            <div class="termin-date">
              <span class="termin-day">Sa</span>
              <span class="termin-number">15</span>
              <span class="termin-month">Jun</span>
            </div>
            <div class="termin-info">
              <h3 class="termin-title">Frühlings‑Spaziergang</h3>
              <p class="termin-desc">Gemeinsamer Ausflug in den Waldpark. Dauer ca. 2 Stunden.</p>
              <div class="termin-meta">
                <span class="meta-item">📍 Stadtpark</span>
                <span class="meta-item">🕒 10:00 Uhr</span>
              </div>
            </div>
          </article>
          <article class="termin-card">
            <div class="termin-date">
              <span class="termin-day">Mi</span>
              <span class="termin-number">19</span>
              <span class="termin-month">Jun</span>
            </div>
            <div class="termin-info">
              <h3 class="termin-title">Agility‑Training</h3>
              <p class="termin-desc">Einführungskurs für Anfänger. Bitte vorher anmelden.</p>
              <div class="termin-meta">
                <span class="meta-item">📍 Vereinsgelände</span>
                <span class="meta-item">🕒 17:30 Uhr</span>
              </div>
            </div>
          </article>
          <article class="termin-card">
            <div class="termin-date">
              <span class="termin-day">Sa</span>
              <span class="termin-number">29</span>
              <span class="termin-month">Jun</span>
            </div>
            <div class="termin-info">
              <h3 class="termin-title">Sommerfest</h3>
              <p class="termin-desc">Grillen, Spiele und ein kleiner Wettbewerb für die Hunde.</p>
              <div class="termin-meta">
                <span class="meta-item">📍 Vereinsheim</span>
                <span class="meta-item">🕒 14:00 Uhr</span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="kontakt" class="section section-contact">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Kontakt & Info</h2>
          <p class="section-subtitle">Du hast Fragen oder möchtest mitmachen?</p>
        </div>
        <div class="contact-grid">
          <div class="contact-card">
            <h3 class="contact-title">📧 E‑Mail</h3>
            <p>info@hundeverein‑beispiel.de</p>
            <p>Wir antworten innerhalb von 24 Stunden.</p>
          </div>
          <div class="contact-card">
            <h3 class="contact-title">📍 Treffpunkt</h3>
            <p>Vereinsheim Musterstadt<br>
            Hundeweg 12<br>
            12345 Musterstadt</p>
          </div>
          <div class="contact-card">
            <h3 class="contact-title">📅 Nächste Veranstaltung</h3>
            <p>Frühlings‑Spaziergang<br>
            <strong>Samstag, 15. Juni</strong><br>
            Treffpunkt Stadtpark, 10 Uhr.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="ueber" class="section section-about">
      <div class="container">
        <div class="about-content">
          <h2 class="section-title">Über unseren Verein</h2>
          <p>Wir sind eine Gruppe von Hundefreunden, die sich regelmäßig trifft, um gemeinsam Zeit mit ihren Vierbeinern zu verbringen. Unser Ziel ist der Austausch über artgerechte Haltung, Training und vor allem der Spaß an der gemeinsamen Aktivität.</p>
          <p>Egal ob Welpe, Senior oder Familienhund – bei uns ist jeder willkommen.</p>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container">
      <p>© Hundeverein Musterstadt – Gemeinnütziger Verein seit 2015</p>
      <p class="footer-links">
        <a href="#impressum">Impressum</a> · 
        <a href="#datenschutz">Datenschutz</a>
      </p>
    </div>
  </footer>
</body>
</html>
```

Und das dazu passende CSS mit bewusster Gestaltung, Typografie-Pairing und einer kohärenten Palette:

```css styles.css
:root {
  /* Palette – warm, natürlich, hundefreundlich */
  --bg: #fefaf3;
  --ink: #2b241c;
  --accent: #8a704c;
  --accent-light: #d4b996;
  --soft: #e8e0d5;
  --radius: 16px;
  --shadow: 0 2px 4px rgba(43, 36, 28, 0.08), 0 12px 32px rgba(43, 36, 28, 0.12);
  --shadow-hover: 0 4px 8px rgba(43, 36, 28, 0.12), 0 16px 40px rgba(43, 36, 28, 0.18);
  --transition: all 0.2s ease;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1c1814;
    --ink: #f0ebe5;
    --accent: #c9a87a;
    --accent-light: #5d4d36;
    --soft: #2c2620;
  }
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
}

body {
  background-color: var(--bg);
  color: var(--ink);
  font-family: 'Lato', sans-serif;
  line-height: 1.6;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}

.container {
  width: 100%;
  max-width: 64rem;
  margin-inline: auto;
  padding-inline: 1rem;
}

/* Typografie */
h1, h2, h3, .section-title {
  font-family: 'Playfair Display', serif;
  font-weight: 700;
  line-height: 1.1;
}

h1.logo {
  font-size: clamp(2rem, 5vw, 3rem);
  margin-bottom: 0.25rem;
}

h2 {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  margin-bottom: 1rem;
}

h3 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
}

.tagline {
  font-size: 1.125rem;
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 1.5rem;
}

/* Header */
.site-header {
  padding: 2rem 0 1.5rem;
  border-bottom: 1px solid var(--soft);
}

.main-nav {
  display: flex;
  gap: 2rem;
  margin-top: 1.5rem;
}

.main-nav a {
  color: var(--ink);
  text-decoration: none;
  font-weight: 600;
  padding: 0.5rem 0;
  position: relative;
  transition: var(--transition);
}

.main-nav a::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background-color: var(--accent);
  transition: width 0.3s ease;
}

.main-nav a:hover::after {
  width: 100%;
}

/* Hero */
.hero {
  padding: 4rem 0;
  text-align: center;
  background-color: var(--soft);
  border-radius: 0 0 var(--radius) var(--radius);
  margin-bottom: 3rem;
}

.hero-title {
  font-size: clamp(2rem, 6vw, 3rem);
  margin-bottom: 1rem;
}

.hero-text {
  font-size: 1.25rem;
  max-width: 36rem;
  margin-inline: auto;
  color: var(--ink);
  opacity: 0.9;
}

/* Allgemeine Sektion */
.section {
  padding: 3rem 0;
}

.section-header {
  text-align: center;
  margin-bottom: 3rem;
}

.section-subtitle {
  font-size: 1.125rem;
  color: var(--accent);
  max-width: 36rem;
  margin-inline: auto;
}

/* Termine */
.termine-grid {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 640px) {
  .termine-grid {
    grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  }
}

.termin-card {
  background-color: var(--bg);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: var(--shadow);
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  transition: var(--transition);
}

.termin-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover);
}

.termin-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--accent);
  color: white;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  min-width: 4rem;
}

.termin-day {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.termin-number {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
  margin: 0.25rem 0;
}

.termin-month {
  font-size: 0.875rem;
  text-transform: uppercase;
}

.termin-info {
  flex: 1;
}

.termin-title {
  margin-bottom: 0.5rem;
}

.termin-desc {
  margin-bottom: 1rem;
  color: var(--ink);
  opacity: 0.8;
}

.termin-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.875rem;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

/* Kontakt */
.section-contact {
  background-color: var(--soft);
  border-radius: var(--radius);
}

.contact-grid {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 640px) {
  .contact-grid {
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
  }
}

.contact-card {
  background-color: var(--bg);
  border-radius: var(--radius);
  padding: 1.5rem;
  box-shadow: var(--shadow);
  transition: var(--transition);
}

.contact-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-hover);
}

.contact-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

/* Über uns */
.section-about {
  padding: 3rem 0;
}

.about-content {
  max-width: 48rem;
  margin-inline: auto;
  text-align: center;
}

.about-content p {
  margin-bottom: 1rem;
  font-size: 1.125rem;
}

/* Footer */
.site-footer {
  padding: 2rem 0;
  border-top: 1px solid var(--soft);
  text-align: center;
  font-size: 0.875rem;
  color: var(--ink);
  opacity: 0.7;
}

.footer-links {
  margin-top: 0.5rem;
}

.footer-links a {
  color: var(--accent);
  text-decoration: none;
}

.footer-links a:hover {
  text-decoration: underline;
}
```

Der Code ist fertig. Übernimm ihn mit „An Code senden“, dann im Code-Bereich auf „Sichern“ und „Veröffentlichen“ – danach ist die Startseite deines Hundevereins unter deiner Projekt-URL live. Die Seite hat eine bewusste Gestaltung mit warmen Naturtönen, großzügigem Abstand, einem schönen Font-Pairing (Playfair Display für Überschriften, Lato für Text) und funktioniert sofort auf allen Geräten.