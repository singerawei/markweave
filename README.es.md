<p align="center"><img src="media/markweave-logo.png" alt="MarkWeave" width="104"></p>

<h1 align="center">MarkWeave</h1>

<p align="center"><strong>Un editor Markdown local-first para VS Code.</strong><br>
Haz clic en cualquier bloque para editarlo en el sitio y conserva tus archivos <code>.md</code> como única fuente de verdad.</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <strong>Español</strong> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.ru.md">Русский</a>
</p>

<p align="center">
  <a href="https://github.com/singerawei/markweave/releases"><img src="https://img.shields.io/github/v/release/singerawei/markweave?include_prereleases&label=release&style=flat-square" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20x64-0078D6?style=flat-square" alt="Windows x64">
  <img src="https://img.shields.io/badge/VS%20Code-1.100%2B-007ACC?style=flat-square" alt="VS Code 1.100+">
  <img src="https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square" alt="MIT">
</p>

<p align="center"><img src="media/markweave-hero.png" alt="MarkWeave editando un documento Markdown con una tabla y un bloque de código resaltado" width="100%"></p>

MarkWeave convierte archivos `.md` normales en un documento editable con un clic dentro de VS Code. Tus archivos siguen siendo la única fuente de verdad: cada guardado escribe Markdown de vuelta al archivo que posee el contenido, así que Git, tu editor de texto y cualquier otra herramienta de Markdown siguen funcionando.

Está pensado para documentos que crecen. Combina varios archivos en un único documento continuo con `@import`, edita cualquier sección incluida en el sitio y guarda solo los archivos que realmente cambiaron. Sin cuenta, sin base de datos, sin telemetría y sin navegador.

