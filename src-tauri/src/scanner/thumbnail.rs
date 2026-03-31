//! サムネイル検出
//!
//! 優先順位:
//! 1. thumbnail / thumb / image / images / サムネ / ジャケット フォルダ内
//! 2. 作品フォルダ直下の画像
//! 3. 再帰探索で最初に見つかった画像

use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const THUMB_FOLDER_NAMES: &[&str] = &[
    "thumbnail",
    "thumb",
    "image",
    "images",
    "サムネ",
    "ジャケット",
];

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "webp"];

fn is_image(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| IMAGE_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

/// 作品フォルダからサムネイル画像のパスを検出
pub fn detect_thumbnail(work_dir: &Path) -> Option<PathBuf> {
    // 1. 指定フォルダ名内の画像
    for name in THUMB_FOLDER_NAMES {
        let thumb_dir = work_dir.join(name);
        if thumb_dir.is_dir() {
            if let Some(p) = find_first_image_in_dir(&thumb_dir) {
                return Some(p);
            }
        }
    }

    // 2. 作品フォルダ直下の画像
    if let Some(p) = find_first_image_in_dir(work_dir) {
        return Some(p);
    }

    // 3. 再帰探索（深さ制限付き）
    for entry in WalkDir::new(work_dir)
        .max_depth(5)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let p = entry.path();
        if p.is_file() && is_image(p) {
            return Some(p.to_path_buf());
        }
    }

    None
}

fn find_first_image_in_dir(dir: &Path) -> Option<PathBuf> {
    let mut entries: Vec<_> = std::fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_file() && is_image(p))
        .collect();
    entries.sort();
    entries.into_iter().next()
}

/// 作品フォルダ内の全画像パスを取得（自然順ソート）
pub fn collect_all_images(work_dir: &Path) -> Vec<PathBuf> {
    let mut paths: Vec<PathBuf> = WalkDir::new(work_dir)
        .max_depth(5)
        .into_iter()
        .filter_map(|e| e.ok())
        .map(|e| e.path().to_path_buf())
        .filter(|p| p.is_file() && is_image(p))
        .collect();
    paths.sort();
    paths
}
