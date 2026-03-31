//! SQLite データベースモジュール

mod schema;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

/// アプリデータディレクトリ内のDBファイルパスを返す
pub fn db_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    Ok(app_dir.join("doujin_player.db"))
}

/// DB接続を初期化し、マイグレーションを実行
pub fn init_db(app_handle: &tauri::AppHandle) -> Result<Connection, String> {
    let path = db_path(app_handle)?;
    let conn = Connection::open(&path).map_err(|e| e.to_string())?;
    // マイグレーション中はテーブル再作成のため外部キーを無効にしておく
    schema::run_migrations(&conn)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;").map_err(|e| e.to_string())?;
    Ok(conn)
}

/// 接続をラップした型（Tauri state用）
pub struct DbState(pub Mutex<Connection>);
