# Nachfrage (before)

User: Danke! Kannst du ihn noch etwas abrunden und größer machen?

---

Ja, ich passe den Button an: größere Touch-Ziele, abgerundete Ecken, eine bewusste Typografie und einen sanften Übergang.

```html index.html
<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Farbwechsel</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #f9f7f2;
            --ink: #1a1a1a;
            --accent: #3a6ea5;
            --accent-ink: #fff;
            --radius: 20px;
            --shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        }
        body {
            margin: 0;
            min-height: 100vh;
            background-color: var(--bg);
            color: var(--ink);
            font-family: 'Inter', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: background-color 0.4s ease;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        h1 {
            font-family: 'Poppins', sans-serif;
            font-size: clamp(2rem, 5vw, 3rem);
            margin-bottom: 2rem;
            line-height: 1.1;
        }
        .color-btn {
            background-color: var(--accent);
            color: var(--accent-ink);
            border: none;
            border-radius: var(--radius);
            padding: 20px 48px;
            font-size: 1.25rem;
            font-weight: 500;
            font-family: 'Inter', sans-serif;
            cursor: pointer;
            box-shadow: var(--shadow);
            transition: all 0.25s ease;
            min-height: 64px;
            min-width: 200px;
        }
        .color-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        }
        .color-btn:active {
            transform: translateY(0);
        }
        .color-btn:focus-visible {
            outline: 3px solid var(--accent);
            outline-offset: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Hintergrund-Toggle</h1>
        <button class="color-btn" id="toggleBtn">Farbe wechseln</button>
    </div>
    <script>
        const toggleBtn = document.getElementById('toggleBtn');
        const body = document.body;
        const colors = ['#f9f7f2', '#1a1a1a', '#3a6ea5', '#c06c84'];
        let currentIndex = 0;

        toggleBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % colors.length;
            body.style.backgroundColor = colors[currentIndex];
            
            // Textfarbe anpassen für Kontrast
            const isDark = currentIndex === 1;
            body.style.color = isDark ? '#f0f0f0' : '#1a1a1a';
        });
    </script>
</body>
</html>
```

Der Button ist jetzt größer (`padding: 20px 48px`, `min-height: 64px`), hat runde Ecken (`border-radius: 20px`) und eine schöne Typografie. Er wechselt durch vier Hintergrundfarben.

Übernimm den Code mit „An Code senden“, dann „Sichern“ und „Veröffentlichen“ – danach ist die App unter deiner Projekt-URL live.
