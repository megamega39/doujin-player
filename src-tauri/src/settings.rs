//! アプリ設定の永続化（Rust から読み書き）

use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

const SETTINGS_FILE: &str = "app-settings.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppSettings {
    #[serde(default)]
    close_to_tray: bool,
    #[serde(default)]
    window: Option<WindowState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            close_to_tray: false,
            window: None,
        }
    }
}

fn settings_path(app: &tauri::AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .expect("app data dir")
        .join(SETTINGS_FILE)
}

pub fn get_close_to_tray(app: &tauri::AppHandle) -> bool {
    load_settings(app).close_to_tray
}

fn load_settings(app: &tauri::AppHandle) -> AppSettings {
    let path = settings_path(app);
    if !path.exists() {
        return AppSettings::default();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str::<AppSettings>(&s).ok())
        .unwrap_or_default()
}

fn save_settings(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join(SETTINGS_FILE);
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

pub fn get_window_state(app: &tauri::AppHandle) -> Option<WindowState> {
    load_settings(app).window
}

pub fn save_window_state(app: &tauri::AppHandle, state: WindowState) -> Result<(), String> {
    let mut settings = load_settings(app);
    settings.window = Some(state);
    save_settings(app, &settings)
}

pub fn set_close_to_tray(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let mut settings = load_settings(app);
    settings.close_to_tray = enabled;
    save_settings(app, &settings)
}
