# Aufgabe (after)

User: Baue mir einen Button, der bei Klick die Hintergrundfarbe der Seite wechselt.

---

Hier ist der Code für einen Button, der bei Klick die Hintergrundfarbe der Seite wechselt — mit einer bewussten, ansprechenden Gestaltung:

```html index.html
<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Farbwechsel</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Sans:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #fef9f5;
            --ink: #1f1a17;
            --accent: #7c4dff;
            --accent-ink: #fff;
            --radius: 16px;
            --shadow: 0 2px 4px rgba(31, 26, 23, 0.08), 0 12px 32px rgba(31, 26, 23, 0.12);
            --transition: 180ms ease;
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #16130f;
                --ink: #f5f0ea;
                --accent: #9d7aff;
                --shadow: 0 2px 4px rgba(0, 0, 0, 0.3), 0 12px 32px rgba(0, 0, 0, 0.4);
            }
        }

        body {
            background-color: var(--bg);
            color: var(--ink);
            font-family: 'IBM Plex Sans', sans-serif;
            line-height: 1.6;
            margin: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            transition: background-color var(--transition);
            padding: 16px;
        }

        .container {
            max-width: 64rem;
            margin-inline: auto;
            text-align: center;
            padding: 32px;
            background-color: color-mix(in srgb, var(--bg) 85%, transparent);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            backdrop-filter: blur(8px);
        }

        h1 {
            font-family: 'Space Grotesk', sans-serif;
            font-size: clamp(2.5rem, 6vw, 4rem);
            line-height: 1.1;
            margin-bottom: 8px;
        }

        .subtitle {
            font-size: 1.125rem;
            color: color-mix(in srgb, var(--ink) 70%, transparent);
            margin-bottom: 48px;
            max-width: 36rem;
            margin-inline: auto;
        }

        .color-button {
            background-color: var(--accent);
            color: var(--accent-ink);
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.25rem;
            font-weight: 600;
            border: none;
            border-radius: var(--radius);
            padding: 16px 32px;
            cursor: pointer;
            box-shadow: var(--shadow);
            transition: transform var(--transition), box-shadow var(--transition), background-color var(--transition);
            min-height: 52px;
            min-width: 200px;
        }

        .color-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(124, 77, 255, 0.3);
        }

        .color-button:active {
            transform: translateY(0);
        }

        .color-button:focus-visible {
            outline: 3px solid var(--accent);
            outline-offset: 3px;
        }

        .color-list {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            justify-content: center;
            margin-top: 40px;
            max-width: 40rem;
        }

        .color-option {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            cursor: pointer;
            border: 3px solid color-mix(in srgb, var(--bg) 90%, transparent);
            transition: transform var(--transition), border-color var(--transition);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .color-option:hover {
            transform: scale(1.12);
            border-color: var(--accent);
        }

        .current-color {
            margin-top: 40px;
            font-size: 1rem;
            font-weight: 500;
            color: color-mix(in srgb, var(--ink) 80%, transparent);
        }

        .current-color span {
            font-weight: 700;
            color: var(--accent);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Farbwechsel</h1>
        <p class="subtitle">Klicke den Button für eine neue Hintergrundfarbe – oder wähle direkt eine aus den Vorschlägen.</p>
        
        <button
