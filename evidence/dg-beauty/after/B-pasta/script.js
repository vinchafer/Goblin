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
