<p align="center"><img src="media/markweave-logo.png" alt="MarkWeave" width="104"></p>

<h1 align="center">MarkWeave</h1>

<p align="center"><strong>Ein Local-First-Markdown-Editor für VS Code.</strong><br>
Klicken Sie auf einen beliebigen Block, um ihn direkt zu bearbeiten – reine <code>.md</code>-Dateien bleiben die einzige Wahrheitsquelle.</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.fr.md">Français</a> ·
  <strong>Deutsch</strong> ·
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="https://github.com/singerawei/markweave/releases"><img src="https://img.shields.io/github/v/release/singerawei/markweave?include_prereleases&label=release&style=flat-square" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20x64-0078D6?style=flat-square" alt="Windows x64">
  <img src="https://img.shields.io/badge/VS%20Code-1.100%2B-007ACC?style=flat-square" alt="VS Code 1.100+">
  <img src="https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square" alt="MIT">
</p>

<p align="center"><img src="media/markweave-hero.png" alt="MarkWeave bearbeitet ein Markdown-Dokument mit Tabelle und farbig hervorgehobenem Codeblock" width="100%"></p>

MarkWeave verwandelt gewöhnliche `.md`-Dateien in ein Dokument, das sich in VS Code per Klick bearbeiten lässt. Ihre Dateien bleiben die einzige Wahrheitsquelle: Beim Speichern wird Markdown immer in die Datei zurückgeschrieben, der der Inhalt gehört. Git, Ihr Texteditor und alle anderen Markdown-Werkzeuge funktionieren also weiterhin.

Es ist für Dokumente gedacht, die wachsen. Fassen Sie mehrere Dateien mit `@import` zu einem durchgehenden Dokument zusammen, bearbeiten Sie eingebundene Abschnitte direkt und speichern Sie nur die Dateien, die sich tatsächlich geändert haben. Kein Konto, keine Datenbank, keine Telemetrie und kein Browser erforderlich.

