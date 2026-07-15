Perfekt — ich baue dir einen kleinen Habit-Tracker mit deutscher Oberfläche und localStorage.  
Die App wird Gewohnheiten anlegen, täglich abhaken und den aktuellen Streak anzeigen.

Zuerst das Grundgerüst mit HTML, CSS und JavaScript — eine Datei `index.html` als Single-Page-App.

---

```html index.html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Habit Tracker – Deine täglichen Gewohnheiten</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600&family=IBM+Plex+Sans:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            /* Palette – Soft Craft Stimmung */
            --bg: #faf8f3;
            --surface: #fffdf9;
            --ink: #211b16;
            --ink-light: #5c534a;
            --accent: #4a7c59;
            --accent-hover: #3a6548;
            --accent-ink: #fff;
            --success: #8bc34a;
            --warning: #ffb300;
            --radius: 16px;
            --shadow: 0 2px 6px rgba(33, 27, 22, 0.06), 0 12px 36px rgba(33, 27, 22, 0.08);
            --shadow-hover: 0 4px 12px rgba(33, 27, 22, 0.10), 0 20px 48px rgba(33, 27, 22, 0.12);
            --transition: all 0.2s ease;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #16130f;
                --surface: #211b16;
                --ink: #f1ede7;
                --ink-light: #b0a99d;
                --accent: #5d9970;
                --accent-hover: #4a7c59;
                --accent-ink: #fff;
                --success: #9ccc65;
                --warning: #ffca28;
            }
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            background: var(--bg);
            color: var(--ink);
            font-family: 'IBM Plex Sans', sans-serif;
            line-height: 1.6;
            padding: 24px 16px;
            max-width: 64rem;
            margin-inline: auto;
        }

        header {
            margin-bottom: 48px;
            text-align: center;
        }

        h1 {
            font-family: 'Space Grotesk', sans-serif;
            font-size: clamp(2.25rem, 5vw, 3.5rem);
            line-height: 1.1;
            margin-bottom: 8px;
            color: var(--ink);
        }

        .subtitle {
            font-size: 1.125rem;
            color: var(--ink-light);
            margin-bottom: 32px;
        }

        main {
            display: grid;
            gap: 32px;
        }

        section {
            background: var(--surface);
            border-radius: var(--radius);
            padding: 32px;
            box-shadow: var(--shadow);
            transition: var(--transition);
        }
        section:hover {
            box-shadow: var(--shadow-hover);
        }

        h2 {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.75rem;
            margin-bottom: 24px;
            color: var(--ink);
        }

        .form-row {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            align-items: flex-end;
            margin-bottom: 32px;
        }

        .input-group {
            flex: 1;
            min-width: 200px;
        }

        label {
            display: block;
            font-weight: 500;
            margin-bottom: 8px;
            color: var(--ink);
        }

        input, button {
            font-family: 'IBM Plex Sans', sans-serif;
            font-size: 1rem;
            border-radius: var(--radius);
            border: 2px solid transparent;
            transition: var(--transition);
            outline: none;
        }

        input {
            width: 100%;
            padding: 12px 16px;
            background: var(--bg);
            color: var(--ink);
            border-color: #ddd;
        }
        input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px rgba(74, 124, 89, 0.2);
        }

        button {
            background: var(--accent);
            color: var(--accent-ink);
            font-weight: 600;
            padding: 12px 24px;
            border: none;
            cursor: pointer;
            box-shadow: var(--shadow);
            min-height: 44px;
            min-width: 120px;
        }
        button:hover {
            background: var(--accent-hover);
            transform: translateY(-2px);
            box-shadow: var(--shadow-hover);
        }
        button:active {
            transform: translateY(0);
        }
        button.secondary {
            background: transparent;
            color: var(--ink);
            border: 2px solid var(--ink-light);
        }
        button.secondary:hover {
            background: var(--ink-light);
            color: var(--surface);
        }

        .habits-list {
            list-style: none;
        }

        .habit-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 20px;
            margin-bottom: 16px;
            background: var(--bg);
            border-radius: var(--radius);
            border-left: 6px solid var(--accent);
            transition: var(--transition);
        }
        .habit-item:hover {
            background: var(--surface);
        }

        .habit-info {
            flex: 1;
        }

        .habit-name {
            font-weight: 600;
            font-size: 1.25rem;
            margin-bottom: 4px;
        }

        .habit-streak {
            font-size: 0.95rem;
            color: var(--ink-light);
        }
        .streak-high {
            color: var(--success);
            font-weight: 600;
        }

        .habit-actions {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .checkbox-wrapper {
            position: relative;
        }
        .checkbox-wrapper input {
            width: 24px;
            height: 24px;
            cursor: pointer;
            accent-color: var(--accent);
        }

        .delete-btn {
            background: transparent;
            color: var(--ink-light);
            font-size: 1.5rem;
            padding: 4px 12px;
            min-width: auto;
            box-shadow: none;
        }
        .delete-btn:hover {
            color: #d32f2f;
            background: transparent;
            transform: scale(1.1);
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--ink-light);
        }

        footer {
            margin-top: 48px;
            text-align: center;
            font-size: 0.9rem;
            color: var(--ink-light);
        }
    </style>
</head>
<body>
    <header>
        <h1>Habit Tracker</h1>
        <p class="subtitle">Baue tägliche Gewohnheiten auf – jeden Tag ein kleiner Schritt.</p>
    </header>

    <main>
        <section>
            <h2>Neue Gewohnheit hinzufügen</h2>
            <div class="form-row">
                <div class="input-group">
                    <label for="habit-name">Name der Gewohnheit</label>
                    <input type="text" id="habit-name" placeholder="z.B. 10 Minuten lesen" maxlength="50">
                </div>
                <button id="add-habit">Hinzufügen</button>
            </div>
        </section>

        <section>
            <h2>Deine Gewohnheiten</h2>
            <ul id="habits-container" class="habits-list">
                <!-- Hier werden die Gewohnheiten dynamisch eingefügt -->
            </ul>
        </section>
    </main>

    <footer>
        <p>Deine Daten werden lokal im Browser gespeichert und bleiben privat.</p>
    </footer>

    <script>
        // localStorage-Schlüssel
        const STORAGE_KEY = 'habit-tracker-data';

        // Gewohnheiten aus localStorage laden oder leeres Array
        let habits = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

        // DOM-Elemente
        const habitNameInput = document.getElementById('habit-name');
        const addButton = document.getElementById('add-habit');
        const habitsContainer = document.getElementById('habits-container');

        // Hilfsfunktion: Heutiges Datum im YYYY-MM-DD-Format
        function getToday() {
            const now = new Date();
            return now.toISOString().split('T')[0];
        }

        // Hilfsfunktion: Streak berechnen (wie viele Tage in Folge abgehakt)
        function calculateStreak(dates) {
            if (dates.length === 0) return 0;
            const sorted = [...dates].sort().reverse(); // neueste zuerst
            let streak = 0;
            let currentDate = new Date(getToday());
            for (let i = 0; i < sorted.length; i++) {
                const checkDate = new Date(sorted[i]);
                const diffDays = Math.floor((currentDate - checkDate) / (1000 * 60 * 60 * 24));
                if (diffDays === i) {
                    streak++;
                } else {
                    break;
                }
            }
            return streak;
        }

        // Gewohnheit hinzufügen
        function addHabit() {
            const name = habitNameInput.value.trim();
            if (!name) {
                alert('Bitte gib einen Namen für die Gewohnheit ein.');
                return;
            }
            if (habits.some(h => h.name === name)) {
                alert('Eine Gewohnheit mit diesem Namen existiert bereits.');
                return;
            }
            const newHabit = {
                id: Date.now(),
                name: name,
                checkedDates: [], // Array mit Datumsstrings (YYYY-MM-DD)
                createdAt: getToday()
            };
            habits.push(newHabit);
            saveAndRender();
            habitNameInput.value = '';
            habitNameInput.focus();
        }

        // Gewohnheit löschen
        function deleteHabit(id) {
            if (!confirm('Möchtest du diese Gewohnheit wirklich löschen?')) return;
            habits = habits.filter(h => h.id !== id);
            saveAndRender();
        }

        // Heute als erledigt markieren / Markierung aufheben
        function toggleCheck(id) {
            const habit = habits.find(h => h.id === id);
            if (!habit) return;
            const today = getToday();
            if (habit.checkedDates.includes(today)) {
                // Heutige Markierung entfernen
                habit.checkedDates = habit.checkedDates.filter(d => d !== today);
            } else {
                // Heutige Markierung hinzufügen
                habit.checkedDates.push(today);
            }
            saveAndRender();
        }

        // In localStorage speichern
        function saveHabits() {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(habits));
        }

        // UI aktualisieren
        function renderHabits() {
            if (habits.length === 0) {
                habitsContainer.innerHTML = `
                    <div class="empty-state">
                        <p>Noch keine Gewohnheiten angelegt.</p>
                        <p>Füge oben deine erste Gewohnheit hinzu!</p>
                    </div>
                `;
                return;
            }

            habitsContainer.innerHTML = habits.map(habit => {
                const streak = calculateStreak(habit.checkedDates);
                const todayChecked = habit.checkedDates.includes(getToday());
                const streakClass = streak >= 7 ? 'streak-high' : '';
                return `
                    <li class="habit-item">
                        <div class="habit-info">
                            <div class="habit-name">${habit.name}</div>
                            <div class="habit-streak ${streakClass}">
                                🔥 Streak: <strong>${streak}</strong> Tag${streak !== 1 ? 'e' : ''} 
                                | Gesamt: <strong>${habit.checkedDates.length}</strong> Tag${habit.checkedDates.length !== 1 ? 'e' : ''}
                            </div>
                        </div>
                        <div class="habit-actions">
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="check-${habit.id}" ${todayChecked ? 'checked' : ''}>
                                <label for="check-${habit.id}" class="visually-hidden">Heute erledigt</label>
                            </div>
                            <button class="delete-btn secondary" aria-label="Löschen" onclick="deleteHabit(${habit.id})">×</button>
                        </div>
                    </li>
                `;
            }).join('');

            // Event-Listener für die Checkboxen setzen
            habits.forEach(habit => {
                const checkbox = document.getElementById(`check-${habit.id}`);
                if (checkbox) {
                    checkbox.addEventListener('change', () => toggleCheck(habit.id));
                }
            });
        }

        // Speichern + Rendern kombinieren
        function saveAndRender() {
            saveHabits();
            renderHabits();
        }

        // Event-Listener
        addButton.addEventListener('click', addHabit);
        habitNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addHabit();
        });

        // Initiales Rendern
        renderHabits();
    </script>
</body>
</html>
```

