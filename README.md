# 同人音声プレイヤー / Doujin Audio Player

[![Release](https://img.shields.io/github/v/release/megamega39/doujin-player?label=download)](https://github.com/megamega39/doujin-player/releases/latest)
[![License](https://img.shields.io/github/license/megamega39/doujin-player)](LICENSE)
[![Build](https://img.shields.io/github/actions/workflow/status/megamega39/doujin-player/release.yml)](https://github.com/megamega39/doujin-player/actions)

ローカルの同人音声作品を管理・再生するデスクトップアプリケーションです。

## インストール

[Releases ページ](https://github.com/megamega39/doujin-player/releases/latest)から最新版のインストーラー（`.exe`）をダウンロードして実行してください。

アプリ内の設定ページからアップデートの確認・自動更新ができます。

## 特徴

- **ライブラリ管理** — フォルダをスキャンして作品を自動登録。サムネイル・音声バリエーション（SEあり/なし、形式別）を自動検出
- **高機能プレイヤー** — 区間ループ（A/B点設定・微調整・名前付き保存）、スリープタイマー、再生速度変更（0.5x〜3.0x）
- **動画再生対応** — MP4・WebM形式の動画ファイルも再生可能
- **整理機能** — タグ・声優・サークルによる分類、お気に入り（作品・トラック単位）、プレイリスト
- **横断検索** — 作品名・タグ・声優・サークル名をまとめて検索
- **一括タグ付け** — ライブラリで複数作品を選択してタグ・声優・サークルを一括登録
- **再生統計** — 再生回数の自動記録、よく聴くトラックTOP10、最近再生した作品の表示
- **再生位置の自動保存** — トラックの再生位置を自動保存し、途中から再開可能
- **カスタマイズ** — テーマカラー8色、ダーク/ライトモード、ショートカットキー設定
- **多言語対応** — 日本語・English・简体中文・繁體中文・한국어・Español・Português
- **メディアキー対応** — キーボード・イヤホンの再生/停止ボタンに対応
- **タスクバー操作** — タスクバーホバーで再生コントロール・アルバムアート表示（Windows）
- **システムトレイ** — 閉じる時にトレイに最小化するオプション（設定で切替可能）
- **ウィンドウ状態復元** — ウィンドウのサイズ・位置を記憶し、次回起動時に復元
- **自動アップデート** — 新しいバージョンをアプリ内から確認・インストール

## 使い方

1. **ライブラリ登録** — 設定画面から作品フォルダのルートを選択してスキャン
2. **作品を再生** — ライブラリから作品をクリック → トラックをクリックで再生開始
3. **区間ループ** — 再生パネルの「ループ区間」→ A/B点を設定 → ループON。名前を付けて保存も可能
4. **お気に入り** — 作品の♡で作品お気に入り、トラックの♡でトラックお気に入り
5. **プレイリスト** — サイドバーの「プレイリスト」から新規作成 → 作品詳細画面でトラックを追加
6. **スリープタイマー** — 再生パネルの時計アイコンから時間を選択（5分〜1時間）
7. **テーマ・言語変更** — 設定画面からテーマカラー・ダーク/ライトモード・言語を変更

### ショートカットキー

| キー | 操作 |
|---|---|
| `Space` | 再生 / 一時停止 |
| `J` / `L` | 10秒 戻る / 進む |
| `Shift+J` / `Shift+L` | 30秒 戻る / 進む |
| `Shift+←` / `Shift+→` | 5秒 戻る / 進む |
| `←` / `→` | 前のトラック / 次のトラック |
| `[` / `]` | A点設定 / B点設定 |
| `\` | 区間ループ ON/OFF |
| `M` | ミュート |
| `↑` / `↓` | 音量 アップ / ダウン |

ショートカットは設定画面からカスタマイズ可能です。

---

A desktop application for managing and playing local doujin audio works.

## Install

Download the latest installer (`.exe`) from the [Releases page](https://github.com/megamega39/doujin-player/releases/latest) and run it.

You can check for updates and install them from the settings page within the app.

## Features

- **Library Management** — Scan folders to automatically register works. Auto-detects thumbnails and audio variants (with/without SE, by format)
- **Advanced Player** — Segment loop (A/B point setting, fine-tuning, named save), sleep timer, playback speed control (0.5x–3.0x)
- **Video Playback** — Supports MP4 and WebM video files
- **Organization** — Classify by tags, voice actors, and circles. Favorites (per work and per track), playlists
- **Cross-search** — Search across work titles, tags, voice actors, and circle names at once
- **Batch Tagging** — Select multiple works in the library to assign tags, voice actors, and circles in bulk
- **Playback Statistics** — Automatic play count tracking, top 10 most-played tracks, recently played works
- **Auto-save Playback Position** — Automatically saves track position and resumes where you left off
- **Customization** — 8 theme accent colors, dark/light mode, customizable keyboard shortcuts
- **Multi-language** — 日本語・English・简体中文・繁體中文・한국어・Español・Português
- **Media Key Support** — Works with keyboard and earphone play/stop buttons
- **Taskbar Controls** — Playback controls and album art on taskbar hover (Windows)
- **System Tray** — Option to minimize to tray on close (configurable in settings)
- **Window State Restore** — Remembers window size and position across sessions
- **Auto-update** — Check for and install new versions from within the app

## Usage

1. **Register Library** — Select the root folder of your works from the settings page and scan
2. **Play a Work** — Click a work in the library → click a track to start playback
3. **Segment Loop** — Click "Loop Segment" in the player panel → set A/B points → enable loop. You can also name and save segments
4. **Favorites** — Click ♡ on a work for work favorites, ♡ on a track for track favorites
5. **Playlists** — Create a new playlist from "Playlists" in the sidebar → add tracks from the work detail page
6. **Sleep Timer** — Click the clock icon in the player panel and select a duration (5 min – 1 hour)
7. **Theme & Language** — Change theme color, dark/light mode, and language from the settings page

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `J` / `L` | Seek back / forward 10s |
| `Shift+J` / `Shift+L` | Seek back / forward 30s |
| `Shift+←` / `Shift+→` | Seek back / forward 5s |
| `←` / `→` | Previous / Next track |
| `[` / `]` | Set A point / Set B point |
| `\` | Toggle segment loop ON/OFF |
| `M` | Mute |
| `↑` / `↓` | Volume up / down |

All shortcuts can be customized in the settings page.

---

## 開発

### 必要環境

- Node.js 18+
- Rust (rustup)
- npm

### セットアップ

```bash
npm install
npm run tauri dev
```

### ビルド

```bash
npm run tauri build
```

### 技術スタック

| カテゴリ | 技術 |
|---|---|
| デスクトップ基盤 | Tauri 2 (Rust) |
| フロントエンド | React 19 + TypeScript |
| スタイル | Tailwind CSS 3 |
| 状態管理 | Zustand 5 |
| データベース | SQLite (rusqlite) |

詳細なアーキテクチャは [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## 作者

**shimao** — [GitHub](https://github.com/megamega39)

## ライセンス

[GPL-3.0](LICENSE)
