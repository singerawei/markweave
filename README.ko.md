<p align="center"><img src="media/markweave-logo.png" alt="MarkWeave" width="104"></p>

<h1 align="center">MarkWeave</h1>

<p align="center"><strong>VS Code를 위한 로컬 우선 Markdown 편집기.</strong><br>
블록을 클릭해 바로 편집하고, 순수 <code>.md</code> 파일은 항상 유일한 원본으로 유지됩니다.</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <strong>한국어</strong> ·
  <a href="README.es.md">Español</a> ·
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

<p align="center"><img src="media/markweave-hero.png" alt="표와 구문 강조 코드 블록이 있는 Markdown 문서를 편집하는 MarkWeave" width="100%"></p>

MarkWeave는 평범한 `.md` 파일을 VS Code 안에서 클릭해 편집할 수 있는 문서로 바꿔 줍니다. 파일이 유일한 원본으로 남으며, 저장할 때마다 Markdown이 해당 내용을 소유한 파일로 기록됩니다. 따라서 Git, 텍스트 편집기 및 다른 모든 Markdown 도구를 계속 사용할 수 있습니다.

커지는 문서를 위해 설계되었습니다. `@import`로 여러 파일을 하나의 연속된 문서로 구성하고, 가져온 섹션을 바로 편집하며, 실제로 변경된 소스 파일만 저장합니다. 계정, 데이터베이스, 텔레메트리, 브라우저가 필요 없습니다.

