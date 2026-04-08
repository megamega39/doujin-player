use tauri::{AppHandle, Emitter};
use windows::Win32::Graphics::Gdi::{
    CreateBitmap, CreateCompatibleDC, DeleteDC, DeleteObject,
};
use windows::Win32::UI::Shell::{
    ITaskbarList3, TaskbarList, THUMBBUTTON,
    THB_FLAGS, THB_ICON, THBF_ENABLED,
    SetWindowSubclass, DefSubclassProc,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateIconIndirect, ICONINFO, HICON, WM_COMMAND,
};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED};
use std::sync::{Mutex, OnceLock};

const BTN_PREV: u32 = 0;
const BTN_PLAY: u32 = 1;
const BTN_NEXT: u32 = 2;
const SUBCLASS_ID: usize = 1;

static TASKBAR: OnceLock<Mutex<Option<TaskbarState>>> = OnceLock::new();

struct TaskbarState {
    taskbar: ITaskbarList3,
    hwnd: windows::Win32::Foundation::HWND,
    icon_prev: HICON,
    icon_play: HICON,
    icon_pause: HICON,
    icon_next: HICON,
}

// Safety: ITaskbarList3 COM pointers are thread-safe for our usage
// (all calls happen on the main thread or are serialized via Mutex)
unsafe impl Send for TaskbarState {}
unsafe impl Sync for TaskbarState {}

/// Create a simple 16x16 icon from a pixel drawing function
fn create_icon_16x16(draw: impl Fn(u32, u32) -> bool) -> HICON {
    let size: u32 = 16;
    let mut color_bits = vec![0u8; (size * size * 4) as usize];
    let mut mask_bits = vec![0xFFu8; (size * size / 8) as usize];

    for y in 0..size {
        for x in 0..size {
            if draw(x, y) {
                let idx = ((size - 1 - y) * size + x) as usize * 4; // bottom-up
                color_bits[idx] = 255;     // B
                color_bits[idx + 1] = 255; // G
                color_bits[idx + 2] = 255; // R
                color_bits[idx + 3] = 255; // A

                let mask_row = (size - 1 - y) as usize;
                let mask_byte = mask_row * (size as usize / 8) + (x as usize / 8);
                let mask_bit = 7 - (x % 8);
                mask_bits[mask_byte] &= !(1 << mask_bit);
            }
        }
    }

    unsafe {
        let hdc = CreateCompatibleDC(None);
        let hbm_color = CreateBitmap(size as i32, size as i32, 1, 32, Some(color_bits.as_ptr() as *const _));
        let hbm_mask = CreateBitmap(size as i32, size as i32, 1, 1, Some(mask_bits.as_ptr() as *const _));

        let mut ii = ICONINFO {
            fIcon: true.into(),
            xHotspot: 0,
            yHotspot: 0,
            hbmMask: hbm_mask,
            hbmColor: hbm_color,
        };

        let icon = CreateIconIndirect(&mut ii).unwrap_or_default();

        let _ = DeleteObject(hbm_color);
        let _ = DeleteObject(hbm_mask);
        let _ = DeleteDC(hdc);

        icon
    }
}

/// ⏮ Previous track icon (bar + two left-pointing triangles ◀◀|)
fn create_prev_icon() -> HICON {
    create_icon_16x16(|x, y| {
        let cx = x as i32;
        let cy = y as i32 - 8;
        // Left bar
        if cx >= 2 && cx <= 3 && cy.abs() <= 5 {
            return true;
        }
        // First ◀ (tip at x=4, base at x=9)
        if cx >= 4 && cx <= 9 && cy.abs() <= (cx - 4) {
            return true;
        }
        // Second ◀ (tip at x=9, base at x=14)
        if cx >= 9 && cx <= 14 && cy.abs() <= (cx - 9) {
            return true;
        }
        false
    })
}

/// ▶ Play icon (right-pointing triangle)
fn create_play_icon() -> HICON {
    create_icon_16x16(|x, y| {
        let cx = x as i32 - 5;
        let cy = (y as i32 - 8).abs();
        cx >= 0 && cx <= 7 && cy <= (7 - cx)
    })
}

/// ⏸ Pause icon (two vertical bars)
fn create_pause_icon() -> HICON {
    create_icon_16x16(|x, y| {
        let cy = y as i32;
        if cy < 3 || cy > 12 { return false; }
        (x >= 4 && x <= 6) || (x >= 9 && x <= 11)
    })
}

