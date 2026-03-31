//! 作品・音声バリエーション検出
//!
//! 作品フォルダ内の複数の音声バリエーションを検出する

use crate::scanner::thumbnail;
use lofty::file::AudioFile;
use lofty::read_from_path;
use rayon::prelude::*;
use rusqlite::Connection;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

use chrono::Utc;
use serde::Serialize;
use tauri::Manager;
use uuid::Uuid;

/// スキャン進捗イベントのペイロード
#[derive(Clone, Serialize)]
pub struct ScanProgress {
    pub current: usize,
    pub total: usize,
    pub current_title: String,
}

const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "flac", "m4a", "ogg", "aac", "opus", "mp4", "webm"];

/// SEありを示すフォルダ名の候補
const SE_ON_PATTERNS: &[&str] = &["SEあり", "SE有り", "効果音あり"];

/// SEなしを示すフォルダ名の候補
const SE_OFF_PATTERNS: &[&str] = &["SEなし", "SE無し", "効果音なし"];

/// 形式を示すフォルダ名
const FORMAT_PATTERNS: &[&str] = &["mp3", "wav", "flac", "m4a", "ogg", "aac", "opus", "mp4", "webm"];

/// 音声ファイルの再生時間（秒）を取得する。取得失敗時は None
fn get_audio_duration_sec(path: &Path) -> Option<f64> {
    read_from_path(path)
        .ok()
        .map(|f| f.properties().duration().as_secs_f64())
}

fn is_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| AUDIO_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// 動画ファイル（mp4, webm）かどうか（PV を末尾に並べるために使用）
fn is_video(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| {
            let ext = e.to_lowercase();
            ext == "mp4" || ext == "webm"
        })
        .unwrap_or(false)
}

