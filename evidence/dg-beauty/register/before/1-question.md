# Frage (before)

User: Wie zentriere ich ein Div horizontal und vertikal?

---

Hier ist ein vollständiges Beispiel mit mehreren Möglichkeiten – du kannst die gewünschte Variante auswählen:

```html index.html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Div Zentrierung</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Inter:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #f9f7f4;
            --ink: #1a1917;
            --surface: #ffffff;
            --accent: #4a6fa5;
            --accent-ink: #ffffff;
            --radius: 16px;
            --shadow: 0 2px 4px rgba(0, 0, 0, 0.05), 0 8px 32px rgba(0, 0, 0, 0.08);
            --gap: 32px;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #16130f;
                --ink: #f0ede6;
                --surface: #221f1b;
                --accent: #5c8ae0;
                --accent-ink: #ffffff;
                --shadow: 0 2px 4px rgba(0, 0, 0, 0.2), 0 8px 32px rgba(0, 0, 0, 0.3);
            }
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: var(--bg);
            color: var(--ink);
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            min-height: 100vh;
            padding: var(--gap);
            max-width: 72rem;
            margin-inline: auto;
        }

        h1 {
            font-family: 'Playfair Display', serif;
            font-size: clamp(2rem, 5vw, 3rem);
            line-height: 1.1;
            margin-bottom: 16px;
            text-align: center;
        }

        h2 {
            font-size: 1.5rem;
            margin-bottom: 24px;
            color: var(--accent);
        }

        p {
            margin-bottom: 24px;
            max-width: 60ch;
        }

        .container {
            background: var(--surface);
            border-radius: var(--radius);
            padding: var(--gap);
            box-shadow: var(--shadow);
            margin-bottom: var(--gap);
            border: 1px solid rgba(0, 0, 0, 0.05);
        }

        .method {
            margin-bottom: 48px;
            padding-bottom: 48px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .method:last-of-type {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }

        .demo-area {
            height: 300px;
            background: rgba(74, 111, 165, 0.08);
            border-radius: 12px;
            position: relative;
            margin-top: 24px;
            overflow: hidden;
        }

        .centered-div {
            background: var(--accent);
            color: var(--accent-ink);
            padding: 24px;
            border-radius: 12px;
            text-align: center;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            transition: transform 0.2s ease;
        }

        .centered-div:hover {
            transform: scale(1.02);
        }

        code {
            background: rgba(0, 0, 0, 0.05);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }

        pre {
            background: rgba(0, 0, 0, 0.03);
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 16px 0;
            font-family: 'Courier New', monospace;
            line-height: 1.4;
            border-left: 4px solid var(--accent);
        }

        @media (max-width: 640px) {
            body {
                padding: 16px;
            }
            
            .container {
                padding: 20px;
            }
            
            .demo-area {
                height: 200px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Div horizontal & vertikal zentrieren</h1>
        <p>Es gibt mehrere moderne Möglichkeiten, ein Element sowohl horizontal als auch vertikal zu zentrieren. Hier sind die gängigsten Methoden:</p>

        <div class="