> **미리보기:** 2.1.1은 Windows x64 미리보기입니다. [GitHub Releases](https://github.com/singerawei/markweave/releases)에서 설치하세요.

## 차별점

- **Markdown 입력, Markdown 출력.** 독자 형식이나 숨겨진 데이터베이스가 없습니다. 렌더링된 문서와 소스 파일은 항상 동기화됩니다.
- **편집 가능한 Include.** 여러 파일을 하나의 보기로 가져오고, 편집 내용은 올바른 소스 파일로 기록됩니다. 중첩되거나 반복된 가져오기도 지원합니다.
- **원문으로 되돌리지 않고 렌더링 유지.** 복잡한 블록은 편집하는 동안에도 렌더링된 상태로 유지되며, 원시 텍스트 영역으로 바뀌지 않습니다.
- **로컬 우선.** 텔레메트리도 로그인도 없습니다. 네트워크 통신은 문서의 원격 이미지에서만 발생합니다.
- **대용량 문서도 쾌적하게.** 큰 문서는 단계적으로 불러오고 뷰포트 근처만 렌더링하며, 너무 큰 블록은 기본 편집기로 대체합니다.

## 기능

- **클릭하여 편집** — 문단, 제목, 목록, 표, 작업 목록, 인용, 코드 블록, 링크를 그 자리에서 편집할 수 있습니다.
- **풍부한 Markdown** — GFM 표, 작업 목록, 수식, 각주, Alerts/Callouts, Admonitions, 정의 목록, TOC, Wiki 링크, 하이라이트, 위/아래 첨자, 이모지, Frontmatter, 안전한 HTML 하위 집합.
- **탐색** — Find와 Outline이 하나의 패널을 공유하고 스크롤 위치를 따라갑니다. 문서별로 고정할 수 있습니다.
- **Mermaid 다이어그램** — 로컬에서 렌더링하고 캐시합니다. 복사, 편집, 확대/축소, SVG/PNG 내보내기를 지원합니다.
- **PDF 내보내기** — 용지 크기, 여백, 글꼴 크기, 머리말/꼬리말, 페이지 번호, H1 페이지 나눔을 설정할 수 있습니다. 저장하지 않은 편집 내용도 포함됩니다.
- **테마 연동** — VS Code의 라이트, 다크, 고대비 테마를 따릅니다.
- **키보드 중심** — 주요 작업이 모두 VS Code 명령이며 키보드 단축키에서 다시 지정할 수 있습니다.
- **긴 문서에 강함** — 점진적 로딩, 뷰포트 렌더링, 멀리 있는 콘텐츠 해제로 큰 파일도 부드럽게 유지합니다.

## 설치

**요구 사항:** Windows x64, VS Code 1.100 이상. Chrome이나 Edge를 따로 설치할 필요가 없습니다.

1. [GitHub Releases](https://github.com/singerawei/markweave/releases)에서 `markweave-win32-x64-2.1.1.vsix`를 다운로드합니다.
2. VS Code에서 **확장**을 열고 **… → VSIX에서 설치…**를 클릭한 뒤 파일을 선택합니다.
3. VS Code를 다시 로드합니다.
4. `.md` 파일을 마우스 오른쪽 버튼으로 클릭하고 **다음으로 열기… → Modular Markdown Editor**를 선택합니다.

VSIX는 약 125MB입니다. Mermaid 렌더링과 PDF 내보내기에 사용하는 Chromium 엔진을 함께 포함하기 때문입니다.

<details>
<summary>소스에서 빌드</summary>

```sh
git clone https://github.com/singerawei/markweave.git
cd markweave
npm ci
npx playwright install chromium-headless-shell
npm run package
```

Node.js 20.19+(22 권장)가 필요합니다. 생성된 VSIX는 바로 설치할 수 있습니다.
</details>

## 빠른 시작

1. **다음으로 열기… → Modular Markdown Editor**로 `.md` 파일을 엽니다.
2. 아무 블록이나 클릭해 편집합니다. `Ctrl/Cmd+S`로 저장하고 `Ctrl/Cmd+Shift+S`로 다른 이름으로 저장합니다.
3. 여러 파일을 하나의 문서로 구성합니다.

   ```markdown
   # 시스템 설계

   @import "./product/overview.md"
   @import "./architecture/system.md"
   @import "./features/payment.md"
   ```

   렌더링된 섹션을 직접 편집하세요. 저장할 때는 변경된 소스 파일만 기록됩니다.
4. `Ctrl/Cmd+Shift+O`로 탐색하고, `Ctrl/Cmd+Alt+I`로 블록을 삽입하며, **More → Export PDF**로 내보냅니다.

## Markdown 지원

| 구문 | 편집 방식 |
| --- | --- |
| CommonMark 제목, 문단, 강조, 코드, 인용, 목록, 구분선 | ✅ 그 자리에서 편집 |
| GFM 표, 정렬, 작업 목록, 취소선, 자동 링크 | ✅ 그 자리에서 편집 |
| 하이라이트 `==텍스트==`, 위/아래 첨자, 이모지 | ✅ 그 자리에서 편집 |
| 안전한 HTML(`kbd`, `mark`, `details`, `sub`, `sup` 등) | ✅ 렌더링된 contenteditable, 정화됨 |
| 수식 `$...$`, `$$...$$` | ✅ KaTeX, 실시간 미리보기 블록 편집기 |
| 각주, 참조 링크, 정의 목록, 약어 | ✅ 리치 렌더링, 실시간 미리보기 블록 편집기 |
| GitHub Alerts, Obsidian Callouts, Admonitions | ✅ 리치 렌더링, 사용자 지정 제목, 접기 지원 |
| TOC, Wiki 링크, Obsidian 주석, Frontmatter | ✅ 리치 렌더링 |
| Mermaid | ✅ 로컬 렌더링 |
| 원격 이미지 | ✅ 열 때 로드, PDF 내보내기 시 다운로드 |

지원하지 않는 구문은 평탄화되지 않고 그대로 보존됩니다.

## 키보드 단축키

| 작업 | Windows / Linux | macOS |
| --- | --- | --- |
| 저장 / 다른 이름으로 저장 | `Ctrl+S` / `Ctrl+Shift+S` | `Cmd+S` / `Cmd+Shift+S` |
| 찾기 | `Ctrl+F` | `Cmd+F` |
| 개요 / 탐색 | `Ctrl+Shift+O` | `Cmd+Shift+O` |
| 삽입 | `Ctrl+Alt+I` | `Cmd+Alt+I` |
| 집중 모드 | `Ctrl+Alt+F` | `Cmd+Alt+F` |
| 도구 모음 표시/숨기기 | `Ctrl+Alt+T` | `Cmd+Alt+T` |
| 도움말 | `?` 또는 `Ctrl+Alt+H` | `?` 또는 `Cmd+Alt+H` |

모든 단축키는 VS Code 명령이며 다시 지정할 수 있습니다. 전체 목록과 호스트 충돌은 [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md)를 참고하세요.

## 참고 사항

- 로컬 `.md` 파일만 지원합니다. 원격/가상 파일 시스템, 클라우드 동기화, 계정 기능은 범위에 포함되지 않습니다.
- **다른 이름으로 저장**은 상대 Include를 유지하기 위해 같은 폴더에 저장해야 합니다.
- 편집 한도를 넘는 블록은 텍스트 편집기로 대체됩니다: 코드 128 KiB, 본문 16 KiB, 표 200행.
- Wiki 임베드(`![[Page]]`)는 클릭 가능한 카드로 열리며 전체 내용을 포함하지 않습니다.
- 2.1.1 미리보기는 Windows x64용입니다. 안정 버전 릴리스 게이트는 실제 사용, IME, 긴 스크롤, 설치 증거를 아직 수집 중입니다.

## 개발

```sh
npm ci
npm run check        # lint, 타입 검사, 핵심 테스트, 빌드
npx playwright install chromium
npm run test:ui      # UI 테스트
npm run test:host    # 실제 VS Code 호스트 테스트
npm run package      # VSIX 빌드
```

기여 절차는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

## 라이선스

MIT. 타사 종속성 및 Chromium 라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있습니다.
