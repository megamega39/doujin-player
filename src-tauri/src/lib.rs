mod commands;
mod db;
mod scanner;
mod settings;
mod thumbnail_cache;
#[cfg(windows)]
mod thumbbar;

use tauri::Manager;
use tauri::menu::MenuBuilder;
use tauri::tray::TrayIconBuilder;
use db::{init_db, DbState};
use commands::*;

const TRAY_ICON: tauri::image::Image<'static> = tauri::include_image!("icons/32x32.png");
const APP_ICON: tauri::image::Image<'static> = tauri::include_image!("icons/32x32.png");

fn setup_tray(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let menu = MenuBuilder::new(app)
        .text("show", "開く")
        .text("quit", "終了")
        .build()?;

    let _tray = TrayIconBuilder::new()
        .icon(TRAY_ICON)
        .tooltip("同人音声プレイヤー")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| {
            match event.id.0.as_str() {
                "show" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.set_focus();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(move |tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg(windows)]
#[tauri::command]
fn update_thumbbar_playing_state(is_playing: bool) {
    thumbbar::update_playing_state(is_playing);
}

#[cfg(windows)]
#[tauri::command]
async fn update_thumbbar_thumbnail(thumbnail_path: Option<String>, title: String) {
    tauri::async_runtime::spawn_blocking(move || {
        thumbbar::update_thumbnail(thumbnail_path.as_deref(), &title);
    }).await.ok();
}

fn save_window_state_from_window(window: &tauri::Window) {
    let Ok(maximized) = window.is_maximized() else { return };
    // 最大化中は位置・サイズを保存しない（復元時に最大化フラグで対応）
    if maximized {
        let _ = settings::save_window_state(
            &window.app_handle(),
            settings::WindowState { x: 0, y: 0, width: 800, height: 600, maximized: true },
        );
        return;
    }
    let Ok(pos) = window.outer_position() else { return };
    let Ok(size) = window.outer_size() else { return };
    let _ = settings::save_window_state(
        &window.app_handle(),
        settings::WindowState {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
            maximized: false,
        },
    );
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let conn = init_db(&app.handle())?;
            app.manage(DbState(std::sync::Mutex::new(conn)));
            let _ = setup_tray(&app.handle());

            // ウィンドウアイコンを明示的に設定
            if let Some(w) = app.get_webview_window("main") {
                match w.set_icon(APP_ICON) {
                    Ok(_) => eprintln!("[icon] set_icon OK"),
                    Err(e) => eprintln!("[icon] set_icon FAILED: {:?}", e),
                }
            } else {
                eprintln!("[icon] main window not found");
            }

            // サムネイルツールバー（タスクバーのメディアコントロール）
            #[cfg(windows)]
            if let Some(w) = app.get_webview_window("main") {
                thumbbar::setup_thumbbar(&w, app.handle().clone());
            }

            // ウィンドウサイズ・位置を復元（保存サイズが十分大きい場合のみ）
            if let Some(ws) = settings::get_window_state(&app.handle()) {
                if let Some(w) = app.get_webview_window("main") {
                    use tauri::PhysicalPosition;
                    use tauri::PhysicalSize;

                    // 保存サイズが小さすぎる場合はデフォルト(1280x800)を使う
                    let width = if ws.width >= 800 { ws.width } else { 1280 };
                    let height = if ws.height >= 600 { ws.height } else { 800 };
                    let _ = w.set_size(PhysicalSize::new(width, height));

                    if ws.maximized {
                        let _ = w.maximize();
                    } else {
                        // モニター範囲内かチェック
                        let monitors = w.available_monitors().unwrap_or_default();
                        // ウィンドウの左上が少なくともモニター内にあるかチェック
                        let in_bounds = monitors.iter().any(|m| {
                            let mp = m.position();
                            let ms = m.size();
                            let margin = 100; // 少なくとも100pxはモニター内
                            ws.x >= mp.x
                                && ws.y >= mp.y
                                && ws.x + margin < mp.x + ms.width as i32
                                && ws.y + margin < mp.y + ms.height as i32
                        });
                        if in_bounds {
                            let _ = w.set_position(PhysicalPosition::new(ws.x, ws.y));
                        }
                        // 範囲外ならデフォルト位置のまま（中央寄せ）
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_library_roots,
            scan_library,
            remove_library_root,
            rescan_library,
            get_works,
            search_works,
            get_works_filtered,
            get_recent_works,
            get_work_detail,
            get_tracks,
            reorder_tracks,
            reset_track_order,
            get_most_played_tracks,
            check_tracks_exist,
            get_loop_segments,
            save_loop_segment,
            delete_loop_segment,
            update_loop_segment_name,
            save_playback_position,
            increment_play_count,
            get_tags,
            get_works_by_tag,
            get_work_tags,
            add_work_tag,
            remove_work_tag,
            get_voice_actors,
            get_works_by_voice_actor,
            get_work_voice_actors,
            add_work_voice_actor,
            remove_work_voice_actor,
            get_circles,
            get_works_by_circle,
            get_work_circles,
            add_work_circle,
            remove_work_circle,
            toggle_favorite,
            toggle_track_favorite,
            get_favorite_tracks,
            set_work_thumbnail,
            get_thumbnail_base64,
            get_thumbnail_path,
            get_work_images,
            get_playlists,
            create_playlist,
            update_playlist,
            delete_playlist,
            reorder_playlists,
            get_playlist_tracks,
            add_playlist_track,
            add_playlist_tracks,
            remove_playlist_item,
            clear_playlist,
            reorder_playlist_items,
            set_window_title,
            get_close_to_tray,
            set_close_to_tray,
            update_thumbbar_playing_state,
            update_thumbbar_thumbnail,
        ])
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // 閉じる前にウィンドウ状態を保存
                    save_window_state_from_window(window);
                    if settings::get_close_to_tray(&window.app_handle()) {
                        let _ = window.hide();
                        api.prevent_close();
                    }
                }
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                    save_window_state_from_window(window);
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
