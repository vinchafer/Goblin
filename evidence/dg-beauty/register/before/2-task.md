# Aufgabe (before)

User: Baue mir einen Button, der bei Klick die Hintergrundfarbe der Seite wechselt.

---

Hier ist ein einfacher Button, der die Hintergrundfarbe der Seite bei Klick wechselt — mit einer bewusst gestalteten, stimmigen Erscheinung statt eines Standard-Buttons:

```html index.html
<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Hintergrund-Wechsler</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600&family=IBM+Plex+Sans:wght@400;500&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #faf6f0;
            --ink: #211b16;
            --accent: #5d6afb;
            --accent-ink: #fff;
            --radius: 16px;
            --shadow: 0 2px 4px rgba(33, 27, 22, 0.08), 0 12px 32px rgba(33, 27, 22, 0.12);
            --spacing-xs: 8px;
            --spacing-s: 16px;
            --spacing-m: 24px;
            --spacing-l: 32px;
            --spacing-xl: 48px;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #16130f;
                --ink: #f1ede6;
                --accent: #7987ff;
                --shadow: 0 2px 4px rgba(241, 237, 230, 0.08), 0 12px 32px rgba(241, 237, 230, 0.12);
            }
        }

        body {
            background: var(--bg);
            color: var(--ink);
            font-family: 'IBM Plex Sans', sans-serif;
            line-height: 1.6;
            margin: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: var(--spacing-s);
            transition: background-color 0.3s ease;
        }

        .container {
            max-width: 64rem;
            margin-inline: auto;
            text-align: center;
            padding: var(--spacing-xl) var(--spacing-m);
        }

        h1 {
            font-family: 'Space Grotesk', sans-serif;
            font-size: clamp(2rem, 5vw, 3.5rem);
            line-height: 1.1;
            margin-bottom: var(--spacing-m);
        }

        .description {
            font-size: 1.125rem;
            margin-bottom: var(--spacing-xl);
            max-width: 36rem;
            margin-left: auto;
            margin-right: auto;
        }

        .btn {
            background: var(--accent);
            color: var(--accent-ink);
            border: 0;
            border-radius: var(--radius);
            padding: 14px 28px;
            font-family: 'Space Grotesk', sans-serif;
            font-size: 1.125rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: var(--shadow);
            transition: transform 0.18s, box-shadow 0.18s, background-color 0.3s ease;
            min-height: 44px;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(33, 27, 22, 0.12), 0 16px 40px rgba(33, 27, 22, 0.16);
        }

        .btn:active {
            transform: translateY(0);
        }

        .btn:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 4px;
        }

        .color-info {
            margin-top: var(--spacing-l);
            font-size: 1rem;
            background: rgba(33, 27, 22, 0.05);
            padding: var(--spacing-s);
            border-radius: var(--radius);
            max-width: 20rem;
            margin-left: auto;
            margin-right: auto;
        }

        .dark-mode-note {
            margin-top: var(--spacing-xl);
            font-size: 0.875rem;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎨 Hintergrund-Wechsler</h1>
        <p class="description">
            Klicke auf den Button und die Seite wechselt ihre Hintergrundfarbe – von warmem Creme zu frischem Mint, zu sanftem Lavendel und zurück.
        </p>
        <button class="btn" id="colorSwitch">Farbe wechseln</button>
        <div class="color-info">
            Aktuelle Farbe: <span id="currentColor">#faf6f0</span>
        </div>
        <p class="dark-mode-note">
            Dein System-Dark-Mode wird automatisch berücksichtigt – der Button passt sich an.
        </p>
    </div>

    <script>
        const colors = [
            '#faf6f
