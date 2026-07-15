Ich baue dir eine Rezept-Seite für deine Pasta-Gerichte – mit einer Startseite, die alle Rezepte auflistet, und einem Klick auf jedes Rezept für die Detailansicht.  
Dafür brauchen wir eine klare Navigation, eine ansprechende Gestaltung und eine einfache Datenstruktur. Ich setze das als Single-Page-App mit Hash-Routing um (kein Server, alles lokal im Browser), so dass du die Seite später einfach veröffentlichen kannst.

Hier ist das Grundgerüst – ich beginne mit drei Dateien:

**index.html** – die Hauptdatei mit Layout und Routen  
**style.css** – das Design nach den Goblin-Regeln (kein Framework-Default)  
**script.js** – die Logik für Daten, Routing und Interaktionen  

Zuerst die HTML-Struktur:

```html index.html
<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Meine liebsten Pasta-Rezepte</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Lato:wght@400;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <header class="site-header">
        <div class="container">
            <h1><i class="fas fa-pasta-fusilli"></i> Meine Pasta-Küche</h1>
            <p class="subtitle">Eine handverlesene Sammlung meiner liebsten Nudelgerichte</p>
        </div>
    </header>

    <main class="container">
        <div id="app">
            <!-- Hier wird je nach Route die Übersicht oder das Detail eingeblendet -->
            <div id="view"></div>
        </div>
    </main>

    <footer class="site-footer">
        <div class="container">
            <p>Gesammelt mit viel ❤️ und einer Prise Parmesan</p>
            <p class="footer-links">
                <a href="#/" title="Zurück zur Startseite"><i class="fas fa-home"></i> Übersicht</a>
                |
                <a href="https://github.com" target="_blank" rel="noopener"><i class="fab fa-github"></i> Code</a>
            </p>
        </div>
    </footer>

    <script src="script.js"></script>
</body>
</html>
```

Jetzt das CSS – mit einer warmen, italienisch inspirierten Palette und typografischer Präzision:

