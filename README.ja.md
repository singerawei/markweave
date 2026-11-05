<p align="center"><img src="media/markweave-logo.png" alt="MarkWeave" width="104"></p>

<h1 align="center">MarkWeave</h1>

<p align="center"><strong>VS Code のためのローカルファースト Markdown エディター。</strong><br>
ブロックをクリックするだけでその場で編集。プレーンな <code>.md</code> ファイルが常に唯一の情報源です。</p>

<p align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <strong>日本語</strong> ·
  <a href="README.ko.md">한국어</a> ·
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

<p align="center"><img src="media/markweave-hero.png" alt="表とシンタックスハイライト付きコードブロックを含む Markdown 文書を編集する MarkWeave" width="100%"></p>

MarkWeave は、普通の `.md` ファイルを VS Code 内でクリックして編集できる文書に変えます。ファイルが唯一の情報源であり続け、保存のたびに Markdown がその内容を所有するファイルへ書き戻されます。Git、テキストエディター、その他の Markdown ツールをそのまま使い続けられます。

大きくなる文書のために作られています。`@import` で複数のファイルを 1 つの連続した文書にまとめ、読み込まれたセクションをその場で編集し、実際に変更されたソースファイルだけを保存します。アカウント、データベース、テレメトリー、ブラウザーは不要です。

