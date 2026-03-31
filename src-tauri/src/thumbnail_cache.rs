//! サムネイルのディスクキャッシュ
//!
//! 384x384, JPEG quality 93 (約60-90KB/枚)

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use image::codecs::jpeg::JpegEncoder;
use std::fs;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::io::Cursor;

const THUMB_SIZE: u32 = 384;
const JPEG_QUALITY: u8 = 93;

const CACHE_VERSION: &str = "v4";

fn path_hash(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{}_{:016x}", CACHE_VERSION, hasher.finish())
}

pub fn get_cached_thumbnail(app_data_dir: &std::path::Path, source_path: &str) -> Option<Vec<u8>> {
    let cache_dir = app_data_dir.join("thumbnails");
    let key = path_hash(source_path);
    let cache_path = cache_dir.join(format!("{}.jpg", key));
    fs::read(cache_path).ok()
}

pub fn save_thumbnail(
    app_data_dir: &std::path::Path,
    source_path: &str,
    img: &image::DynamicImage,
) -> Result<Vec<u8>, String> {
    let cache_dir = app_data_dir.join("thumbnails");
    fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let thumb = img.thumbnail(THUMB_SIZE, THUMB_SIZE);
    let mut buf = Vec::new();
    {
        let mut writer = Cursor::new(&mut buf);
        let encoder = JpegEncoder::new_with_quality(&mut writer, JPEG_QUALITY);
        thumb.write_with_encoder(encoder).map_err(|e| e.to_string())?;
    }

    let key = path_hash(source_path);
    let cache_path = cache_dir.join(format!("{}.jpg", key));
    fs::write(&cache_path, &buf).map_err(|e| e.to_string())?;

    Ok(buf)
}

pub fn thumbnail_to_base64(app_data_dir: &std::path::Path, source_path: &str) -> Result<String, String> {
    if source_path.is_empty() {
        return Err("path is empty".to_string());
    }

    let app_dir = app_data_dir.to_path_buf();

    if let Some(cached) = get_cached_thumbnail(&app_dir, source_path) {
        return Ok(BASE64.encode(&cached));
    }

    let img = image::open(source_path).map_err(|e| e.to_string())?;
    let buf = save_thumbnail(&app_dir, source_path, &img)?;
    Ok(BASE64.encode(&buf))
}

/// キャッシュ済みサムネイルのファイルパスを返す（なければ生成してから返す）
pub fn get_thumbnail_file_path(app_data_dir: &std::path::Path, source_path: &str) -> Result<String, String> {
    if source_path.is_empty() {
        return Err("path is empty".to_string());
    }

    let cache_dir = app_data_dir.join("thumbnails");
    let key = path_hash(source_path);
    let cache_path = cache_dir.join(format!("{}.jpg", key));

    if cache_path.exists() {
        return cache_path.to_str().map(String::from).ok_or_else(|| "invalid path".to_string());
    }

    let img = image::open(source_path).map_err(|e| e.to_string())?;
    save_thumbnail(app_data_dir, source_path, &img)?;
    cache_path.to_str().map(String::from).ok_or_else(|| "invalid path".to_string())
}
