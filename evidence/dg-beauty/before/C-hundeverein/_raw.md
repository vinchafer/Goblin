Ich baue dir eine Startseite für den Hundeverein mit Terminen und Kontakt-Sektion. Hier ist der Code:

```html index.html
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hundeverein - Willkommen</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        body {
            background-color: #f8f9fa;
            color: #333;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }
        
        /* Header */
        header {
            background: linear-gradient(135deg, #2c3e50, #4a6491);
            color: white;
            padding: 2rem 0;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        header h1 {
            font-size: 2.8rem;
            margin-bottom: 0.5rem;
            letter-spacing: 1px;
        }
        
        header p {
            font-size: 1.2rem;
            opacity: 0.9;
            max-width: 800px;
            margin: 0 auto;
        }
        
        /* Navigation */
        nav {
            background-color: #34495e;
            padding: 1rem 0;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        nav ul {
            display: flex;
            justify-content: center;
            list-style: none;
            flex-wrap: wrap;
        }
        
        nav li {
            margin: 0 1.5rem;
        }
        
        nav a {
            color: white;
            text-decoration: none;
            font-weight: 500;
            font-size: 1.1rem;
            transition: color 0.3s;
            padding: 0.5rem 0;
            display: inline-block;
        }
        
        nav a:hover {
            color: #3498db;
        }
        
        /* Main Content */
        main {
            padding: 3rem 0;
        }
        
        section {
            margin-bottom: 4rem;
            background-color: white;
            border-radius: 10px;
            padding: 2.5rem;
            box-shadow: 0 5px 15px rgba(0,0,0,0.05);
        }
        
        section h2 {
            color: #2c3e50;
            margin-bottom: 1.5rem;
            padding-bottom: 0.8rem;
            border-bottom: 3px solid #3498db;
            font-size: 2rem;
        }
        
        /* Termine */
        .termine-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-top: 1.5rem;
        }
        
        .termin-card {
            background-color: #f8f9fa;
            border-left: 5px solid #3498db;
            padding: 1.5rem;
            border-radius: 8px;
            transition: transform 0.3s, box-shadow 0.3s;
        }
        
        .termin-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.08);
        }
        
        .termin-card h3 {
            color: #2c3e50;
            margin-bottom: 0.8rem;
        }
        
        .termin-datum {
            color: #e74c3c;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }
        
        .termin-ort {
            color: #7f8c8d;
            margin-bottom: 1rem;
        }
        
        /* Kontakt */
        .kontakt-info {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 2rem;
            margin-top: 1.5rem;
        }
        
        .kontakt-item {
            display: flex;
            align-items: flex-start;
            gap: 1rem;
        }
        
        .kontakt-icon {
            background-color: #3498db;
            color: white;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            flex-shrink: 0;
        }
        
        .kontakt-text h3 {
            color: #2c3e50;
            margin-bottom: 0.5rem;
        }
        
        .kontakt-text p {
            color: #555;
        }
        
        /* Footer */
        footer {
            background-color: #2c3e50;
            color: white;
            padding: 2rem 0;
            text-align: center;
            margin-top: 3rem;
        }
        
        footer p {
            opacity: 0.8;
            margin-bottom: 0.5rem;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            nav ul {
                flex-direction: column;
                align-items: center;
            }
            
            nav li {
                margin: 0.5rem 0;
            }
            
            section {
                padding: 1.5rem;
            }
            
            header h1 {
                font-size: 2.2rem;
            }
        }
    </style>
</head>
<body>
    <header>
        <div class="container">
            <h1>Hundeverein „Treue Freunde"</h1>
            <p>Gemeinsam für das Wohl unserer vierbeinigen Begleiter – seit 1995</p>
        </div>
    </header>
    
    <nav>
        <div class="container">
            <ul>
                <li><a href="#start">Start</a></li>
                <li><a href="#termine">Termine</a></li>
                <li><a href="#kontakt">Kontakt</a></li>
                <li><a href="#ueber">Über uns</a></li>
            </ul>
        </div>
    </nav>
    
    <main class="container">
        <section id="start">
            <h2>Willkommen beim Hundeverein!</h2>
            <p>Wir sind eine Gemeinschaft von Hundeliebhabern, die sich regelmäßig trifft, um gemeinsam Zeit mit unseren Vierbeinern zu verbringen, Wissen auszutauschen und das Miteinander von Mensch und Hund zu fördern. Unser Verein organisiert Training, Spaziergänge, Veranstaltungen und steht allen offen, die ihr Interesse an Hunden teilen.</p>
            <p>Schau dir unsere nächsten Termine an und komm vorbei – wir freuen uns auf dich und deinen Hund!</p>
        </section>
        
        <section id="termine">
            <h2>Nächste Termine</h2>
            <div class="termine-grid">
                <div class="termin-card">
                    <h3>Sonntagsspaziergang</h3>
                    <div class="termin-datum">Sonntag, 15. Juni 2024, 10:00 Uhr</div>
                    <div class="termin-ort">Treffpunkt: Stadtpark Eingang Nord</div>
                    <p>Gemeinsamer Spaziergang durch den Stadtpark mit anschließendem Kaffee und Hundekeksen. Für alle Mitglieder und Interessierte.</p>
                </div>
                
                <div class="termin-card">
                    <h3>Welpen-Grundkurs</h3>
                    <div class="termin-datum">Mittwoch, 19. Juni 2024, 17:00 Uhr</div>
                    <div class="termin-ort">Hundeplatz „Am Wiesenweg"</div>
                    <p>Erster von 6 Terminen unseres Welpenkurses. Anmeldung erforderlich. Bringe Leckerlis und Spielzeug mit.</p>
                </div>
                
                <div class="termin-card">
                    <h3>Vereinsgrillen</h3>
                    <div class="termin-datum">Samstag, 22. Juni 2024, 15:00 Uhr</div>
                    <div class="termin-ort">Haus am See (Seestraße 45)</div>
                    <p>Gemütliches Sommergrillen mit den Mitgliedern. Jeder bringt etwas mit. Hunde sind natürlich willkommen!</p>
                </div>
                
                <div class="termin-card">
                    <h3>Agility-Training</h3>
                    <div class="termin-datum">Sonntag, 30. Juni 2024, 14:00 Uhr</div>
                    <div class="termin-ort">Agility-Park „Hundesport Arena"</div>
                    <p>Fortgeschrittenen-Training für Agility-Begeisterte. Bitte nur mit Voranmeldung. Auch für Zuschauer offen.</p>
                </div>
            </div>
        </section>
        
        <section id="kontakt">
            <h2>Kontakt & Ansprechpartner</h2>
            <div class="kontakt-info">
                <div class="kontakt-item">
                    <div class="kontakt-icon">📧</div>
                    <div class="kontakt-text">
                        <h3>E-Mail</h3>
                        <p>info@hundeverein-treue-freunde.de</p>
                        <p>Für allgemeine Anfragen und Mitgliedschaft</p>
                    </div>
                </div>
                
                <div class="kontakt-item">
                    <div class="kontakt-icon">📱</div>
                    <div class="kontakt-text">
                        <h3>Telefon</h3>
                        <p>+49 (0)123 456789</p>
                        <p>Mo-Fr 10-16 Uhr, Ansprechpartner: Lisa Müller</p>
                    </div>
                </div>
                
                <div class="kontakt-item">
                    <div class="kontakt-icon">🏠</div>
                    <div class="kontakt-text">
                        <h3>Vereinsheim</h3>
                        <p>Hundeverein „Treue Freunde" e.V.<br>
                        Musterstraße 123<br>
                        12345 Musterstadt</p>
                    </div>
                </div>
                
                <div class="kontakt-item">
                    <div class="kontakt-icon">⏰</div>
                    <div class="kontakt-text">
                        <h3>Sprechzeiten</h3>
                        <p>Donnerstags 18-20 Uhr im Vereinsheim<br>
                        Oder nach Vereinbarung</p>
                    </div>
                </div>
            </div>
        </section>
        
        <section id="ueber">
            <h2>Über unseren Verein</h2>
            <p>Unser Hundeverein wurde 1995 gegründet und hat heute über 150 Mitglieder. Wir setzen uns für artgerechte Haltung, verantwortungsvolle Erziehung und das soziale Miteinander von Hunden und Menschen ein. Neben regelmäßigen Treffen bieten wir Kurse, Workshops und gemeinsame Aktivitäten an.</p>
            <p>Unser Ziel: Eine Gemeinschaft, in der sich sowohl Mensch als auch Hund wohlfühlen und voneinander lernen können.</p>
        </section>
    </main>
    
    <footer>
        <div class="container">
            <p>© 2024 Hundeverein „Treue Freunde" e.V. – Alle Rechte vorbehalten</p>
            <p>Made with ❤️ for our four-legged friends</p>
        </div>
    </footer>
</body>
</html>
```

Die Seite ist fertig – sie enthält:
- Eine moderne Startseite mit Willkommensbereich
- Termin-Sektion mit den nächsten Veranstaltungen als Karten
- Kontakt-Sektion mit E-Mail, Telefon, Adresse und Sprechzeiten
- Zusätzlich eine "Über uns"-Sektion und Navigation

Übernimm den Code mit "An Code senden", dann im Code-Bereich auf "Sichern" und "Veröffentlichen" – danach ist die Hundevereins-Seite unter deiner Projekt-URL live.