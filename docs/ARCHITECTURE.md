# 同人音声プレイヤー アーキテクチャ設計書

## 1. プロジェクト構成

```
doujin-player/
├── src-tauri/                 # Tauri (Rust) バックエンド
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs
│   │   ├── db/                # SQLite
│   │   ├── scanner/           # ライブラリスキャン
│   │   └── commands/          # Tauri コマンド
│   └── Cargo.toml
├── src/                       # React フロントエンド
│   ├── components/
│   │   ├── layout/            # Sidebar, MiniPlayer, MainLayout
│   │   ├── library/           # WorkGrid, WorkCard
│   │   └── work-detail/       # VariantSelector, TrackList, LoopSegmentUI
│   ├── pages/
│   ├── stores/
│   ├── api/
│   └── hooks/
├── docs/
└── package.json
```

## 2. SQLite スキーマ

- `works` - 作品
- `audio_variants` - 音声バリエーション（SEあり/なし、形式など）
- `tracks` - トラック
- `playback_positions` - 再生位置
- `loop_segments` - 区間ループ保存
- `library_roots` - ライブラリ登録フォルダ
- 将来用: `voice_actors`, `circles`, `tags` と中間テーブル

## 3. スキャン処理

- ライブラリルート直下の子フォルダを作品候補とする
- サムネイル: thumbnail/thumb/image 等フォルダ → 直下 → 再帰
- 音声バリエーション: 同一フォルダ内の音声ファイル群を1単位として検出
- フォルダ名から se_mode, audio_format を推定

## 4. Tauri / React 責務分担

| Tauri | React |
|-------|-------|
| フォルダ選択、スキャン、SQLite、設定 | UI、プレイヤー、区間ループ制御 |

## 5. MVP 実装順序

1. 基盤: Tauri + React、SQLite、レイアウト
2. スキャン・データ
3. ライブラリ UI
4. 作品詳細・プレイヤー
5. 区間ループ・永続化
