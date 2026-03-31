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
- **高機能プレイヤー** — 区間ループ（A/B点設定・微調整・保存）、スリープタイマー、再生速度変更
- **整理機能** — タグ・声優・サークルによる分類、お気に入り（作品・トラック単位）、プレイリスト
- **横断検索** — 作品名・タグ・声優・サークル名をまとめて検索
- **一括タグ付け** — ライブラリで複数作品を選択してタグ・声優・サークルを一括登録
- **再生統計** — 再生回数の自動記録、よく聴くトラックTOP10
- **カスタマイズ** — テーマカラー8色、ダーク/ライトモード、ショートカットキー設定
- **多言語対応** — 日本語・English・简体中文・繁體中文・한국어・Español・Português
- **メディアキー対応** — キーボード・イヤホンの再生/停止ボタンに対応
- **自動アップデート** — 新しいバージョンをアプリ内から確認・インストール

## 使い方

1. **ライブラリ登録** — 設定画面から作品フォルダのルートを選択してスキャン
2. **作品を再生** — ライブラリから作品をクリック → トラックをクリックで再生開始
3. **区間ループ** — 再生パネルの「ループ区間」→ A/B点を設定 → ループON
4. **お気に入り** — 作品の♡で作品お気に入り、トラックの♡でトラックお気に入り

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
