# Frage (after)

User: Wie zentriere ich ein Div horizontal und vertikal?

---

Für die Zentrierung eines Divs horizontal und vertikal gibt es mehrere moderne CSS-Methoden. Hier sind die drei gängigsten:

### **1. Flexbox (empfohlen)**
Einfach, flexibel und wird am häufigsten genutzt.

```css
.container {
  display: flex;
  justify-content: center;    /* horizontal */
  align-items: center;        /* vertikal */
  min-height: 100vh;          /* volle Höhe */
}
```

HTML:
```html
<div class="container">
  <div>Mein zentriertes Div</div>
</div>
```

### **2. CSS Grid**
Kurzer Code mit `place-items: center;`.

```css
.container {
  display: grid;
  place-items: center;
  min-height: 100vh;
}
```

### **3. Absolute Positionierung mit Transform**
Klassische Methode für absolute Zentrierung.

```css
.centered-div {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

HTML:
```html
<body style="position: relative; height: 100vh;">
  <div class="centered-div">Zentriert</div>
</body>
```

**Empfehlung:** Für die meisten Layouts nimm Flexbox. Sie ist intuitiv, responsive und unterstützt alle modernen Browser.

Willst du eine komplette Beispiel-App mit einem zentrierten Div bauen? Ich schreibe dir den Code — mit ‚An Code senden' bringst du ihn in den Code-Bereich, dort ‚Sichern' und dann ‚Veröffentlichen' — danach ist die App unter einer öffentlichen URL live.