> **Vista previa:** 2.1.0 es una vista previa para Windows x64. Instálala desde [GitHub Releases](https://github.com/singerawei/markweave/releases).

## Qué lo hace diferente

- **Entra Markdown, sale Markdown.** Sin formato propietario ni base de datos oculta. El documento renderizado y el archivo fuente se mantienen sincronizados.
- **Includes editables.** Importa muchos archivos en una sola vista; las ediciones vuelven al archivo fuente correcto, incluidas las importaciones anidadas y repetidas.
- **Renderizado, no reemplazado.** Los bloques complejos siguen renderizados mientras los editas; nunca se convierten en áreas de texto sin formato.
- **Local-first.** Sin telemetría ni inicio de sesión. El único tráfico de red proviene de las imágenes remotas de tu documento.
- **Cómodo a escala.** Los documentos grandes se cargan de forma progresiva y se renderizan cerca de la ventana visible, con un editor nativo como respaldo para bloques demasiado grandes.

## Funciones

- **Edición con un clic** — haz clic en cualquier párrafo, encabezado, lista, tabla, lista de tareas, cita, bloque de código o enlace y edítalo en el sitio.
- **Markdown completo** — tablas GFM, listas de tareas, matemáticas, notas al pie, alertas y callouts, admoniciones, listas de definición, TOC, enlaces wiki, resaltados, subíndice/superíndice, emoji, frontmatter y un subconjunto seguro de HTML.
- **Navegación** — Find y Outline comparten un panel, siguen tu desplazamiento y se pueden fijar por documento.
- **Diagramas Mermaid** — renderizados y almacenados en caché localmente; copia, edita, amplía o exporta a SVG/PNG.
- **Exportación a PDF** — elige tamaño de papel, márgenes, tamaño de fuente, encabezados, pies de página, números de página y saltos de página en H1. Incluye los cambios sin guardar.
- **Lectura adaptada al tema** — sigue los temas claro, oscuro y de alto contraste de VS Code.
- **Pensado para el teclado** — cada acción habitual es un comando de VS Code y se puede reasignar.
- **Amigable con documentos largos** — la carga progresiva, el renderizado por viewport y la descarga del contenido lejano mantienen ágiles los archivos grandes.

## Instalación

**Requisitos:** Windows x64 y VS Code 1.100 o superior. No hace falta instalar Chrome ni Edge por separado.

1. Descarga `markweave-win32-x64-2.1.0.vsix` desde [GitHub Releases](https://github.com/singerawei/markweave/releases).
2. En VS Code, abre **Extensiones**, pulsa **… → Instalar desde VSIX…** y selecciona el archivo.
3. Recarga VS Code.
4. Haz clic derecho en cualquier archivo `.md` y elige **Abrir con… → Modular Markdown Editor**.

El VSIX pesa unos 125 MB porque incluye el motor Chromium que se usa para renderizar Mermaid y exportar PDF.

<details>
<summary>Compilar desde el código fuente</summary>

```sh
git clone https://github.com/singerawei/markweave.git
cd markweave
npm ci
npx playwright install chromium-headless-shell
npm run package
```

Requiere Node.js 20.19+ (se recomienda 22). El VSIX generado está listo para instalar.
</details>

## Inicio rápido

1. **Abre** un archivo `.md` con **Abrir con… → Modular Markdown Editor**.
2. **Edita** haciendo clic en cualquier bloque. Pulsa `Ctrl/Cmd+S` para guardar o `Ctrl/Cmd+Shift+S` para guardar como.
3. **Combina** varios archivos en una sola vista:

   ```markdown
   # Diseño del sistema

   @import "./product/overview.md"
   @import "./architecture/system.md"
   @import "./features/payment.md"
   ```

   Edita las secciones renderizadas directamente; al guardar solo se escriben los archivos fuente modificados.
4. **Navega** con `Ctrl/Cmd+Shift+O`, inserta bloques con `Ctrl/Cmd+Alt+I` y exporta con **More → Export PDF**.

## Compatibilidad con Markdown

| Sintaxis | Edición |
| --- | --- |
| Encabezados, párrafos, énfasis, código, citas, listas y separadores de CommonMark | ✅ En el sitio |
| Tablas GFM, alineación, listas de tareas, tachado y enlaces automáticos | ✅ En el sitio |
| Resaltado `==texto==`, subíndice, superíndice y emoji | ✅ En el sitio |
| HTML seguro (`kbd`, `mark`, `details`, `sub`, `sup`, …) | ✅ Contenteditable renderizado y saneado |
| Matemáticas `$...$`, `$$...$$` | ✅ KaTeX, editor de bloque con vista previa |
| Notas al pie, enlaces de referencia, listas de definición y abreviaturas | ✅ Renderizado, editor de bloque con vista previa |
| GitHub Alerts, Obsidian Callouts y admoniciones | ✅ Renderizado, títulos personalizados y plegables |
| TOC, enlaces wiki, comentarios de Obsidian y frontmatter | ✅ Renderizado |
| Mermaid | ✅ Renderizado localmente |
| Imágenes remotas | ✅ Se cargan al abrir; se descargan para PDF |

La sintaxis no compatible se conserva en lugar de aplanarse.

## Atajos de teclado

| Acción | Windows / Linux | macOS |
| --- | --- | --- |
| Guardar / Guardar como | `Ctrl+S` / `Ctrl+Shift+S` | `Cmd+S` / `Cmd+Shift+S` |
| Buscar | `Ctrl+F` | `Cmd+F` |
| Esquema / Navegar | `Ctrl+Shift+O` | `Cmd+Shift+O` |
| Insertar | `Ctrl+Alt+I` | `Cmd+Alt+I` |
| Modo de concentración | `Ctrl+Alt+F` | `Cmd+Alt+F` |
| Ocultar la barra de herramientas | `Ctrl+Alt+T` | `Cmd+Alt+T` |
| Ayuda | `?` o `Ctrl+Alt+H` | `?` o `Cmd+Alt+H` |

Todos los atajos son comandos de VS Code y se pueden reasignar. Consulta [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md) para ver la lista completa y los conflictos con el host.

## Conviene saber

- Solo se admiten archivos `.md` locales. Los sistemas de archivos remotos o virtuales, la sincronización en la nube y las cuentas quedan fuera del alcance.
- **Guardar como** debe permanecer en la misma carpeta para que los includes relativos sigan funcionando.
- Los bloques demasiado grandes vuelven al editor de texto: código de más de 128 KiB, prosa de más de 16 KiB o tablas de más de 200 filas.
- Las incrustaciones wiki (`![[Page]]`) se abren como tarjetas en las que se puede hacer clic, no como transclusiones completas.
- La vista previa 2.1.0 es para Windows x64. La compuerta de la versión estable todavía está recopilando evidencias de uso real, IME, desplazamiento prolongado e instalación.

## Desarrollo

```sh
npm ci
npm run check        # lint, comprobación de tipos, pruebas core y compilación
npx playwright install chromium
npm run test:ui      # pruebas de UI
npm run test:host    # pruebas en un host real de VS Code
npm run package      # compila el VSIX
```

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) para el flujo de contribución.

## Licencia

MIT. Las licencias de las dependencias de terceros y de Chromium están en [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