> **Vorschau:** 2.1.1 ist eine Vorschau für Windows x64. Installation über [GitHub Releases](https://github.com/singerawei/markweave/releases).

## Was es anders macht

- **Markdown rein, Markdown raus.** Kein proprietäres Format, keine versteckte Datenbank. Gerendertes Dokument und Quelldatei bleiben synchron.
- **Bearbeitbare Includes.** Importieren Sie viele Dateien in eine Ansicht; Änderungen gehen an die richtige Quelldatei zurück, auch bei verschachtelten und wiederholten Imports.
- **Gerendert statt ersetzt.** Komplexe Blöcke bleiben beim Bearbeiten gerendert; sie werden nie zu reinen Textfeldern.
- **Local-First.** Keine Telemetrie, kein Login. Der einzige Netzwerkverkehr stammt von entfernten Bildern in Ihrem Dokument.
- **Komfortabel auch bei Größe.** Große Dokumente werden gestreamt und in der Nähe des sichtbaren Bereichs gerendert; übergroße Blöcke fallen auf den nativen Editor zurück.

## Funktionen

- **Bearbeiten per Klick** — klicken Sie auf Absätze, Überschriften, Listen, Tabellen, Aufgabenlisten, Zitate, Codeblöcke oder Links und bearbeiten Sie sie direkt.
- **Reichhaltiges Markdown** — GFM-Tabellen, Aufgabenlisten, Mathematik, Fußnoten, Alerts und Callouts, Admonitions, Definitionslisten, TOC, Wiki-Links, Hervorhebungen, Tief-/Hochstellung, Emoji, Frontmatter und eine sichere HTML-Teilmenge.
- **Navigation** — Find und Outline teilen sich ein Panel, folgen Ihrer Scrollposition und lassen sich pro Dokument anheften.
- **Mermaid-Diagramme** — lokal gerendert und zwischengespeichert; kopieren, bearbeiten, zoomen oder als SVG/PNG exportieren.
- **PDF-Export** — Papierformat, Ränder, Schriftgröße, Kopf- und Fußzeilen, Seitenzahlen und Seitenumbrüche bei H1 wählbar. Ungespeicherte Änderungen werden einbezogen.
- **Theme-bewusstes Lesen** — folgt den hellen, dunklen und kontrastreichen VS Code-Themes.
- **Tastaturfreundlich** — jede häufige Aktion ist ein VS Code-Befehl und lässt sich neu belegen.
- **Für lange Dokumente geeignet** — progressives Laden, Viewport-Rendering und Entladen weit entfernter Inhalte halten große Dateien flüssig.

## Installation

**Voraussetzungen:** Windows x64 und VS Code 1.100 oder neuer. Chrome oder Edge müssen nicht separat installiert werden.

1. Laden Sie `markweave-win32-x64-2.1.1.vsix` von [GitHub Releases](https://github.com/singerawei/markweave/releases) herunter.
2. Öffnen Sie in VS Code **Erweiterungen**, klicken Sie auf **… → Aus VSIX installieren…** und wählen Sie die Datei.
3. Laden Sie VS Code neu.
4. Klicken Sie mit der rechten Maustaste auf eine `.md`-Datei und wählen Sie **Öffnen mit… → Modular Markdown Editor**.

Die VSIX ist etwa 125 MB groß, da sie die Chromium-Engine für Mermaid-Rendering und PDF-Export enthält.

<details>
<summary>Aus dem Quellcode bauen</summary>

```sh
git clone https://github.com/singerawei/markweave.git
cd markweave
npm ci
npx playwright install chromium-headless-shell
npm run package
```

Erfordert Node.js 20.19+ (22 empfohlen). Die erzeugte VSIX ist sofort installierbar.
</details>

## Schnellstart

1. **Öffnen** Sie eine `.md`-Datei mit **Öffnen mit… → Modular Markdown Editor**.
2. **Bearbeiten** Sie per Klick auf einen Block. `Ctrl/Cmd+S` speichert, `Ctrl/Cmd+Shift+S` speichert unter einem anderen Namen.
3. **Kombinieren** Sie mehrere Dateien in einer Ansicht:

   ```markdown
   # Systementwurf

   @import "./product/overview.md"
   @import "./architecture/system.md"
   @import "./features/payment.md"
   ```

   Bearbeiten Sie die gerenderten Abschnitte direkt; beim Speichern werden nur die geänderten Quelldateien geschrieben.
4. **Navigieren** Sie mit `Ctrl/Cmd+Shift+O`, fügen Sie Blöcke mit `Ctrl/Cmd+Alt+I` ein und exportieren Sie mit **More → Export PDF**.

## Markdown-Unterstützung

| Syntax | Bearbeitung |
| --- | --- |
| CommonMark-Überschriften, Absätze, Hervorhebungen, Code, Zitate, Listen, Trennlinien | ✅ Direkt |
| GFM-Tabellen, Ausrichtung, Aufgabenlisten, Durchstreichen, Autolinks | ✅ Direkt |
| Hervorhebung `==Text==`, Tief-/Hochstellung, Emoji | ✅ Direkt |
| Sicheres HTML (`kbd`, `mark`, `details`, `sub`, `sup`, …) | ✅ Gerendertes contenteditable, bereinigt |
| Mathematik `$...$`, `$$...$$` | ✅ KaTeX, Blockeditor mit Live-Vorschau |
| Fußnoten, Referenzlinks, Definitionslisten, Abkürzungen | ✅ Gerendert, Blockeditor mit Live-Vorschau |
| GitHub Alerts, Obsidian Callouts, Admonitions | ✅ Gerendert, eigene Titel, einklappbar |
| TOC, Wiki-Links, Obsidian-Kommentare, Frontmatter | ✅ Gerendert |
| Mermaid | ✅ Lokal gerendert |
| Entfernte Bilder | ✅ Beim Öffnen geladen; für PDF heruntergeladen |

Nicht unterstützte Syntax bleibt erhalten und wird nicht eingeebnet.

## Tastenkürzel

| Aktion | Windows / Linux | macOS |
| --- | --- | --- |
| Speichern / Speichern unter | `Ctrl+S` / `Ctrl+Shift+S` | `Cmd+S` / `Cmd+Shift+S` |
| Suchen | `Ctrl+F` | `Cmd+F` |
| Gliederung / Navigieren | `Ctrl+Shift+O` | `Cmd+Shift+O` |
| Einfügen | `Ctrl+Alt+I` | `Cmd+Alt+I` |
| Fokusmodus | `Ctrl+Alt+F` | `Cmd+Alt+F` |
| Symbolleiste ein-/ausblenden | `Ctrl+Alt+T` | `Cmd+Alt+T` |
| Hilfe | `?` oder `Ctrl+Alt+H` | `?` oder `Cmd+Alt+H` |

Alle Tastenkürzel sind VS Code-Befehle und können neu belegt werden. Die vollständige Liste und Host-Konflikte finden Sie in [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md).

## Gut zu wissen

- Nur lokale `.md`-Dateien. Entfernte oder virtuelle Dateisysteme, Cloud-Synchronisierung und Konten werden nicht unterstützt.
- **Speichern unter** muss im selben Ordner bleiben, damit relative Includes weiter funktionieren.
- Übergroße Blöcke fallen auf den Texteditor zurück: Code über 128 KiB, Fließtext über 16 KiB oder Tabellen über 200 Zeilen.
- Wiki-Einbettungen (`![[Page]]`) öffnen sich als anklickbare Karten, nicht als vollständige Transklusionen.
- Die Vorschau 2.1.1 ist für Windows x64. Das Gate für die stabile Version sammelt noch Nachweise aus realer Nutzung, IME, langem Scrollen und Installation.

## Entwicklung

```sh
npm ci
npm run check        # Lint, Typprüfung, Core-Tests, Build
npx playwright install chromium
npm run test:ui      # UI-Tests
npm run test:host    # Tests im echten VS Code-Host
npm run package      # VSIX bauen
```

Der Beitragsablauf steht in [CONTRIBUTING.md](CONTRIBUTING.md).

## Lizenz

MIT. Lizenzen für Drittanbieter-Abhängigkeiten und Chromium sind in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) aufgeführt.