fn infer_se_mode(path: &Path, work_root: &Path) -> String {
    let rel = path
        .strip_prefix(work_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_lowercase();
    for p in SE_ON_PATTERNS {
        if rel.contains(&p.to_lowercase()) {
            return "se_on".to_string();
        }
    }
    for p in SE_OFF_PATTERNS {
        if rel.contains(&p.to_lowercase()) {
            return "se_off".to_string();
        }
    }
    "unknown".to_string()
}

fn infer_audio_format(path: &Path, work_root: &Path) -> String {
    // フォルダ名から
    let rel = path
        .strip_prefix(work_root)
        .unwrap_or(path)
        .to_string_lossy()
        .to_lowercase();
    for f in FORMAT_PATTERNS {
        if rel.contains(f) {
            return f.to_string();
        }
    }
    // ファイル拡張子から（親がvariantフォルダの場合、最初のファイルで判定）
    "unknown".to_string()
}

/// 数字を正規化（ASCII＋全角数字 → 半角）
fn to_digit_value(c: char) -> Option<u32> {
    if c.is_ascii_digit() {
        Some(c.to_digit(10).unwrap_or(0))
    } else if c >= '０' && c <= '９' {
        Some((c as u32) - '０' as u32)
    } else {
        None
    }
}

/// 自然順ソート用: ファイル名を数値チャンクと文字列チャンクに分割
/// 例: "配信_track10_黒耳" → nums=[10], words=["配信_track", "_黒耳"]
///      "#1.プロローグ" → nums=[1], words=["#", ".プロローグ"]
///      "番外編 擬音" → nums=[], words=["番外編 擬音"]
fn natural_sort_key_simple(s: &str) -> (Vec<i64>, Vec<String>) {
    // 拡張子を除去
    let stem = s.rsplit_once('.').map(|(name, _)| name).unwrap_or(s);

    let mut nums = Vec::new();
    let mut words = Vec::new();
    let mut num = String::new();
    let mut word = String::new();
    for c in stem.chars() {
        if let Some(d) = to_digit_value(c) {
            if !word.is_empty() {
                words.push(std::mem::take(&mut word));
            }
            num.push(char::from_digit(d, 10).unwrap_or('0'));
        } else {
            if !num.is_empty() {
                nums.push(num.parse().unwrap_or(0));
                num.clear();
            }
            word.push(c);
        }
    }
    if !num.is_empty() {
        nums.push(num.parse().unwrap_or(0));
    }
    if !word.is_empty() {
        words.push(word);
    }
    (nums, words)
}

/// ファイルパスの配列をスキャン時の並び順でソートした track_id の順序を返す。
/// reset_track_order で使用。
pub fn sort_track_ids_by_file_path(tracks: &[(String, String)]) -> Vec<String> {
    let mut with_path: Vec<_> = tracks
        .iter()
        .map(|(id, fp)| (id.clone(), std::path::Path::new(fp)))
        .collect();
    with_path.sort_by(|(_, a), (_, b)| {
        let a_video = is_video(a);
        let b_video = is_video(b);
        match (a_video, b_video) {
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            _ => {
                let sa = a.file_name().and_then(|n| n.to_str()).unwrap_or("");
                let sb = b.file_name().and_then(|n| n.to_str()).unwrap_or("");

                let a_extra = is_extra_track(sa);
                let b_extra = is_extra_track(sb);
                match (a_extra, b_extra) {
                    (true, false) => return std::cmp::Ordering::Greater,
                    (false, true) => return std::cmp::Ordering::Less,
                    _ => {}
                }

                let (na, wa) = natural_sort_key_simple(sa);
                let (nb, wb) = natural_sort_key_simple(sb);
                match (na.is_empty(), nb.is_empty()) {
                    (true, false) => std::cmp::Ordering::Greater,
                    (false, true) => std::cmp::Ordering::Less,
                    _ => na.cmp(&nb).then_with(|| wa.cmp(&wb)),
                }
            }
        }
    });
    with_path.into_iter().map(|(id, _)| id).collect()
}

/// おまけ/EX/bonus トラックかどうか（末尾に並べる）
fn is_extra_track(name: &str) -> bool {
    let lower = name.to_lowercase();
    // 拡張子を除いたファイル名で判定
    let stem = lower.rsplit_once('.').map(|(s, _)| s).unwrap_or(&lower);
    // "EX" で始まる or "#EX" を含む（"セクシー" 等を誤検出しない）
    let has_ex = stem.starts_with("ex") || stem.starts_with("#ex") || stem.contains("_ex") || stem.contains(" ex");
    has_ex
        || stem.contains("おまけ")
        || stem.contains("番外")
        || stem.contains("フリートーク")
        || stem.starts_with("bonus")
        || stem.contains("_bonus")
        || stem.starts_with("extra")
        || stem.contains("_extra")
}

fn sort_tracks_naturally_fixed(paths: &mut [PathBuf]) {
    paths.sort_by(|a, b| {
        // 動画（mp4, webm）は音声の後にまとめる
        let a_video = is_video(a);
        let b_video = is_video(b);
        match (a_video, b_video) {
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            _ => {
                let sa = a.file_name().and_then(|n| n.to_str()).unwrap_or("");
                let sb = b.file_name().and_then(|n| n.to_str()).unwrap_or("");

                // おまけ/EXトラックは末尾に
                let a_extra = is_extra_track(sa);
                let b_extra = is_extra_track(sb);
                match (a_extra, b_extra) {
                    (true, false) => return std::cmp::Ordering::Greater,
                    (false, true) => return std::cmp::Ordering::Less,
                    _ => {}
                }

                let (na, wa) = natural_sort_key_simple(sa);
                let (nb, wb) = natural_sort_key_simple(sb);
                match (na.is_empty(), nb.is_empty()) {
                    (true, false) => std::cmp::Ordering::Greater,
                    (false, true) => std::cmp::Ordering::Less,
                    _ => na.cmp(&nb).then_with(|| wa.cmp(&wb)),
                }
            }
        }
    });
}

/// 1つの親フォルダ配下の音声ファイル群 = 1つの AudioVariant 候補
#[derive(Debug, Clone)]
pub struct AudioVariantCandidate {
    pub folder_path: PathBuf,
    pub tracks: Vec<PathBuf>,
    pub se_mode: String,
    pub audio_format: String,
    pub label: String,
}

/// 進捗イベント付きスキャン
pub fn scan_library_root_with_progress(
    conn: &Connection,
    root: &Path,
    app_handle: Option<&tauri::AppHandle>,
) -> Result<usize, String> {
    let app_data_dir = app_handle.and_then(|app| {
        app.path().app_data_dir().ok()
    });
    conn.execute("BEGIN IMMEDIATE", [])
        .map_err(|e| e.to_string())?;
    let result = scan_library_root_impl(conn, root, app_handle, app_data_dir.as_deref());
    if result.is_err() {
        let _ = conn.execute("ROLLBACK", []);
    } else {
        conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    }
    result
}

/// 作品候補フォルダを事前に収集（進捗の total 計算用）
fn collect_work_folders(root: &Path) -> Vec<(PathBuf, Vec<AudioVariantCandidate>)> {
    let mut result = Vec::new();
    let mut to_scan = vec![root.to_path_buf()];
    while let Some(path) = to_scan.pop() {
        let children = match std::fs::read_dir(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        for entry in children.filter_map(|e| e.ok()) {
            let child_path = entry.path();
            if !child_path.is_dir() {
                continue;
            }
            let variants = detect_audio_variants(&child_path);
            if variants.is_empty() {
                to_scan.push(child_path);
            } else {
                result.push((child_path, variants));
            }
        }
    }
    result
}

fn emit_progress(app_handle: Option<&tauri::AppHandle>, current: usize, total: usize, title: &str) {
    if let Some(app) = app_handle {
        use tauri::Emitter;
        let _ = app.emit("scan-progress", ScanProgress {
            current,
            total,
            current_title: title.to_string(),
        });
    }
}

fn scan_library_root_impl(
    conn: &Connection,
    root: &Path,
    app_handle: Option<&tauri::AppHandle>,
    app_data_dir: Option<&Path>,
) -> Result<usize, String> {
    let now = Utc::now().timestamp();

    let work_folders = collect_work_folders(root);
    let total = work_folders.len();
    let mut works_added = 0;

    // サムネイルパスを収集してスキャン後にバックグラウンドで一括キャッシュ生成
    let mut thumbnail_paths: Vec<String> = Vec::new();

    for (idx, (child_path, variants)) in work_folders.into_iter().enumerate() {
        let title = child_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        emit_progress(app_handle, idx + 1, total, &title);

        let folder_path = child_path.to_str().unwrap_or("");
        let thumbnail_path = thumbnail::detect_thumbnail(&child_path).and_then(|p| p.to_str().map(String::from));
        if let Some(ref tp) = thumbnail_path {
            thumbnail_paths.push(tp.clone());
        }

        let work_id: String = conn
            .query_row(
                "SELECT id FROM works WHERE folder_path = ?1",
                [folder_path],
                |row| row.get(0),
            )
            .ok()
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        // 既存の variant を folder_path → id でマップ
        let mut existing_variants: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        {
            let mut stmt = conn.prepare(
                "SELECT id, folder_path FROM audio_variants WHERE work_id = ?1"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map([&work_id], |row| {
                Ok((row.get::<_, String>(1)?, row.get::<_, String>(0)?))
            }).map_err(|e| e.to_string())?;
            for row in rows {
                let (fp, id) = row.map_err(|e| e.to_string())?;
                existing_variants.insert(fp, id);
            }
        }

        // 既存の track を file_path → id でマップ
        let mut existing_tracks: std::collections::HashMap<String, String> = std::collections::HashMap::new();
        {
            let mut stmt = conn.prepare(
                "SELECT t.id, t.file_path FROM tracks t JOIN audio_variants v ON v.id = t.variant_id WHERE v.work_id = ?1"
            ).map_err(|e| e.to_string())?;
            let rows = stmt.query_map([&work_id], |row| {
                Ok((row.get::<_, String>(1)?, row.get::<_, String>(0)?))
            }).map_err(|e| e.to_string())?;
            for row in rows {
                let (fp, id) = row.map_err(|e| e.to_string())?;
                existing_tracks.insert(fp, id);
            }
        }

        // works を upsert（is_favorite, created_at を保持、thumbnail は検出結果優先・なければ既存維持）
        conn.execute(
            "INSERT INTO works (id, title, folder_path, thumbnail_path, is_favorite, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5)
             ON CONFLICT(id) DO UPDATE SET title = excluded.title, folder_path = excluded.folder_path, thumbnail_path = COALESCE(excluded.thumbnail_path, works.thumbnail_path)",
            (&work_id, &title, folder_path, thumbnail_path.as_deref(), now),
        )
        .map_err(|e| e.to_string())?;

        let mut seen_variant_ids: Vec<String> = Vec::new();
        let mut seen_track_ids: Vec<String> = Vec::new();

        let mut is_first = true;
        for v in variants {
            let label = v.label;
            let v_folder_path = v.folder_path.to_str().unwrap_or("").to_string();
            let is_default = if is_first { 1 } else { 0 };
            is_first = false;

            let variant_id = existing_variants.get(&v_folder_path)
                .cloned()
                .unwrap_or_else(|| Uuid::new_v4().to_string());
            seen_variant_ids.push(variant_id.clone());

            let track_count = v.tracks.len() as i32;

            conn.execute(
                "INSERT INTO audio_variants (id, work_id, label, folder_path, se_mode, audio_format, is_default, track_count, total_duration_sec, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                 ON CONFLICT(id) DO UPDATE SET label = excluded.label, folder_path = excluded.folder_path, se_mode = excluded.se_mode, audio_format = excluded.audio_format, is_default = excluded.is_default, track_count = excluded.track_count",
                (&variant_id, &work_id, &label, &v_folder_path, &v.se_mode, &v.audio_format, is_default, track_count, 0.0_f64, now),
            )
            .map_err(|e| e.to_string())?;

            let mut sorted_tracks = v.tracks.clone();
            sort_tracks_naturally_fixed(&mut sorted_tracks);
            let durations: Vec<Option<f64>> = sorted_tracks
                .par_iter()
                .map(|p| get_audio_duration_sec(p))
                .collect();
            let total_duration_sec: f64 = durations.iter().filter_map(|d| *d).sum();
            for (i, track_path) in sorted_tracks.iter().enumerate() {
                let file_path = track_path.to_str().unwrap_or("").to_string();
                let track_title = track_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Track")
                    .to_string();
                let track_no = (i + 1) as i32;
                let duration_sec = durations.get(i).copied().flatten();

                let track_id = existing_tracks.get(&file_path)
                    .cloned()
                    .unwrap_or_else(|| Uuid::new_v4().to_string());
                seen_track_ids.push(track_id.clone());

                if existing_tracks.contains_key(&file_path) {
                    // 既存トラック: メタデータのみ更新（play_count, last_position_sec, is_favorite を保持）
                    conn.execute(
                        "UPDATE tracks SET variant_id = ?1, title = ?2, track_no = ?3, duration_sec = ?4 WHERE id = ?5",
                        (&variant_id, &track_title, track_no, duration_sec, &track_id),
                    )
                    .map_err(|e| e.to_string())?;
                } else {
                    // 新規トラック
                    conn.execute(
                        "INSERT INTO tracks (id, variant_id, title, file_path, track_no, duration_sec, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        (&track_id, &variant_id, &track_title, &file_path, track_no, duration_sec, now),
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
            conn.execute(
                "UPDATE audio_variants SET total_duration_sec = ?1 WHERE id = ?2",
                (total_duration_sec, &variant_id),
            )
            .map_err(|e| e.to_string())?;
        }

        // ディスクに存在しないトラックを削除（CASCADE で playlist_items, loop_segments も削除）
        for tid in existing_tracks.values() {
            if !seen_track_ids.contains(tid) {
                conn.execute("DELETE FROM tracks WHERE id = ?1", [tid])
                    .map_err(|e| e.to_string())?;
            }
        }
        // ディスクに存在しないバリアントを削除（CASCADE で残りのトラックも削除）
        for vid in existing_variants.values() {
            if !seen_variant_ids.contains(vid) {
                conn.execute("DELETE FROM audio_variants WHERE id = ?1", [vid])
                    .map_err(|e| e.to_string())?;
            }
        }

        works_added += 1;
    }

    // サムネイルキャッシュをバックグラウンドで一括生成（並列処理）
    if let Some(data_dir) = app_data_dir {
        use crate::thumbnail_cache;
        let data_dir = data_dir.to_path_buf();
        thumbnail_paths.par_iter().for_each(|tp| {
            let _ = thumbnail_cache::get_thumbnail_file_path(&data_dir, tp);
        });
    }

    Ok(works_added)
}

/// ディレクトリ配下に音声ファイルが存在するか
fn dir_contains_audio(path: &Path) -> bool {
    WalkDir::new(path)
        .max_depth(15)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
        .any(|e| e.path().is_file() && is_audio(e.path()))
}

/// 作品フォルダ内の音声バリエーションを検出
/// フォルダ分岐がある場合（01_本編/01_SEあり, 02_SEなし など）は各分岐を別バリエーションとする
/// ラベルは「親 > 子」形式（例: 01_本編『音源』 > 01_SEあり）
fn detect_audio_variants(work_dir: &Path) -> Vec<AudioVariantCandidate> {
    collect_variant_candidates(work_dir, work_dir)
}

/// フォルダ直下の音声ファイルのみを収集（サブフォルダは含めない）
fn collect_direct_audio_files(dir: &Path) -> Vec<PathBuf> {
    let mut tracks = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.filter_map(|e| e.ok()) {
            let p = e.path();
            if p.is_file() && is_audio(&p) {
                tracks.push(p);
            }
        }
    }
    tracks
}

/// 再帰的にバリエーション候補を収集
/// 直下に音声がある場合はそれも1バリエーション、子フォルダに音声がある場合はその子も別バリエーション
fn collect_variant_candidates(work_dir: &Path, current_dir: &Path) -> Vec<AudioVariantCandidate> {
    let mut candidates = Vec::new();

    // 直下の音声ファイルがあればバリエーションとして追加
    let mut direct_tracks = collect_direct_audio_files(current_dir);
    if !direct_tracks.is_empty() {
        sort_tracks_naturally_fixed(&mut direct_tracks);
        let se_mode = infer_se_mode(current_dir, work_dir);
        let audio_format = infer_audio_format(current_dir, work_dir);
        let label = format_label_hierarchical(current_dir, work_dir, &se_mode, &audio_format);
        candidates.push(AudioVariantCandidate {
            folder_path: current_dir.to_path_buf(),
            tracks: direct_tracks,
            se_mode,
            audio_format,
            label,
        });
    }

    let children = match std::fs::read_dir(current_dir) {
        Ok(c) => c,
        Err(_) => return candidates,
    };

    let subdir_paths: Vec<PathBuf> = children
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .collect();
    let mut subdirs: Vec<PathBuf> = subdir_paths
        .par_iter()
        .filter(|p| dir_contains_audio(p))
        .cloned()
        .collect();

    subdirs.sort_by(|a, b| {
        let sa = a.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let sb = b.file_name().and_then(|n| n.to_str()).unwrap_or("");
        (natural_sort_key_simple(sa), sa).cmp(&(natural_sort_key_simple(sb), sb))
    });

    for subdir in subdirs {
        let child_dirs: Vec<PathBuf> = std::fs::read_dir(&subdir)
            .map(|c| {
                c.filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| p.is_dir())
                    .collect()
            })
            .unwrap_or_default();
        let has_audio_subdirs = child_dirs
            .par_iter()
            .any(|p| dir_contains_audio(p));

        if has_audio_subdirs {
            candidates.extend(collect_variant_candidates(work_dir, &subdir));
        } else {
            let tracks: Vec<PathBuf> = WalkDir::new(&subdir)
                .max_depth(15)
                .follow_links(true)
                .into_iter()
                .filter_map(|e| e.ok())
                .map(|e| e.path().to_path_buf())
                .filter(|p| p.is_file() && is_audio(p))
                .collect();

            if tracks.is_empty() {
                continue;
            }

            let mut sorted_tracks = tracks;
            sort_tracks_naturally_fixed(&mut sorted_tracks);

            let se_mode = infer_se_mode(&subdir, work_dir);
            let audio_format = infer_audio_format(&subdir, work_dir);
            let label = format_label_hierarchical(&subdir, work_dir, &se_mode, &audio_format);

            candidates.push(AudioVariantCandidate {
                folder_path: subdir,
                tracks: sorted_tracks,
                se_mode,
                audio_format,
                label,
            });
        }
    }

    candidates
}

/// 階層パスを「親 > 子」形式でラベル化
/// フォルダ直下に音声がある場合（work_root と同じ）は「音声」を返す
fn format_label_hierarchical(
    folder_path: &Path,
    work_root: &Path,
    se_mode: &str,
    audio_format: &str,
) -> String {
    // フォルダ直下の音声（バリエーション＝作品フォルダ自体）の場合は「音声」
    if folder_path == work_root {
        return "音声".to_string();
    }

    let rel = folder_path
        .strip_prefix(work_root)
        .unwrap_or(folder_path)
        .to_string_lossy();
    let parts: Vec<&str> = rel
        .split(std::path::MAIN_SEPARATOR)
        .filter(|s| !s.is_empty() && *s != ".")
        .collect();

    let path_label = if parts.len() > 1 {
        parts.join(" > ")
    } else if !parts.is_empty() {
        parts[0].to_string()
    } else {
        String::new()
    };

    if !path_label.is_empty() {
        path_label
    } else {
        format_label(folder_path, work_root, se_mode, audio_format)
    }
}

fn format_label(
    folder_path: &Path,
    work_root: &Path,
    se_mode: &str,
    audio_format: &str,
) -> String {
    let rel = folder_path
        .strip_prefix(work_root)
        .unwrap_or(folder_path)
        .to_string_lossy();
    let parts: Vec<&str> = rel.split(std::path::MAIN_SEPARATOR).collect();
    let mut labels: Vec<String> = Vec::new();
    if se_mode != "unknown" {
        labels.push(if se_mode == "se_on" {
            "SEあり".to_string()
        } else {
            "SEなし".to_string()
        });
    }
    if audio_format != "unknown" {
        labels.push(audio_format.to_uppercase());
    }
    if labels.is_empty() && !parts.is_empty() {
        labels.push(parts.last().unwrap_or(&"").to_string());
    }
    if labels.is_empty() {
        "音声".to_string()
    } else {
        labels.join(" / ")
    }
}