/// ⏭ Next track icon (two right-pointing triangles + bar ▶▶|)
fn create_next_icon() -> HICON {
    create_icon_16x16(|x, y| {
        let cx = x as i32;
        let cy = y as i32 - 8;
        // First ▶ (base at x=2, tip at x=7)
        if cx >= 2 && cx <= 7 && cy.abs() <= (7 - cx) {
            return true;
        }
        // Second ▶ (base at x=7, tip at x=12)
        if cx >= 7 && cx <= 12 && cy.abs() <= (12 - cx) {
            return true;
        }
        // Right bar
        if cx >= 12 && cx <= 13 && cy.abs() <= 5 {
            return true;
        }
        false
    })
}

/// Window subclass procedure to intercept thumbnail button clicks
unsafe extern "system" fn subclass_proc(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
    _uid: usize,
    data: usize,
) -> windows::Win32::Foundation::LRESULT {
    if msg == WM_COMMAND {
        let btn_id = (wparam.0 & 0xFFFF) as u32;
        let app_ptr = data as *const AppHandle;
        if !app_ptr.is_null() {
            let app = &*app_ptr;
            let cmd = match btn_id {
                BTN_PREV => Some("prev"),
                BTN_PLAY => Some("play-pause"),
                BTN_NEXT => Some("next"),
                _ => None,
            };
            if let Some(cmd) = cmd {
                let _ = app.emit("thumbbar-command", cmd);
            }
        }
    }
    DefSubclassProc(hwnd, msg, wparam, lparam)
}

pub fn setup_thumbbar(window: &tauri::WebviewWindow, app_handle: AppHandle) {
    let hwnd_raw = window.hwnd().expect("Failed to get HWND");
    let hwnd = windows::Win32::Foundation::HWND(hwnd_raw.0);

    // Leak app_handle so it lives for the duration of the process
    let app_ptr = Box::into_raw(Box::new(app_handle));

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

        let taskbar: ITaskbarList3 = match CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[thumbbar] CoCreateInstance failed: {:?}", e);
                return;
            }
        };

        let icon_prev = create_prev_icon();
        let icon_play = create_play_icon();
        let icon_pause = create_pause_icon();
        let icon_next = create_next_icon();

        let buttons = [
            THUMBBUTTON {
                dwMask: THB_ICON | THB_FLAGS,
                iId: BTN_PREV,
                hIcon: icon_prev,
                dwFlags: THBF_ENABLED,
                ..Default::default()
            },
            THUMBBUTTON {
                dwMask: THB_ICON | THB_FLAGS,
                iId: BTN_PLAY,
                hIcon: icon_play,
                dwFlags: THBF_ENABLED,
                ..Default::default()
            },
            THUMBBUTTON {
                dwMask: THB_ICON | THB_FLAGS,
                iId: BTN_NEXT,
                hIcon: icon_next,
                dwFlags: THBF_ENABLED,
                ..Default::default()
            },
        ];

        if let Err(e) = taskbar.ThumbBarAddButtons(hwnd, &buttons) {
            eprintln!("[thumbbar] ThumbBarAddButtons failed: {:?}", e);
            return;
        }

        // Install subclass to receive WM_COMMAND
        let _ = SetWindowSubclass(hwnd, Some(subclass_proc), SUBCLASS_ID, app_ptr as usize);

        let state = TaskbarState {
            taskbar,
            hwnd,
            icon_prev,
            icon_play,
            icon_pause,
            icon_next,
        };

        let lock = TASKBAR.get_or_init(|| Mutex::new(None));
        *lock.lock().unwrap() = Some(state);

        eprintln!("[thumbbar] setup complete");
    }
}

pub fn update_playing_state(is_playing: bool) {
    let Some(lock) = TASKBAR.get() else { return };
    let guard = lock.lock().unwrap();
    let Some(state) = guard.as_ref() else { return };

    unsafe {
        let icon = if is_playing { state.icon_pause } else { state.icon_play };
        let button = THUMBBUTTON {
            dwMask: THB_ICON | THB_FLAGS,
            iId: BTN_PLAY,
            hIcon: icon,
            dwFlags: THBF_ENABLED,
            ..Default::default()
        };
        let _ = state.taskbar.ThumbBarUpdateButtons(state.hwnd, &[button]);
    }
}
