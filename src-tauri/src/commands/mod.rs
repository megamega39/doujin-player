//! Tauri コマンド定義

use tauri::Manager;
use crate::db::DbState;
use crate::settings;
use crate::thumbnail_cache;
use crate::scanner;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Work {
    pub id: String,
    pub title: String,
    pub folder_path: String,
    pub thumbnail_path: Option<String>,
    pub last_played_at: Option<i64>,
    pub is_favorite: bool,
    pub track_count: i32,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioVariant {
    pub id: String,
    pub work_id: String,
    pub label: String,
    pub folder_path: String,
    pub se_mode: Option<String>,
    pub audio_format: Option<String>,
    pub is_default: bool,
    pub track_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Track {
    pub id: String,
    pub variant_id: String,
    pub title: String,
    pub file_path: String,
    pub track_no: i32,
    pub duration_sec: Option<f64>,
    pub last_position_sec: f64,
    pub is_favorite: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoopSegment {
    pub id: String,
    pub track_id: String,
    pub name: String,
    pub start_sec: f64,
    pub end_sec: f64,
}

/// ライブラリルートを表す型
#[derive(Debug, Serialize, Deserialize)]
pub struct LibraryRoot {
    pub id: String,
    pub path: String,
    pub created_at: i64,
}

/// 登録済みライブラリフォルダ一覧を取得
#[tauri::command]
pub async fn get_library_roots(state: tauri::State<'_, DbState>) -> Result<Vec<LibraryRoot>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, path, created_at FROM library_roots ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(LibraryRoot {
                id: row.get(0)?,
                path: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// ライブラリフォルダを選択してスキャン＆登録
#[tauri::command]
pub async fn scan_library(root_path: String, app: tauri::AppHandle) -> Result<usize, String> {
    let state = app.state::<DbState>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let root = std::path::Path::new(&root_path);
    let count = scanner::scan_library_root_with_progress(&conn, root, Some(&app))?;
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().timestamp();
    match conn.execute(
        "INSERT INTO library_roots (id, path, created_at) VALUES (?1, ?2, ?3)",
        (id.as_str(), root_path.as_str(), created_at),
    ) {
        Ok(_) => {}
        Err(rusqlite::Error::SqliteFailure(ref e, _))
            if e.extended_code == rusqlite::ffi::SQLITE_CONSTRAINT_UNIQUE =>
        {
            // 既に同一パスが登録済みならスキップ（上でスキャン済み）
        }
        Err(e) => return Err(e.to_string()),
    }
    Ok(count)
}

/// 登録済みライブラリフォルダを解除（その配下の作品も削除）
#[tauri::command]
pub async fn remove_library_root(root_id: String, app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<DbState>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let root_path: String = conn
        .query_row("SELECT path FROM library_roots WHERE id = ?1", [&root_id], |row| row.get(0))
        .map_err(|_| "LIBRARY_ROOT_NOT_FOUND")?;

    let root = std::path::Path::new(&root_path);
    let mut stmt = conn
        .prepare("SELECT id, folder_path FROM works")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    let work_ids: Vec<String> = rows
        .filter_map(|r| r.ok())
        .filter(|(_, fp)| std::path::Path::new(fp).starts_with(root))
        .map(|(id, _)| id)
        .collect();

    for wid in &work_ids {
        conn.execute("DELETE FROM work_tags WHERE work_id = ?1", [wid])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM work_voice_actors WHERE work_id = ?1", [wid])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM work_circles WHERE work_id = ?1", [wid])
            .map_err(|e| e.to_string())?;
    }
    for wid in &work_ids {
        conn.execute("DELETE FROM works WHERE id = ?1", [wid])
            .map_err(|e| e.to_string())?;
    }
    conn.execute("DELETE FROM library_roots WHERE id = ?1", [&root_id])
        .map_err(|e| e.to_string())?;

    // どの作品にも紐づいていないタグ・声優・サークルを削除
    conn.execute(
        "DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM work_tags WHERE work_tags.tag_id = tags.id)",
        [],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM voice_actors WHERE NOT EXISTS (SELECT 1 FROM work_voice_actors WHERE work_voice_actors.voice_actor_id = voice_actors.id)",
        [],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM circles WHERE NOT EXISTS (SELECT 1 FROM work_circles WHERE work_circles.circle_id = circles.id)",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// 保存済み全ライブラリルートで再スキャン
#[tauri::command]
pub async fn rescan_library(app: tauri::AppHandle) -> Result<usize, String> {
    let state = app.state::<DbState>();
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT path FROM library_roots ORDER BY created_at")
        .map_err(|e| e.to_string())?;
    let paths: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    if paths.is_empty() {
        return Err("NO_LIBRARY_ROOTS".into());
    }
    let mut total = 0usize;
    for p in &paths {
        total += scanner::scan_library_root_with_progress(&conn, std::path::Path::new(p), Some(&app))?;
    }
    Ok(total)
}

/// 再生履歴（最近再生した作品）を取得
#[tauri::command]
pub async fn get_recent_works(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Work>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT w.id, w.title, w.folder_path, w.thumbnail_path, w.last_played_at, w.is_favorite,
                    COALESCE(SUM(v.track_count), 0) as track_count, w.created_at
             FROM works w
             LEFT JOIN audio_variants v ON v.work_id = w.id
             WHERE w.last_played_at IS NOT NULL
             GROUP BY w.id ORDER BY w.last_played_at DESC LIMIT 100",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Work {
                id: row.get(0)?,
                title: row.get(1)?,
                folder_path: row.get(2)?,
                thumbnail_path: row.get(3)?,
                last_played_at: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                track_count: row.get::<_, i32>(6)?,
                created_at: row.get::<_, i64>(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn map_work_row(row: &rusqlite::Row<'_>) -> Result<Work, rusqlite::Error> {
    Ok(Work {
        id: row.get(0)?,
        title: row.get(1)?,
        folder_path: row.get(2)?,
        thumbnail_path: row.get(3)?,
        last_played_at: row.get(4)?,
        is_favorite: row.get::<_, i32>(5)? != 0,
        track_count: row.get::<_, i32>(6)?,
        created_at: row.get::<_, i64>(7)?,
    })
}

/// 作品一覧を取得（タグ・声優・サークルで複合絞り込み — 動的クエリ生成）
#[tauri::command]
pub async fn get_works_filtered(
    tag_id: Option<String>,
    voice_actor_id: Option<String>,
    circle_id: Option<String>,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Work>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut joins = String::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref t) = tag_id {
        joins.push_str(&format!(
            " JOIN work_tags wt ON wt.work_id = w.id AND wt.tag_id = ?{}", idx
        ));
        params.push(Box::new(t.clone()));
        idx += 1;
    }
    if let Some(ref va) = voice_actor_id {
        joins.push_str(&format!(
            " JOIN work_voice_actors wva ON wva.work_id = w.id AND wva.voice_actor_id = ?{}", idx
        ));
        params.push(Box::new(va.clone()));
        idx += 1;
    }
    if let Some(ref c) = circle_id {
        joins.push_str(&format!(
            " JOIN work_circles wc ON wc.work_id = w.id AND wc.circle_id = ?{}", idx
        ));
        params.push(Box::new(c.clone()));
        #[allow(unused_assignments)]
        { idx += 1; }
    }

    let sql = format!(
        "SELECT w.id, w.title, w.folder_path, w.thumbnail_path, w.last_played_at, w.is_favorite,
                COALESCE(SUM(v.track_count), 0) as track_count, w.created_at
         FROM works w
         LEFT JOIN audio_variants v ON v.work_id = w.id
         {} GROUP BY w.id ORDER BY w.title",
        joins
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(param_refs.as_slice(), map_work_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// 作品を横断検索（タイトル・タグ・声優・サークル名）
#[tauri::command]
pub async fn search_works(
    query: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Work>, String> {
    let query = query.trim().to_string();
    if query.is_empty() {
        return Ok(Vec::new());
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let pattern = format!("%{}%", query);
    let sql = "SELECT DISTINCT w.id, w.title, w.folder_path, w.thumbnail_path, w.last_played_at, w.is_favorite,
                    COALESCE((SELECT SUM(av.track_count) FROM audio_variants av WHERE av.work_id = w.id), 0) as track_count,
                    w.created_at
             FROM works w
             LEFT JOIN work_tags wt ON wt.work_id = w.id
             LEFT JOIN tags t ON t.id = wt.tag_id
             LEFT JOIN work_voice_actors wva ON wva.work_id = w.id
             LEFT JOIN voice_actors va ON va.id = wva.voice_actor_id
             LEFT JOIN work_circles wc ON wc.work_id = w.id
             LEFT JOIN circles c ON c.id = wc.circle_id
             WHERE w.title LIKE ?1
                OR w.folder_path LIKE ?1
                OR t.name LIKE ?1
                OR va.name LIKE ?1
                OR c.name LIKE ?1
             ORDER BY w.title";
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&pattern], map_work_row)
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// 作品一覧を取得（get_works_filtered の引数なし版）
#[tauri::command]
pub async fn get_works(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Work>, String> {
    get_works_filtered(None, None, None, state).await
}

/// 作品詳細を取得
#[tauri::command]
pub async fn get_work_detail(
    work_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Option<WorkDetail>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let work: Option<Work> = conn
        .query_row(
            "SELECT w.id, w.title, w.folder_path, w.thumbnail_path, w.last_played_at, w.is_favorite,
                    (SELECT COUNT(*) FROM tracks t JOIN audio_variants v ON t.variant_id = v.id WHERE v.work_id = w.id),
                    w.created_at
             FROM works w WHERE w.id = ?1",
            [&work_id],
            |row| {
                Ok(Work {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    folder_path: row.get(2)?,
                    thumbnail_path: row.get(3)?,
                    last_played_at: row.get(4)?,
                    is_favorite: row.get::<_, i32>(5)? != 0,
                    track_count: row.get(6)?,
                    created_at: row.get::<_, i64>(7)?,
                })
            },
        )
        .ok();

    let work = match work {
        Some(w) => w,
        None => return Ok(None),
    };

    let mut stmt = conn
        .prepare(
            "SELECT id, work_id, label, folder_path, se_mode, audio_format, is_default, track_count
             FROM audio_variants WHERE work_id = ?1 ORDER BY is_default DESC, label",
        )
        .map_err(|e| e.to_string())?;
    let variants: Vec<AudioVariant> = stmt
        .query_map([&work_id], |row| {
            Ok(AudioVariant {
                id: row.get(0)?,
                work_id: row.get(1)?,
                label: row.get(2)?,
                folder_path: row.get(3)?,
                se_mode: row.get(4)?,
                audio_format: row.get(5)?,
                is_default: row.get::<_, i32>(6)? != 0,
                track_count: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<_, _>>()
        .map_err(|e| e.to_string())?;

    Ok(Some(WorkDetail {
        work,
        variants,
        tracks: Vec::new(), // クライアントから get_tracks(variant_id) で取得する
    }))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkDetail {
    pub work: Work,
    pub variants: Vec<AudioVariant>,
    pub tracks: Vec<Track>,
}

/// バリエーションのトラック一覧を取得
#[tauri::command]
pub async fn get_tracks(
    variant_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Track>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.variant_id, t.title, t.file_path, t.track_no, t.duration_sec, COALESCE(t.last_position_sec, 0), COALESCE(t.is_favorite, 0)
             FROM tracks t WHERE t.variant_id = ?1 ORDER BY t.track_no",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&variant_id], |row| {
            Ok(Track {
                id: row.get(0)?,
                variant_id: row.get(1)?,
                title: row.get(2)?,
                file_path: row.get(3)?,
                track_no: row.get(4)?,
                duration_sec: row.get(5)?,
                last_position_sec: row.get(6)?,
                is_favorite: row.get::<_, i32>(7)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// トラックの並び順を更新（詳細画面の DnD 用）
#[tauri::command]
pub async fn reorder_tracks(
    variant_id: String,
    track_ids: Vec<String>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;
    for (i, track_id) in track_ids.iter().enumerate() {
        let track_no = (i + 1) as i32;
        tx.execute(
            "UPDATE tracks SET track_no = ?1 WHERE id = ?2 AND variant_id = ?3",
            rusqlite::params![track_no, track_id, variant_id],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// トラックの並び順をスキャン時の順序にリセット
#[tauri::command]
pub async fn reset_track_order(
    variant_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Track>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let tracks: Vec<(String, String)> = conn
        .prepare(
            "SELECT id, file_path FROM tracks WHERE variant_id = ?1",
        )
        .map_err(|e| e.to_string())?
        .query_map([&variant_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    let sorted_ids = scanner::sort_track_ids_by_file_path(&tracks);
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| e.to_string())?;
    for (i, track_id) in sorted_ids.iter().enumerate() {
        let track_no = (i + 1) as i32;
        tx.execute(
            "UPDATE tracks SET track_no = ?1 WHERE id = ?2 AND variant_id = ?3",
            rusqlite::params![track_no, track_id, variant_id],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    // 更新後のトラック一覧を返す
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.variant_id, t.title, t.file_path, t.track_no, t.duration_sec, COALESCE(t.last_position_sec, 0), COALESCE(t.is_favorite, 0)
             FROM tracks t WHERE t.variant_id = ?1 ORDER BY t.track_no",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&variant_id], |row| {
            Ok(Track {
                id: row.get(0)?,
                variant_id: row.get(1)?,
                title: row.get(2)?,
                file_path: row.get(3)?,
                track_no: row.get(4)?,
                duration_sec: row.get(5)?,
                last_position_sec: row.get(6)?,
                is_favorite: row.get::<_, i32>(7)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// トラックのループ区間一覧を取得
#[tauri::command]
pub async fn get_loop_segments(
    track_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<LoopSegment>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, track_id, name, start_sec, end_sec FROM loop_segments WHERE track_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&track_id], |row| {
            Ok(LoopSegment {
                id: row.get(0)?,
                track_id: row.get(1)?,
                name: row.get(2)?,
                start_sec: row.get(3)?,
                end_sec: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// ループ区間を保存
#[tauri::command]
pub async fn save_loop_segment(
    track_id: String,
    name: String,
    start_sec: f64,
    end_sec: f64,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO loop_segments (id, track_id, name, start_sec, end_sec, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (id, track_id, name, start_sec, end_sec, now),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// ループ区間を削除
#[tauri::command]
pub async fn delete_loop_segment(
    segment_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM loop_segments WHERE id = ?1", [&segment_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// ループ区間の名前を更新
#[tauri::command]
pub async fn update_loop_segment_name(
    segment_id: String,
    name: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE loop_segments SET name = ?1 WHERE id = ?2",
        (&name, &segment_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 再生位置を保存（同時に works.last_played_at を更新して再生履歴に記録）
#[tauri::command]
pub async fn save_playback_position(
    track_id: String,
    position_sec: f64,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT OR REPLACE INTO playback_positions (track_id, position_sec, updated_at) VALUES (?1, ?2, ?3)",
        (&track_id, position_sec, now),
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE works SET last_played_at = ?1 WHERE id = (SELECT v.work_id FROM tracks t JOIN audio_variants v ON t.variant_id = v.id WHERE t.id = ?2)",
        (now, &track_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// トラックの再生回数をインクリメント
#[tauri::command]
pub async fn increment_play_count(
    track_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tracks SET play_count = COALESCE(play_count, 0) + 1 WHERE id = ?1",
        [&track_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 作品フォルダ内の全画像パスを取得
#[tauri::command]
pub async fn get_work_images(folder_path: String) -> Result<Vec<String>, String> {
    let paths = crate::scanner::collect_all_images(std::path::Path::new(&folder_path));
    Ok(paths
        .into_iter()
        .filter_map(|p| p.to_str().map(String::from))
        .collect())
}

/// 作品のサムネイル画像を設定
#[tauri::command]
pub async fn set_work_thumbnail(
    work_id: String,
    thumbnail_path: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE works SET thumbnail_path = ?1 WHERE id = ?2",
        (&thumbnail_path, &work_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// サムネイルをディスクキャッシュから取得、なければ生成してbase64で返す（128x128, 軽量）
#[tauri::command]
pub async fn get_thumbnail_base64(path: String, app: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    thumbnail_cache::thumbnail_to_base64(&app_dir, &path)
}

/// サムネイルのキャッシュファイルパスを返す（なければ生成）。asset プロトコル用。
#[tauri::command]
pub async fn get_thumbnail_path(path: String, app: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    thumbnail_cache::get_thumbnail_file_path(&app_dir, &path)
}

/// よく聴くトラックを取得（再生回数順）
#[tauri::command]
pub async fn get_most_played_tracks(
    limit: Option<i32>,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<FavoriteTrackItem>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let lim = limit.unwrap_or(10);
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.variant_id, t.title, t.file_path, t.track_no, t.duration_sec, COALESCE(t.last_position_sec, 0), v.work_id, w.title, COALESCE(t.play_count, 0), COALESCE(t.is_favorite, 0)
             FROM tracks t
             JOIN audio_variants v ON v.id = t.variant_id
             JOIN works w ON w.id = v.work_id
             WHERE COALESCE(t.play_count, 0) > 0
             ORDER BY t.play_count DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([lim], |row| {
            Ok(FavoriteTrackItem {
                track: Track {
                    id: row.get(0)?,
                    variant_id: row.get(1)?,
                    title: row.get(2)?,
                    file_path: row.get(3)?,
                    track_no: row.get(4)?,
                    duration_sec: row.get(5)?,
                    last_position_sec: row.get(6)?,
                    is_favorite: row.get::<_, i32>(10)? != 0,
                },
                work_id: row.get(7)?,
                work_title: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// トラックのファイル存在チェック結果
#[derive(Debug, Serialize, Deserialize)]
pub struct TrackFileStatus {
    pub track_id: String,
    pub file_path: String,
    pub exists: bool,
}

/// バリエーションのトラックファイルが存在するかチェック
#[tauri::command]
pub async fn check_tracks_exist(
    variant_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<TrackFileStatus>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, file_path FROM tracks WHERE variant_id = ?1")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(String, String)> = stmt
        .query_map([&variant_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows
        .into_iter()
        .map(|(id, fp)| TrackFileStatus {
            exists: std::path::Path::new(&fp).exists(),
            track_id: id,
            file_path: fp,
        })
        .collect())
}

/// タグ（名前と作品数）
#[derive(Debug, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub work_count: i32,
}

/// 声優（名前と作品数）
#[derive(Debug, Serialize, Deserialize)]
pub struct VoiceActor {
    pub id: String,
    pub name: String,
    pub work_count: i32,
}

/// サークル（名前と作品数）
#[derive(Debug, Serialize, Deserialize)]
pub struct Circle {
    pub id: String,
    pub name: String,
    pub work_count: i32,
}

/// 全タグを取得（作品数付き、名前順）
#[tauri::command]
pub async fn get_tags(state: tauri::State<'_, DbState>) -> Result<Vec<Tag>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, COUNT(wt.work_id) as work_count
             FROM tags t
             LEFT JOIN work_tags wt ON wt.tag_id = t.id
             GROUP BY t.id ORDER BY t.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                work_count: row.get::<_, i64>(2)? as i32,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// 指定タグの作品一覧を取得
#[tauri::command]
pub async fn get_works_by_tag(
    tag_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Work>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT w.id, w.title, w.folder_path, w.thumbnail_path, w.last_played_at, w.is_favorite,
                    COALESCE(SUM(v.track_count), 0) as track_count, w.created_at
             FROM works w
             JOIN work_tags wt ON wt.work_id = w.id AND wt.tag_id = ?1
             LEFT JOIN audio_variants v ON v.work_id = w.id
             GROUP BY w.id ORDER BY w.title",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&tag_id], |row| {
            Ok(Work {
                id: row.get(0)?,
                title: row.get(1)?,
                folder_path: row.get(2)?,
                thumbnail_path: row.get(3)?,
                last_played_at: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                track_count: row.get::<_, i32>(6)?,
                created_at: row.get::<_, i64>(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// 作品に紐づくタグ一覧を取得
#[tauri::command]
pub async fn get_work_tags(
    work_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Tag>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.name, COUNT(wt2.work_id) as work_count
             FROM tags t
             JOIN work_tags wt ON wt.tag_id = t.id AND wt.work_id = ?1
             LEFT JOIN work_tags wt2 ON wt2.tag_id = t.id
             GROUP BY t.id ORDER BY t.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&work_id], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                work_count: row.get::<_, i64>(2)? as i32,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// 作品にタグを追加（タグがなければ自動作成）
#[tauri::command]
pub async fn add_work_tag(
    work_id: String,
    tag_name: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let tag_name = tag_name.trim();
    if tag_name.is_empty() {
        return Err("EMPTY_NAME".to_string());
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let tag_id: Option<String> = conn
        .query_row("SELECT id FROM tags WHERE name = ?1", [tag_name], |r| r.get(0))
        .ok();
    let tag_id = match tag_id {
        Some(id) => id,
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO tags (id, name) VALUES (?1, ?2)",
                (&id, tag_name),
            )
            .map_err(|e| e.to_string())?;
            id
        }
    };
    conn.execute(
        "INSERT OR IGNORE INTO work_tags (work_id, tag_id) VALUES (?1, ?2)",
        (&work_id, &tag_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 作品からタグを削除
#[tauri::command]
pub async fn remove_work_tag(
    work_id: String,
    tag_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM work_tags WHERE work_id = ?1 AND tag_id = ?2",
        (&work_id, &tag_id),
    )
    .map_err(|e| e.to_string())?;
    // 孤立タグを削除
    conn.execute(
        "DELETE FROM tags WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM work_tags WHERE tag_id = ?1)",
        [&tag_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 全声優を取得（作品数付き、名前順）
#[tauri::command]
pub async fn get_voice_actors(state: tauri::State<'_, DbState>) -> Result<Vec<VoiceActor>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT va.id, va.name, COUNT(wva.work_id) as work_count
             FROM voice_actors va
             LEFT JOIN work_voice_actors wva ON wva.voice_actor_id = va.id
             GROUP BY va.id ORDER BY va.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(VoiceActor {
                id: row.get(0)?,
                name: row.get(1)?,
                work_count: row.get::<_, i64>(2)? as i32,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// 指定声優の作品一覧を取得
#[tauri::command]
pub async fn get_works_by_voice_actor(
    voice_actor_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Work>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT w.id, w.title, w.folder_path, w.thumbnail_path, w.last_played_at, w.is_favorite,
                    COALESCE(SUM(v.track_count), 0) as track_count, w.created_at
             FROM works w
             JOIN work_voice_actors wva ON wva.work_id = w.id AND wva.voice_actor_id = ?1
             LEFT JOIN audio_variants v ON v.work_id = w.id
             GROUP BY w.id ORDER BY w.title",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&voice_actor_id], |row| {
            Ok(Work {
                id: row.get(0)?,
                title: row.get(1)?,
                folder_path: row.get(2)?,
                thumbnail_path: row.get(3)?,
                last_played_at: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                track_count: row.get::<_, i32>(6)?,
                created_at: row.get::<_, i64>(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// 作品に紐づく声優一覧を取得
#[tauri::command]
pub async fn get_work_voice_actors(
    work_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<VoiceActor>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT va.id, va.name, COUNT(wva2.work_id) as work_count
             FROM voice_actors va
             JOIN work_voice_actors wva ON wva.voice_actor_id = va.id AND wva.work_id = ?1
             LEFT JOIN work_voice_actors wva2 ON wva2.voice_actor_id = va.id
             GROUP BY va.id ORDER BY va.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&work_id], |row| {
            Ok(VoiceActor {
                id: row.get(0)?,
                name: row.get(1)?,
                work_count: row.get::<_, i64>(2)? as i32,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// 作品に声優を追加（声優がなければ自動作成）
#[tauri::command]
pub async fn add_work_voice_actor(
    work_id: String,
    voice_actor_name: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let name = voice_actor_name.trim();
    if name.is_empty() {
        return Err("EMPTY_NAME".to_string());
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let va_id: Option<String> = conn
        .query_row("SELECT id FROM voice_actors WHERE name = ?1", [name], |r| r.get(0))
        .ok();
    let va_id = match va_id {
        Some(id) => id,
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO voice_actors (id, name) VALUES (?1, ?2)",
                (&id, name),
            )
            .map_err(|e| e.to_string())?;
            id
        }
    };
    conn.execute(
        "INSERT OR IGNORE INTO work_voice_actors (work_id, voice_actor_id) VALUES (?1, ?2)",
        (&work_id, &va_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 作品から声優を削除
#[tauri::command]
pub async fn remove_work_voice_actor(
    work_id: String,
    voice_actor_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM work_voice_actors WHERE work_id = ?1 AND voice_actor_id = ?2",
        (&work_id, &voice_actor_id),
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM voice_actors WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM work_voice_actors WHERE voice_actor_id = ?1)",
        [&voice_actor_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 全サークルを取得（作品数付き、名前順）
#[tauri::command]
pub async fn get_circles(state: tauri::State<'_, DbState>) -> Result<Vec<Circle>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name, COUNT(wc.work_id) as work_count
             FROM circles c
             LEFT JOIN work_circles wc ON wc.circle_id = c.id
             GROUP BY c.id ORDER BY c.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Circle {
                id: row.get(0)?,
                name: row.get(1)?,
                work_count: row.get::<_, i64>(2)? as i32,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// 指定サークルの作品一覧を取得
#[tauri::command]
pub async fn get_works_by_circle(
    circle_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Work>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT w.id, w.title, w.folder_path, w.thumbnail_path, w.last_played_at, w.is_favorite,
                    COALESCE(SUM(v.track_count), 0) as track_count, w.created_at
             FROM works w
             JOIN work_circles wc ON wc.work_id = w.id AND wc.circle_id = ?1
             LEFT JOIN audio_variants v ON v.work_id = w.id
             GROUP BY w.id ORDER BY w.title",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&circle_id], |row| {
            Ok(Work {
                id: row.get(0)?,
                title: row.get(1)?,
                folder_path: row.get(2)?,
                thumbnail_path: row.get(3)?,
                last_played_at: row.get(4)?,
                is_favorite: row.get::<_, i32>(5)? != 0,
                track_count: row.get::<_, i32>(6)?,
                created_at: row.get::<_, i64>(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// 作品に紐づくサークル一覧を取得
#[tauri::command]
pub async fn get_work_circles(
    work_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Circle>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name, COUNT(wc2.work_id) as work_count
             FROM circles c
             JOIN work_circles wc ON wc.circle_id = c.id AND wc.work_id = ?1
             LEFT JOIN work_circles wc2 ON wc2.circle_id = c.id
             GROUP BY c.id ORDER BY c.name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&work_id], |row| {
            Ok(Circle {
                id: row.get(0)?,
                name: row.get(1)?,
                work_count: row.get::<_, i64>(2)? as i32,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// 作品にサークルを追加（サークルがなければ自動作成）
#[tauri::command]
pub async fn add_work_circle(
    work_id: String,
    circle_name: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let name = circle_name.trim();
    if name.is_empty() {
        return Err("EMPTY_NAME".to_string());
    }
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let circle_id: Option<String> = conn
        .query_row("SELECT id FROM circles WHERE name = ?1", [name], |r| r.get(0))
        .ok();
    let circle_id = match circle_id {
        Some(id) => id,
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO circles (id, name) VALUES (?1, ?2)",
                (&id, name),
            )
            .map_err(|e| e.to_string())?;
            id
        }
    };
    conn.execute(
        "INSERT OR IGNORE INTO work_circles (work_id, circle_id) VALUES (?1, ?2)",
        (&work_id, &circle_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 作品からサークルを削除
#[tauri::command]
pub async fn remove_work_circle(
    work_id: String,
    circle_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM work_circles WHERE work_id = ?1 AND circle_id = ?2",
        (&work_id, &circle_id),
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM circles WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM work_circles WHERE circle_id = ?1)",
        [&circle_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// お気に入りトグル
#[tauri::command]
pub async fn toggle_favorite(
    work_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE works SET is_favorite = 1 - is_favorite WHERE id = ?1",
        [&work_id],
    )
    .map_err(|e| e.to_string())?;
    let fav: i32 = conn
        .query_row("SELECT is_favorite FROM works WHERE id = ?1", [&work_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(fav != 0)
}

/// トラックのお気に入りトグル
#[tauri::command]
pub async fn toggle_track_favorite(
    track_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<bool, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE tracks SET is_favorite = 1 - COALESCE(is_favorite, 0) WHERE id = ?1",
        [&track_id],
    )
    .map_err(|e| e.to_string())?;
    let fav: i32 = conn
        .query_row("SELECT COALESCE(is_favorite, 0) FROM tracks WHERE id = ?1", [&track_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    Ok(fav != 0)
}

/// お気に入りトラック一覧を取得
#[tauri::command]
pub async fn get_favorite_tracks(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<FavoriteTrackItem>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.variant_id, t.title, t.file_path, t.track_no, t.duration_sec, COALESCE(t.last_position_sec, 0), v.work_id, w.title
             FROM tracks t
             JOIN audio_variants v ON v.id = t.variant_id
             JOIN works w ON w.id = v.work_id
             WHERE COALESCE(t.is_favorite, 0) = 1
             ORDER BY w.title, t.track_no",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(FavoriteTrackItem {
                track: Track {
                    id: row.get(0)?,
                    variant_id: row.get(1)?,
                    title: row.get(2)?,
                    file_path: row.get(3)?,
                    track_no: row.get(4)?,
                    duration_sec: row.get(5)?,
                    last_position_sec: row.get(6)?,
                    is_favorite: true,
                },
                work_id: row.get(7)?,
                work_title: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FavoriteTrackItem {
    pub track: Track,
    pub work_id: String,
    pub work_title: String,
}

// ========== プレイリスト ==========

#[derive(Debug, Serialize, Deserialize)]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub track_count: i32,
    pub sort_order: i32,
    pub created_at: i64,
}

/// プレイリスト一覧を取得
#[tauri::command]
pub async fn get_playlists(state: tauri::State<'_, DbState>) -> Result<Vec<Playlist>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, p.sort_order, p.created_at,
                    COALESCE((SELECT COUNT(*) FROM playlist_items WHERE playlist_id = p.id), 0) as track_count
             FROM playlists p ORDER BY p.sort_order, p.created_at",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                track_count: row.get::<_, i64>(4)? as i32,
                sort_order: row.get(2)?,
                created_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// プレイリストを作成
#[tauri::command]
pub async fn create_playlist(
    name: String,
    state: tauri::State<'_, DbState>,
) -> Result<Playlist, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let sort_order: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM playlists",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    conn.execute(
        "INSERT INTO playlists (id, name, sort_order, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        (&id, &name, sort_order, now, now),
    )
    .map_err(|e| e.to_string())?;
    Ok(Playlist {
        id: id.clone(),
        name,
        track_count: 0,
        sort_order,
        created_at: now,
    })
}

/// プレイリストを更新（名前変更）
#[tauri::command]
pub async fn update_playlist(
    playlist_id: String,
    name: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE playlists SET name = ?1, updated_at = ?2 WHERE id = ?3",
        (&name, now, &playlist_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// プレイリストの並び順を変更
#[tauri::command]
pub async fn reorder_playlists(
    playlist_ids: Vec<String>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    for (i, id) in playlist_ids.iter().enumerate() {
        conn.execute(
            "UPDATE playlists SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            (i as i32, chrono::Utc::now().timestamp(), id),
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// プレイリストを削除
#[tauri::command]
pub async fn delete_playlist(
    playlist_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM playlists WHERE id = ?1", [&playlist_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaylistTrackItem {
    pub item_id: String,
    pub track: Track,
    pub work_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segment_start_sec: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub segment_end_sec: Option<f64>,
}

/// プレイリスト内のトラック一覧を取得
#[tauri::command]
pub async fn get_playlist_tracks(
    playlist_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<Vec<PlaylistTrackItem>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT pi.id, t.id, t.variant_id, t.title, t.file_path, t.track_no, t.duration_sec, COALESCE(t.last_position_sec, 0), v.work_id, pi.segment_start_sec, pi.segment_end_sec, COALESCE(t.is_favorite, 0)
             FROM playlist_items pi
             JOIN tracks t ON t.id = pi.track_id
             JOIN audio_variants v ON v.id = t.variant_id
             WHERE pi.playlist_id = ?1 ORDER BY pi.position",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([&playlist_id], |row| {
            Ok(PlaylistTrackItem {
                item_id: row.get(0)?,
                track: Track {
                    id: row.get(1)?,
                    variant_id: row.get(2)?,
                    title: row.get(3)?,
                    file_path: row.get(4)?,
                    track_no: row.get(5)?,
                    duration_sec: row.get(6)?,
                    last_position_sec: row.get(7)?,
                    is_favorite: row.get::<_, i32>(11)? != 0,
                },
                work_id: row.get(8)?,
                segment_start_sec: row.get(9).ok(),
                segment_end_sec: row.get(10).ok(),
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// トラックをプレイリストに追加（オプションで区間指定可能）
#[tauri::command]
pub async fn add_playlist_track(
    playlist_id: String,
    track_id: String,
    segment_start_sec: Option<f64>,
    segment_end_sec: Option<f64>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let max_pos: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_items WHERE playlist_id = ?1",
            [&playlist_id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT INTO playlist_items (id, playlist_id, track_id, position, created_at, segment_start_sec, segment_end_sec) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        (
            &id,
            &playlist_id,
            &track_id,
            max_pos,
            now,
            segment_start_sec,
            segment_end_sec,
        ),
    )
    .map_err(|e| e.to_string())?;
    let now_ts = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE playlists SET updated_at = ?1 WHERE id = ?2",
        (now_ts, &playlist_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// プレイリスト内のトラック順序を変更
#[tauri::command]
pub async fn reorder_playlist_items(
    playlist_id: String,
    item_ids: Vec<String>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    for (i, item_id) in item_ids.iter().enumerate() {
        conn.execute(
            "UPDATE playlist_items SET position = ?1 WHERE playlist_id = ?2 AND id = ?3",
            (i as i32, &playlist_id, item_id),
        )
        .map_err(|e| e.to_string())?;
    }
    let now_ts = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE playlists SET updated_at = ?1 WHERE id = ?2",
        (now_ts, &playlist_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// プレイリストからトラックを削除
#[tauri::command]
pub async fn remove_playlist_item(
    playlist_id: String,
    item_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM playlist_items WHERE playlist_id = ?1 AND id = ?2",
        (&playlist_id, &item_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// プレイリスト内の全トラックを削除
#[tauri::command]
pub async fn clear_playlist(
    playlist_id: String,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM playlist_items WHERE playlist_id = ?1",
        [&playlist_id],
    )
    .map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE playlists SET updated_at = ?1 WHERE id = ?2",
        (now, &playlist_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// 複数トラックをプレイリストに追加
#[tauri::command]
pub async fn add_playlist_tracks(
    playlist_id: String,
    track_ids: Vec<String>,
    state: tauri::State<'_, DbState>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut max_pos: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_items WHERE playlist_id = ?1",
            [&playlist_id],
            |r| r.get(0),
        )
        .unwrap_or(0);
    let now = chrono::Utc::now().timestamp();
    for track_id in track_ids {
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO playlist_items (id, playlist_id, track_id, position, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            (&id, &playlist_id, &track_id, max_pos, now),
        )
        .map_err(|e| e.to_string())?;
        max_pos += 1;
    }
    let now_ts = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE playlists SET updated_at = ?1 WHERE id = ?2",
        (now_ts, &playlist_id),
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// ウィンドウタイトルを変更
#[tauri::command]
pub async fn set_window_title(title: String, app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        w.set_title(&title).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// ウィンドウを閉じたときトレイに格納するか
#[tauri::command]
pub async fn get_close_to_tray(app: tauri::AppHandle) -> Result<bool, String> {
    Ok(settings::get_close_to_tray(&app))
}

/// ウィンドウを閉じたときトレイに格納するかを設定
#[tauri::command]
pub async fn set_close_to_tray(enabled: bool, app: tauri::AppHandle) -> Result<(), String> {
    settings::set_close_to_tray(&app, enabled)
}