> **プレビュー版：** 2.1.1 は Windows x64 向けのプレビューです。[GitHub Releases](https://github.com/singerawei/markweave/releases) からインストールしてください。

## 選ばれる理由

- **Markdown イン、Markdown アウト。** 独自形式や隠れたデータベースはありません。レンダリング結果とソースファイルは常に同期します。
- **編集できるインクルード。** 複数ファイルを 1 つのビューに読み込み、編集内容は正しいソースファイルへ書き戻されます。ネストや重複した読み込みにも対応します。
- **置き換えずにレンダリング。** 複雑なブロックは編集中もレンダリングされたまま表示され、生のテキストエリアに変わりません。
- **ローカルファースト。** テレメトリーもログインもありません。ネットワーク通信は文書内のリモート画像のみです。
- **大きな文書でも快適。** 大きな文書は段階的に読み込まれ、ビューポート付近だけがレンダリングされます。巨大なブロックは標準エディターにフォールバックします。

## 機能

- **クリックで編集** — 段落、見出し、リスト、表、タスクリスト、引用、コードブロック、リンクをその場で編集できます。
- **豊富な Markdown** — GFM の表、タスクリスト、数式、脚注、Alerts/Callouts、Admonitions、定義リスト、TOC、Wiki リンク、ハイライト、上付き/下付き、絵文字、Frontmatter、安全な HTML のサブセット。
- **ナビゲーション** — Find と Outline は 1 つのパネルを共有し、スクロールに追従します。文書ごとに固定できます。
- **Mermaid 図** — ローカルでレンダリングしてキャッシュします。コピー、編集、ズーム、SVG/PNG への書き出しが可能です。
- **PDF 書き出し** — 用紙サイズ、余白、文字サイズ、ヘッダー/フッター、ページ番号、H1 改ページを設定できます。未保存の編集内容も含まれます。
- **テーマに追従** — VS Code のライト、ダーク、ハイコントラストテーマに合わせます。
- **キーボード中心** — よく使う操作はすべて VS Code のコマンドで、キーボードショートカットで変更できます。
- **長い文書に強い** — 段階的な読み込み、ビューポート単位のレンダリング、遠くのコンテンツの破棄により、大きなファイルでも快適に操作できます。

## インストール

**要件：** Windows x64、VS Code 1.100 以降。Chrome や Edge を別途インストールする必要はありません。

1. [GitHub Releases](https://github.com/singerawei/markweave/releases) から `markweave-win32-x64-2.1.1.vsix` をダウンロードします。
2. VS Code で **拡張機能** を開き、**… → VSIX からインストール…** をクリックしてファイルを選択します。
3. VS Code を再読み込みします。
4. `.md` ファイルを右クリックし、**アプリケーションから開く… → Modular Markdown Editor** を選択します。

VSIX は約 125 MB です。Mermaid のレンダリングと PDF 書き出しに使う Chromium エンジンを同梱しているためです。

<details>
<summary>ソースからビルド</summary>

```sh
git clone https://github.com/singerawei/markweave.git
cd markweave
npm ci
npx playwright install chromium-headless-shell
npm run package
```

Node.js 20.19+（22 推奨）が必要です。生成された VSIX はそのままインストールできます。
</details>

## クイックスタート

1. **アプリケーションから開く… → Modular Markdown Editor** で `.md` ファイルを開きます。
2. 任意のブロックをクリックして編集します。`Ctrl/Cmd+S` で保存、`Ctrl/Cmd+Shift+S` で名前を付けて保存します。
3. 複数のファイルを 1 つの文書にまとめます。

   ```markdown
   # システム設計

   @import "./product/overview.md"
   @import "./architecture/system.md"
   @import "./features/payment.md"
   ```

   レンダリングされたセクションを直接編集します。保存時に書き戻されるのは、変更されたソースファイルだけです。
4. `Ctrl/Cmd+Shift+O` でナビゲートし、`Ctrl/Cmd+Alt+I` でブロックを挿入、**More → Export PDF** で書き出します。

## Markdown サポート

| 構文 | 編集方法 |
| --- | --- |
| CommonMark の見出し、段落、強調、コード、引用、リスト、区切り線 | ✅ その場で編集 |
| GFM の表、配置、タスクリスト、取り消し線、自動リンク | ✅ その場で編集 |
| ハイライト `==テキスト==`、上付き/下付き、絵文字 | ✅ その場で編集 |
| 安全な HTML（`kbd`、`mark`、`details`、`sub`、`sup` など） | ✅ レンダリングされた contenteditable、サニタイズ済み |
| 数式 `$...$`、`$$...$$` | ✅ KaTeX、ライブプレビュー付きブロックエディター |
| 脚注、参照リンク、定義リスト、略語 | ✅ リッチ表示、ライブプレビュー付きブロックエディター |
| GitHub Alerts、Obsidian Callouts、Admonitions | ✅ リッチ表示、カスタムタイトル、折りたたみ対応 |
| TOC、Wiki リンク、Obsidian コメント、Frontmatter | ✅ リッチ表示 |
| Mermaid | ✅ ローカルでレンダリング |
| リモート画像 | ✅ 開いたときに読み込み、PDF 書き出し時にダウンロード |

サポートされていない構文は、平坦化されずにそのまま保持されます。

## キーボードショートカット

| 操作 | Windows / Linux | macOS |
| --- | --- | --- |
| 保存 / 名前を付けて保存 | `Ctrl+S` / `Ctrl+Shift+S` | `Cmd+S` / `Cmd+Shift+S` |
| 検索 | `Ctrl+F` | `Cmd+F` |
| アウトライン / ナビゲート | `Ctrl+Shift+O` | `Cmd+Shift+O` |
| 挿入 | `Ctrl+Alt+I` | `Cmd+Alt+I` |
| フォーカスモード | `Ctrl+Alt+F` | `Cmd+Alt+F` |
| ツールバーの表示切替 | `Ctrl+Alt+T` | `Cmd+Alt+T` |
| ヘルプ | `?` または `Ctrl+Alt+H` | `?` または `Cmd+Alt+H` |

すべてのショートカットは VS Code のコマンドで、変更できます。完全な一覧とホスト側の競合については [docs/KEYBINDINGS.md](docs/KEYBINDINGS.md) を参照してください。

## 補足

- ローカルの `.md` ファイルのみを対象とします。リモート/仮想ファイルシステム、クラウド同期、アカウント機能は対象外です。
- **名前を付けて保存** は、相対インクルードを維持するため同じフォルダー内に保存する必要があります。
- 編集上限を超えたブロックはテキストエディターにフォールバックします：コード 128 KiB、本文 16 KiB、表 200 行。
- Wiki 埋め込み（`![[Page]]`）はクリック可能なカードとして開き、全文のトランスクルージョンにはなりません。
- 2.1.1 プレビューは Windows x64 向けです。安定版のリリースゲートは、実利用、IME、長いスクロール、インストールの証拠をまだ収集中です。

## 開発

```sh
npm ci
npm run check        # lint、型チェック、コアテスト、ビルド
npx playwright install chromium
npm run test:ui      # UI テスト
npm run test:host    # 実際の VS Code ホストテスト
npm run package      # VSIX をビルド
```

コントリビューションの手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

MIT。サードパーティ依存関係と Chromium のライセンスは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) に記載されています。
