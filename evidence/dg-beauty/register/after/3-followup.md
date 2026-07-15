# Nachfrage (after)

User: Danke! Kannst du ihn noch etwas abrunden und größer machen?

---

Ich passe den Button an: runde Ecken, größere Schrift und mehr Padding.

```html index.html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Farbwechsel</title>
    <style>
        :root {
            --bg-color: #faf6f0;
            --text-color: #211b16;
            --button-color: #b4532a;
            --button-text: #fff;
        }
        body {
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: system-ui, sans-serif;
            transition: background-color 0.3s ease;
        }
        .color-toggle {
            background-color: var(--button-color);
            color: var(--button-text);
            border: none;
            padding: 20px 36px;
            font-size: 1.5rem;
            border-radius: 50px; /* stark abgerundet */
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .color-toggle:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0,0,0,0.15);
        }
        .color-toggle:active {
            transform: translateY(0);
        }
    </style>
</head>
<body>
    <button class="color-toggle" id="toggleBtn">Farbe wechseln</button>

    <script>
        const toggleBtn = document.getElementById('toggleBtn');
        const colors = ['#faf6f0', '#211b16', '#e6f7ff', '#f0e6ff'];
        let currentIndex = 0;

        toggleBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % colors.length;
            document.body.style.backgroundColor = colors[currentIndex];
        });
    </script>
</body>
</html>
```

Der Button ist jetzt deutlich größer (Padding und Schrift) und hat einen Radius von 50px, was ihn vollständig abrundet. Die Farben wechseln in einer festen Liste durch.

Übernimm den Code mit "An Code senden", dann "Sichern" und "Veröffentlichen" — danach ist die App unter deiner Projekt-URL live.