```css style.css
/* ========== CSS Custom Properties ========== */
:root {
    /* Palette: warme, mediterrane Töne */
    --primary: #2a5c3d;          /* Tiefgrün – wie Basilikum */
    --primary-light: #4a7c5c;
    --accent: #c46a2d;           /* Warmes Orange – wie Tomate */
    --accent-light: #e38a4a;
    --neutral-bg: #f8f4ed;       /* Cremiger Hintergrund */
    --neutral-card: #fffcf5;
    --neutral-border: #e6dfd2;
    --ink: #211b16;              •• Tiefes Braunschwarz für Text */
    --ink-light: #5a5349;
    --white: #ffffff;

    /* Typografie-Skala */
    --font-heading: 'Playfair Display', serif;
    --font-body: 'Lato', sans-serif;

    /* Abstände (8er-Skala) */
    --space-xs: 8px;
    --space-sm: 16px;
    --space-md: 24px;
    --space-lg: 32px;
    --space-xl: 48px;
    --space-xxl: 64px;

    /* Radien & Schatten */
    --radius: 16px;
    --shadow-sm: 0 2px 6px rgba(33, 27, 22, 0.06);
    --shadow-md: 0 4px 20px rgba(33, 27, 22, 0.10);
    --shadow-lg: 0 10px 40px rgba(33, 27, 22, 0.12);

    /* Transitions */
    --transition: 180ms ease-in-out;
}

/* Dark Mode – falls gewünscht */
@media (prefers-color-scheme: dark) {
    :root {
        --neutral-bg: #16130f;
        --neutral-card: #211b16;
        --neutral-border: #3a3329;
        --ink: #f0ebe5;
        --ink-light: #b8b2a8;
        --primary: #3d8b5c;
        --accent: #e38a4a;
    }
}

/* ========== Basis ========== */
* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html {
    font-size: 18px;
    scroll-behavior: smooth;
}

body {
    background-color: var(--neutral-bg);
    color: var(--ink);
    font-family: var(--font-body);
    line-height: 1.6;
    padding-bottom: env(safe-area-inset-bottom);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.container {
    width: 100%;
    max-width: min(64rem, 95vw);
    margin-inline: auto;
    padding-inline: var(--space-sm);
}

/* ========== Header ========== */
.site-header {
    background-color: var(--primary);
    color: var(--white);
    padding-block: var(--space-xl);
    text-align: center;
    margin-bottom: var(--space-xl);
    box-shadow: var(--shadow-md);
}

.site-header h1 {
    font-family: var(--font-heading);
    font-size: clamp(2.5rem, 6vw, 3.5rem);
    line-height: 1.1;
    margin-bottom: var(--space-sm);
}

.site-header .subtitle {
    font-size: 1.1rem;
    opacity: 0.9;
    font-weight: 300;
}

.site-header i {
    margin-right: var(--space-xs);
    font-size: 1.1em;
}

/* ========== Hauptbereich ========== */
main {
    flex: 1;
    padding-block: var(--space-lg);
}

#app {
    position: relative;
    min-height: 50vh;
}

/* ========== Rezept-Übersicht ========== */
.overview {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-lg);
    margin-bottom: var(--space-xxl);
}

.recipe-card {
    background: var(--neutral-card);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: transform var(--transition), box-shadow var(--transition);
    cursor: pointer;
    border: 1px solid var(--neutral-border);
    display: flex;
    flex-direction: column;
}

.recipe-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-md);
}

.recipe-card:active {
    transform: translateY(-2px);
}

.recipe-image {
    height: 180px;
    background: linear-gradient(135deg, var(--primary-light) 0%, var(--accent-light) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--white);
    font-size: 3rem;
}

.recipe-content {
    padding: var(--space-md);
    flex: 1;
    display: flex;
    flex-direction: column;
}

.recipe-content h2 {
    font-family: var(--font-heading);
    font-size: 1.6rem;
    margin-bottom: var(--space-xs);
    color: var(--ink);
}

.recipe-meta {
    display: flex;
    gap: var(--space-md);
    margin-bottom: var(--space-sm);
    font-size: 0.9rem;
    color: var(--ink-light);
}

.recipe-meta span {
    display: flex;
    align-items: center;
    gap: 4px;
}

.recipe-description {
    color: var(--ink-light);
    margin-bottom: var(--space-md);
    flex: 1;
}

.recipe-actions {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.btn {
    background: var(--accent);
    color: var(--white);
    border: none;
    border-radius: calc(var(--radius) / 2);
    padding: var(--space-xs) var(--space-md);
    font-family: var(--font-body);
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: background-color var(--transition), transform 0.1s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    text-decoration: none;
}

.btn:hover {
    background-color: var(--accent-light);
    transform: scale(1.03);
}

.btn:active {
    transform: scale(0.98);
}

.btn:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
}

.btn-outline {
    background: transparent;
    color: var(--accent);
    border: 1px solid var(--accent);
}

.btn-outline:hover {
    background-color: rgba(196, 106, 45, 0.08);
}

/* ========== Detailansicht ========== */
.detail-view {
    max-width: 52rem;
    margin-inline: auto;
    animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

.detail-header {
    margin-bottom: var(--space-xl);
    text-align: center;
}

.detail-header h1 {
    font-family: var(--font-heading);
    font-size: clamp(2.2rem, 5vw, 3rem);
    line-height: 1.1;
    margin-bottom: var(--space-sm);
}

.detail-meta {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: var(--space-lg);
    font-size: 1rem;
    color: var(--ink-light);
}

.detail-image {
    height: 300px;
    border-radius: var(--radius);
    background: linear-gradient(135deg, var(--primary-light) 0%, var(--accent-light) 100%);
    margin-bottom: var(--space-xl);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--white);
    font-size: 4rem;
    box-shadow: var(--shadow-lg);
}

.detail-body {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-xl);
}

@media (min-width: 768px) {
    .detail-body {
        grid-template-columns: 1fr 1fr;
    }
}

.ingredients, .steps {
    background: var(--neutral-card);
    padding: var(--space-lg);
    border-radius: var(--radius);
    box-shadow: var(--shadow-sm);
}

h2.section-title {
    font-family: var(--font-heading);
    font-size: 1.8rem;
    margin-bottom: var(--space-md);
    color: var(--primary);
    border-bottom: 2px solid var(--neutral-border);
    padding-bottom: var(--space-xs);
}

.ingredients ul, .steps ol {
    padding-left: var(--space-md);
}

.ingredients li, .steps li {
    margin-bottom: var(--space-sm);
    padding-left: var(--space-xs);
}

.steps li {
    margin-bottom: var(--space-md);
}

.back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: var(--space-xl);
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
}

.back-link:hover {
    text-decoration: underline;
}

/* ========== Footer ========== */
.site-footer {
    background-color: var(--primary);
    color: var(--white);
    padding-block: var(--space-lg);
    margin-top: var(--space-xxl);
    text-align: center;
}

.site-footer p {
    margin-bottom: var(--space-sm);
}

.footer-links a {
    color: inherit;
    text-decoration: none;
    margin: 0 var(--space-xs);
    opacity: 0.9;
}

.footer-links a:hover {
    opacity: 1;
    text-decoration: underline;
}

/* ========== Hilfsklassen ========== */
.hidden {
    display: none !important;
}

.text-center {
    text-align: center;
}

.mt-1 { margin-top: var(--space-xs); }
.mt-2 { margin-top: var(--space-sm); }
.mt-3 { margin-top: var(--space-md); }
.mt-4 { margin-top: var(--space-lg); }
.mb-1 { margin-bottom: var(--space-xs); }
.mb-2 { margin-bottom: var(--space-sm); }
.mb-3 { margin-bottom: var(--space-md); }
.mb-4 { margin-bottom: var(--space-lg); }
```

