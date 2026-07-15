F-25 KNAPP PROBE — model: deepseek-ai/DeepSeek-V3.2

── PROMPT: Wie zentriere ich ein Div horizontal und vertikal?
   sentences=1  promoClose=false  verdict=SHORT ✓
   REPLY: Am Eltern-Element: ⏎ ```css ⏎ display: flex; ⏎ justify-content: center; ⏎ align-items: center; ⏎ ```

── PROMPT: Was ist der Unterschied zwischen let und const in JavaScript?
   sentences=2  promoClose=false  verdict=SHORT ✓
   REPLY: `let` erlaubt Neuzuweisung, `const` nicht – beide sind block-scoped. ⏎  ⏎ Beispiel: ⏎ ```javascript ⏎ let x = 1; ⏎ x = 2; // ok ⏎  ⏎ const y = 1; ⏎ y = 2; // Fehler ⏎ ```

── PROMPT: Bau mir einen einfachen Zähler-Button in HTML und stell ihn live.
   sentences=1  promoClose=false  verdict=SHORT ✓
   REPLY: Hier ist ein einfacher Zähler-Button: ⏎  ⏎ ```html index.html ⏎ <!DOCTYPE html> ⏎ <html lang="de"> ⏎ <head> ⏎     <meta charset="UTF-8"> ⏎     <meta name="viewport" content="width=device-width, initial-scale=1.0"> ⏎     <title>Einfacher Zähler</title> ⏎     <style> ⏎         body { ⏎             font-family: sans-serif; ⏎             display: flex; ⏎             flex-direction: column; ⏎             align-items: center; ⏎             justify-content: center; ⏎             min-height: 100vh; ⏎             margin: 0; ⏎             background: #f5f5f5; ⏎         } ⏎         .counter { ⏎             font-size: 4rem; ⏎             font-weight: bold; ⏎             margin: 2rem; ⏎             color: #333; ⏎         } ⏎         button { ⏎             font-size: 1.5rem; ⏎             padding: 1rem 2rem; ⏎             border: none; ⏎             border-radius: 8px; ⏎             background: #0077ff; ⏎             color: white; ⏎             cursor: pointer; ⏎             transition: background 0.2s; ⏎         } ⏎         button:hover { ⏎             background: #0055cc; ⏎         } ⏎     </style> ⏎ </head> ⏎ <body> ⏎     <div class="counter">0</div> ⏎     <button onclick="count()">Klick mich</button> ⏎  ⏎     <script> ⏎         let counter = 0; ⏎         const counterElement = document.querySelector('.counter'); ⏎  ⏎         function count() { ⏎             counter++; ⏎             counterElement.textContent = counter; ⏎         } ⏎     </script> ⏎ </body> ⏎ </html> ⏎ ``` ⏎  ⏎ Übernimm den Code mit „An Code senden“, dann „Sichern“ und „Veröffentlichen“ — danach ist der Zähler unter deiner Projekt-URL live.

RESULT: 3/3 short (≤3 sentences, no promo close)
