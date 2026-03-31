//! SQLite スキーマ定義とマイグレーション

use rusqlite::Connection;

/// 全マイグレーションを実行
pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        -- 作品
        CREATE TABLE IF NOT EXISTS works (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          folder_path TEXT NOT NULL UNIQUE,
          thumbnail_path TEXT,
          last_played_at INTEGER,
          is_favorite INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        -- 音声バリエーション
        CREATE TABLE IF NOT EXISTS audio_variants (
          id TEXT PRIMARY KEY,
          work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          folder_path TEXT NOT NULL,
          se_mode TEXT,
          audio_format TEXT,
          is_default INTEGER DEFAULT 0,
          track_count INTEGER NOT NULL DEFAULT 0,
          total_duration_sec REAL DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        -- トラック
        CREATE TABLE IF NOT EXISTS tracks (
          id TEXT PRIMARY KEY,
          variant_id TEXT NOT NULL REFERENCES audio_variants(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          file_path TEXT NOT NULL,
          track_no INTEGER NOT NULL,
          duration_sec REAL,
          last_position_sec REAL DEFAULT 0,
          play_count INTEGER DEFAULT 0,
          is_favorite INTEGER DEFAULT 0,
          created_at INTEGER NOT NULL
        );

        -- 再生位置保存
        CREATE TABLE IF NOT EXISTS playback_positions (
          track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
          position_sec REAL NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        );

        -- 区間ループ保存
        CREATE TABLE IF NOT EXISTS loop_segments (
          id TEXT PRIMARY KEY,
          track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          start_sec REAL NOT NULL,
          end_sec REAL NOT NULL,
          created_at INTEGER NOT NULL
        );

        -- 将来拡張用
        CREATE TABLE IF NOT EXISTS voice_actors (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS circles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS work_voice_actors (
          work_id TEXT REFERENCES works(id) ON DELETE CASCADE,
          voice_actor_id TEXT REFERENCES voice_actors(id) ON DELETE CASCADE,
          PRIMARY KEY (work_id, voice_actor_id)
        );

        CREATE TABLE IF NOT EXISTS work_circles (
          work_id TEXT REFERENCES works(id) ON DELETE CASCADE,
          circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE,
          PRIMARY KEY (work_id, circle_id)
        );

        CREATE TABLE IF NOT EXISTS work_tags (
          work_id TEXT REFERENCES works(id) ON DELETE CASCADE,
          tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (work_id, tag_id)
        );

        -- ライブラリ登録フォルダ
        CREATE TABLE IF NOT EXISTS library_roots (
          id TEXT PRIMARY KEY,
          path TEXT NOT NULL UNIQUE,
          created_at INTEGER NOT NULL
        );

        -- カスタムプレイリスト
        CREATE TABLE IF NOT EXISTS playlists (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        -- プレイリスト内のトラック（track_id で参照、同一トラックの重複追加可）
        -- segment_start_sec/end_sec が両方セットなら区間ループとして再生
        CREATE TABLE IF NOT EXISTS playlist_items (
          id TEXT PRIMARY KEY,
          playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
          track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          segment_start_sec REAL,
          segment_end_sec REAL
        );

        CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON playlist_items(playlist_id);

        CREATE INDEX IF NOT EXISTS idx_audio_variants_work_id ON audio_variants(work_id);
        CREATE INDEX IF NOT EXISTS idx_tracks_variant_id ON tracks(variant_id);
        CREATE INDEX IF NOT EXISTS idx_loop_segments_track_id ON loop_segments(track_id);
        CREATE INDEX IF NOT EXISTS idx_works_is_favorite ON works(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_works_last_played_at ON works(last_played_at);
        CREATE INDEX IF NOT EXISTS idx_works_title ON works(title);
        CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
        CREATE INDEX IF NOT EXISTS idx_voice_actors_name ON voice_actors(name);
        CREATE INDEX IF NOT EXISTS idx_circles_name ON circles(name);
        CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks(play_count);
        CREATE INDEX IF NOT EXISTS idx_tracks_is_favorite ON tracks(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_work_tags_tag_id ON work_tags(tag_id);
        CREATE INDEX IF NOT EXISTS idx_work_voice_actors_voice_actor_id ON work_voice_actors(voice_actor_id);
        CREATE INDEX IF NOT EXISTS idx_work_circles_circle_id ON work_circles(circle_id);
        "#,
    )
    .map_err(|e| e.to_string())?;

    // 既存DB用: playlist_items に区間カラムを追加
    let _ = conn.execute("ALTER TABLE playlist_items ADD COLUMN segment_start_sec REAL", []);
    let _ = conn.execute("ALTER TABLE playlist_items ADD COLUMN segment_end_sec REAL", []);

    // 既存DB用: tracks にお気に入りカラムを追加
    let _ = conn.execute("ALTER TABLE tracks ADD COLUMN is_favorite INTEGER DEFAULT 0", []);

    // 既存DB用: 孤立レコードのクリーンアップ（過去の再スキャンで外部キーが無効だったため蓄積）
    conn.execute_batch(
        r#"
        DELETE FROM playlist_items WHERE track_id NOT IN (SELECT id FROM tracks);
        DELETE FROM loop_segments WHERE track_id NOT IN (SELECT id FROM tracks);
        DELETE FROM playback_positions WHERE track_id NOT IN (SELECT id FROM tracks);
        DELETE FROM tracks WHERE variant_id NOT IN (SELECT id FROM audio_variants);
        DELETE FROM audio_variants WHERE work_id NOT IN (SELECT id FROM works);
        DELETE FROM work_tags WHERE work_id NOT IN (SELECT id FROM works) OR tag_id NOT IN (SELECT id FROM tags);
        DELETE FROM work_voice_actors WHERE work_id NOT IN (SELECT id FROM works) OR voice_actor_id NOT IN (SELECT id FROM voice_actors);
        DELETE FROM work_circles WHERE work_id NOT IN (SELECT id FROM works) OR circle_id NOT IN (SELECT id FROM circles);
        "#,
    )
    .map_err(|e| e.to_string())?;

    // 既存DB用: junction テーブルに ON DELETE CASCADE を追加（テーブル再作成）
    // CREATE TABLE IF NOT EXISTS は既存テーブルの制約を変更しないため再作成が必要
    let needs_recreate: bool = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='work_tags'",
            [],
            |row| row.get::<_, String>(0),
        )
        .map(|sql| !sql.contains("ON DELETE CASCADE"))
        .unwrap_or(false);

    if needs_recreate {
        conn.execute_batch(
            r#"
            CREATE TABLE _work_voice_actors_new (
              work_id TEXT REFERENCES works(id) ON DELETE CASCADE,
              voice_actor_id TEXT REFERENCES voice_actors(id) ON DELETE CASCADE,
              PRIMARY KEY (work_id, voice_actor_id)
            );
            INSERT OR IGNORE INTO _work_voice_actors_new SELECT * FROM work_voice_actors;
            DROP TABLE work_voice_actors;
            ALTER TABLE _work_voice_actors_new RENAME TO work_voice_actors;

            CREATE TABLE _work_circles_new (
              work_id TEXT REFERENCES works(id) ON DELETE CASCADE,
              circle_id TEXT REFERENCES circles(id) ON DELETE CASCADE,
              PRIMARY KEY (work_id, circle_id)
            );
            INSERT OR IGNORE INTO _work_circles_new SELECT * FROM work_circles;
            DROP TABLE work_circles;
            ALTER TABLE _work_circles_new RENAME TO work_circles;

            CREATE TABLE _work_tags_new (
              work_id TEXT REFERENCES works(id) ON DELETE CASCADE,
              tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
              PRIMARY KEY (work_id, tag_id)
            );
            INSERT OR IGNORE INTO _work_tags_new SELECT * FROM work_tags;
            DROP TABLE work_tags;
            ALTER TABLE _work_tags_new RENAME TO work_tags;

            CREATE INDEX IF NOT EXISTS idx_work_tags_tag_id ON work_tags(tag_id);
            CREATE INDEX IF NOT EXISTS idx_work_voice_actors_voice_actor_id ON work_voice_actors(voice_actor_id);
            CREATE INDEX IF NOT EXISTS idx_work_circles_circle_id ON work_circles(circle_id);
            "#,
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}