Und schließlich das JavaScript, das die Daten hält und zwischen Übersicht und Detailansicht routet:

```js script.js
// ========== Rezept-Daten ==========
const recipes = [
    {
        id: 'carbonara',
        title: 'Spaghetti Carbonara',
        description: 'Cremig, würzig und ohne Sahne – die klassische römische Art.',
        prepTime: 15,
        cookTime: 15,
        servings: 4,
        difficulty: 'Mittel',
        icon: 'fas fa-bacon',
        ingredients: [
            '400 g Spaghetti',
            '200 g Guanciale (oder Pancetta)',
            '4 Eigelb',
            '100 g Pecorino Romano (gerieben)',
            'Schwarzer Pfeffer (frisch gemahlen)',
            'Salz'
        ],
        steps: [
            'Guanciale in kleine Würfel schneiden und in einer Pfanne bei mittlerer Hitze auslassen, bis er knusprig ist. Vom Herd nehmen und abkühlen lassen.',
            'Spaghetti in reichlich Salzwasser al dente kochen.',
            'In einer Schüssel Eigelb mit dem geriebenen Pecorino und viel schwarzem Pfeffer verrühren.',
            'Die heißen Spaghetti (abgetropft, etwas Kochwasser aufbewahren) in die Pfanne mit dem Guanciale geben, vom Herd nehmen.',
            'Die Ei-Käse-Mischung unterrühren – wenn es zu fest wird, mit etwas Nudelwasser cremig machen. Sofort servieren.'
        ],
        tip: 'Nie Sahne verwenden – die Creme entsteht allein aus Ei, Käse und Nudelwasser.'
    },
    {
        id: 'pesto-genovese',
        title: 'Trenette al Pesto Genovese',
        description: 'Das berühmte Ligurische Basilikum-Pesto mit grünen Bohnen und Kartoffeln.',
        prepTime: 20,
        cookTime: 25,
        servings: 4,
        difficulty: 'Einfach',
        icon: 'fas fa-leaf',
        ingredients: [
            '400 g Trenette oder Linguine',
            '2 Handvoll frische Basilikumblätter',
            '50 g Pinienkerne',
            '2 kleine Knoblauchzehen',
            '80 g Parmesan (gerieben)',
            '80 g Pecorino (gerieben)',
            '150 ml Olivenöl',
            '200 g grüne Bohnen',
            '2 mittelgroße Kartoffeln',
            'Salz'
        ],
        steps: [
            'Basilikum, Pinienkerne, Knoblauch und eine Prise Salz im Mörser zu einer Paste zerstoßen (oder im Mixer).',
            'Käse unterrühren, dann nach und nach Olivenöl einarbeiten bis eine cremige Sauce entsteht.',
            'Kartoffeln schälen und in kleine Würfel schneiden, Bohnen putzen und in Stücke brechen.',
            'Kartoffeln und Bohnen in kochendem Salzwasser 5 Min. vorkochen, dann die Nudeln hinzufügen und alles zusammen al dente garen.',
            'Nudeln mit Gemüse abtropfen, mit dem Pesto vermengen und sofort servieren.'
        ],
        tip: 'Das Pesto nie erhitzen – immer erst auf die heißen Nudeln geben.'
    },
    {
        id: 'amatriciana',
        title: 'Bucatini all\'Amatriciana',
        description: 'Würzig-tomatige Sauce mit Guanciale und Pecorino – ein Klassiker aus Amatrice.',
        prepTime: 10,
        cookTime: 30,
        servings: 4,
        difficulty: 'Einfach',
        icon: 'fas fa-pepper-hot',
        ingredients: [
            '400 g Bucatini',
            '200 g Guanciale',
            '800 g passierte Tomaten',
            '1 kleine Zwiebel',
            '1–2 getrocknete Chilischoten',
            '80 g Pecorino Romano (gerieben)',
            'Olivenöl',
            'Salz'
        ],
        steps: [
            'Guanciale in Streifen schneiden. Zwiebel fein hacken. Chili zerbröseln.',
            'Guanciale in etwas Olivenöl knusprig braten, herausnehmen.',
            'Zwiebel und Chili im zurückgebliebenen Fett glasig dünsten.',
            'Passierte Tomaten zugeben, 20–25 Min. bei geringer Hitze köcheln lassen.',
            'Bucatini al dente kochen, abtropfen, mit der Sauce vermengen. Guanciale und Pecorino unterheben.'
        ],
        tip: 'Die Sauce sollte schön reduziert sein – nicht zu flüssig.'
    },
    {
        id: 'cacio-e-pepe',
        title: 'Cacio e Pepe',
        description: 'Nur drei Zutaten: Pecorino, schwarzer Pfeffer und Tonnarelli. Einfach und genial.',
        prepTime: 5,
        cookTime: 10,
        servings: 2,
        difficulty: 'Schwer',
        icon: 'fas fa-cheese',
        ingredients: [
            '200 g Tonnarelli oder Spaghetti',
            '150 g Pecorino Romano (sehr fein gerieben)',
            '1½ EL grob gemahlener schwarzer Pfeffer',
            'Salz'
        ],
        steps: [
            'Pfeffer in einer trockenen Pfanne kurz rösten, bis er duftet. Beiseitestellen.',
            'Nudeln in reichlich Salzwasser al dente kochen, ½ Tasse Nudelwasser auffangen.',
            'Nudelwasser langsam unter den Pecorino rühren, bis eine cremige Paste entsteht.',
            'Die heißen Nudeln (abgetropft) in die Pfanne mit dem Pfeffer geben, vom Herd nehmen.',
            'Die Käsecreme unterrühren – schnell arbeiten, damit sie nicht klumpt. Sofort servieren.'
        ],
        tip: 'Der Pecorino muss sehr fein gerieben sein, sonst schmilzt er nicht richtig.'
    }
];

// ========== State & DOM-Elemente ==========
const viewEl = document.getElementById('view');
let currentRecipe = null;

// ========== Routing ==========
function handleHashChange() {
    const hash = window.location.hash.substring(1); // Entfernt das '#'
    if (hash === '' || hash === '/') {
        renderOverview();
    } else if (hash.startsWith('recipe/')) {
        const recipeId = hash.split('/')[1];
        renderDetail(recipeId);
    } else {
        renderNotFound();
    }
}

function navigateTo(path) {
    window.location.hash = path;
}

// ========== Render-Funktionen ==========
function renderOverview() {
    currentRecipe = null;
    viewEl.innerHTML = `
        <div class="overview">
            ${recipes.map(recipe => `
                <article class="recipe-card" data-id="${recipe.id}">
                    <div class="recipe-image">
                        <i class="${recipe.icon}"></i>
                    </div>
                    <div class="recipe-content">
                        <h2>${recipe.title}</h2>
                        <div class="recipe-meta">
                            <span><i class="fas fa-clock"></i> ${recipe.prepTime + recipe.cookTime} Min.</span>
                            <span><i class="fas fa-user-friends"></i> ${recipe.servings} Pers.</span>
                            <span><i class="fas fa-signal"></i> ${recipe.difficulty}</span>
                        </div>
                        <p class="recipe-description">${recipe.description}</p>
                        <div class="recipe-actions">
                            <button class="btn btn-outline" data-id="${recipe.id}">
                                <i class="fas fa-star"></i> Merken
                            </button>
                            <button class="btn" data-id="${recipe.id}">
                                <i class="fas fa-utensils"></i> Rezept öffnen
                            </button>
                        </div>
                    </div>
                </article>
            `).join('')}
        </div>
    `;

    // Event-Listener für Klicks auf Karten und Buttons
    viewEl.querySelectorAll('.recipe-card, .recipe-actions .btn:not(.btn-outline)').forEach(el => {
        el.addEventListener('click', (e) => {
            const recipeId = e.currentTarget.dataset.id;
            if (recipeId) {
                navigateTo(`recipe/${recipeId}`);
            }
        });
    });

    // Merken-Buttons (lokaler Favorit)
    viewEl.querySelectorAll('.btn-outline').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const recipeId = e.currentTarget.dataset.id;
            const recipe = recipes.find(r => r.id === recipeId);
            alert(`"${recipe.title}" wurde zu deinen Favoriten hinzugefügt (lokaler Demo-Effekt).`);
            // Hier könnte man localStorage verwenden, um Favoriten zu speichern
        });
    });
}

function renderDetail(recipeId) {
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) {
        renderNotFound();
        return;
    }

    currentRecipe = recipe;
    viewEl.innerHTML = `
        <div class="detail-view">
            <a href="#/" class="back-link">
                <i class="fas fa-arrow-left"></i> Zurück zur Übersicht
            </a>
            <div class="detail-header">
                <h1>${recipe.title}</h1>
                <div class="detail-meta">
                    <span><i class="fas fa-clock"></i> Vorbereitung: ${recipe.prepTime} Min. | Kochzeit: ${recipe.cookTime} Min.</span>
                    <span><i class="fas fa-user-friends"></i> ${recipe.servings} Personen</span>
                    <span><i class="fas fa-signal"></i> Schwierigkeit: ${recipe.difficulty}</span>
                </div>
            </div>
            <div class="detail-image">
                <i class="${recipe.icon}"></i>
            </div>
            <div class="detail-body">
                <section class="ingredients">
                    <h2 class="section-title"><i class="fas fa-shopping-basket"></i> Zutaten</h2>
                    <ul>
                        ${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}
                    </ul>
                </section>
                <section class="steps">
                    <h2 class="section-title"><i class="fas fa-list-ol"></i> Zubereitung</h2>
                    <ol>
                        ${recipe.steps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                </section>
            </div>
            ${recipe.tip ? `
                <div class="tip mt-4">
                    <h2 class="section-title"><i class="fas fa-lightbulb"></i> Tipp</h2>
                    <p>${recipe.tip}</p>
                </div>
            ` : ''}
            <div class="text-center mt-4">
                <button class="btn" id="printBtn">
                    <i class="fas fa-print"></i> Rezept drucken
                </button>
            </div>
        </div>
    `;

    // Zurück-Link
    viewEl.querySelector('.back-link').addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('/');
    });

    // Drucken-Button
    document.getElementById('printBtn').addEventListener('click', () => {
        window.print();
    });
}

function renderNotFound() {
    viewEl.innerHTML = `
        <div class="text-center">
            <h2><i class="fas fa-search"></i> Rezept nicht gefunden</h2>
            <p class="mt-2">Das gesuchte Pasta-Rezept existiert leider nicht in unserer Sammlung.</p>
            <a href="#/" class="btn mt-3">
                <i class="fas fa-home"></i> Zurück zur Übersicht
            </a>
        </div>
    `;
}

// ========== Initialisierung ==========
window.addEventListener('DOMContentLoaded', () => {
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
});

// Einfache Favoriten-Funktion (Demo)
window.addEventListener('load', () => {
    console.log('Pasta-Rezepte geladen – buon appetito!');
});
```

Die Seite ist fertig zum Live‑Stellen.  
So bringst du sie online:

1. Klicke unter diesem Codeblock auf **„An Code senden“** – dann erscheint der Code im Code‑Bereich rechts.  
2. Klicke dort auf **„Sichern“** (alle drei Dateien werden gespeichert).  
3. Klicke dann auf **„Veröffentlichen“** – schon ist die App unter einer öffentlichen URL live.

Du kannst die Rezepte in `script.js` erweitern – einfach ein weiteres Objekt im Array `recipes` hinzufügen.  
Das Design passt sich automatisch an, und die Navigation zwischen Übersicht und Detailansicht funktioniert sofort.