---

**Was die App kann:**

- **Gewohnheiten anlegen** – über Eingabefeld + Button, mit Validierung (keine Duplikate, kein leerer Name).
- **Täglich abhaken** – Checkbox für heute markieren/entmarkieren.
- **Streak sehen** – zeigt aktuelle Tages‑Kette und Gesamttage.
- **Löschen** – mit Bestätigung.
- **LocalStorage** – Daten bleiben zwischen Sessions erhalten.
- **Deutsche Oberfläche** – Texte, Fehlermeldungen, Datumslogik.
- **Responsive** – mobile‑first, Touch‑freundliche Buttons.
- **Dark Mode** – automatisch an `prefers-color-scheme` angepasst.
- **Visuell ansprechend** – nach der Design‑Grundlage: Soft Craft Stimmung, bewusste Typografie (Space Grotesk + IBM Plex Sans), warme Palette, weiche Schatten, konsistente Spacing‑Skala.

---

**So stellst du die App live:**

1. Kopiere den gesamten Code oben und klicke auf **„An Code senden“**.
2. Im Code‑Bereich klickst du auf **„Sichern“**, um die Datei zu speichern.
3. Dann auf **„Veröffentlichen“** – schon ist die App unter deiner Projekt‑URL live.

Danach kannst du Gewohnheiten eintragen, abhaken und den Streak verfolgen – alles lokal in deinem Browser gespeichert.