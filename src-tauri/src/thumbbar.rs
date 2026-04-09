use tauri::{AppHandle, Emitter};
use windows::Win32::Graphics::Gdi::{
    CreateBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, HBITMAP,
    CreateDIBSection, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, BI_RGB,
};
use windows::Win32::Graphics::Dwm::{
    DwmSetIconicThumbnail, DwmInvalidateIconicBitmaps,
    DwmSetWindowAttribute, DWMWA_HAS_ICONIC_BITMAP, DWMWA_FORCE_ICONIC_REPRESENTATION,
};
use windows::Win32::UI::Shell::{
    ITaskbarList3, TaskbarList, THUMBBUTTON,
    THB_FLAGS, THB_ICON, THBF_ENABLED,
    SetWindowSubclass, DefSubclassProc,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreateIconIndirect, ICONINFO, HICON, WM_COMMAND,
    WM_DWMSENDICONICTHUMBNAIL,
};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED};
use windows::core::PCWSTR;
use std::sync::{Mutex, OnceLock};

const BTN_PREV: u32 = 0;
const BTN_PLAY: u32 = 1;
const BTN_NEXT: u32 = 2;
const SUBCLASS_ID: usize = 1;

static TASKBAR: OnceLock<Mutex<Option<TaskbarState>>> = OnceLock::new();
// Store raw pixel data (BGRA, width x height) for on-demand bitmap creation
static THUMBNAIL_PIXELS: OnceLock<Mutex<Option<ThumbnailData>>> = OnceLock::new();

struct ThumbnailData {
    pixels: Vec<u8>,
    width: u32,
    height: u32,
}

#[allow(dead_code)] // HICON fields retained to prevent resource leak
struct TaskbarState {
    taskbar: ITaskbarList3,
    hwnd: windows::Win32::Foundation::HWND,
    icon_prev: HICON,
    icon_play: HICON,
    icon_pause: HICON,
    icon_next: HICON,
}

// Safety: TaskbarState fields (ITaskbarList3, HWND, HICON) are Windows handles
// that are valid for the process lifetime. Access is serialized via Mutex.
// Note: ITaskbarList3 is STA COM but Tauri commands may call from worker threads.
// This is acceptable for taskbar operations which are fire-and-forget UI updates.
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
    } else if msg == WM_DWMSENDICONICTHUMBNAIL {
        // Windows requests the iconic thumbnail; only respond if we have pixel data
        let has_bmp = THUMBNAIL_PIXELS.get()
            .and_then(|lock| lock.lock().ok())
            .map(|g| g.is_some())
            .unwrap_or(false);
        if has_bmp {
            let max_w = lparam.0 & 0xFFFF;           // LOWORD = width
            let max_h = (lparam.0 >> 16) & 0xFFFF; // HIWORD = height
            send_iconic_thumbnail(hwnd, max_w as u32, max_h as u32);
            return windows::Win32::Foundation::LRESULT(0);
        }
        // No bitmap: fall through to DefSubclassProc for normal live preview
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
            use windows::Win32::UI::WindowsAndMessaging::DestroyIcon;
            let _ = DestroyIcon(icon_prev);
            let _ = DestroyIcon(icon_play);
            let _ = DestroyIcon(icon_pause);
            let _ = DestroyIcon(icon_next);
            return;
        }

        // Enable iconic bitmap (custom thumbnail when available, live preview as fallback)
        let val: i32 = 1;
        let _ = DwmSetWindowAttribute(hwnd, DWMWA_HAS_ICONIC_BITMAP, &val as *const _ as *const _, 4);

        // Install subclass to receive WM_COMMAND and WM_DWMSENDICONICTHUMBNAIL
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

/// Send the stored thumbnail bitmap to DWM when requested
fn send_iconic_thumbnail(hwnd: windows::Win32::Foundation::HWND, max_w: u32, max_h: u32) {
    let lock = THUMBNAIL_PIXELS.get_or_init(|| Mutex::new(None));
    let guard = lock.lock().unwrap();
    let Some(data) = guard.as_ref() else { return };

    // Scale to fit within max dimensions while maintaining aspect ratio
    let scale_w = if max_w > 0 && data.width > max_w { max_w as f32 / data.width as f32 } else { 1.0 };
    let scale_h = if max_h > 0 && data.height > max_h { max_h as f32 / data.height as f32 } else { 1.0 };
    let scale = scale_w.min(scale_h);
    let out_w = ((data.width as f32 * scale) as u32).max(1);
    let out_h = ((data.height as f32 * scale) as u32).max(1);

    // Simple nearest-neighbor downscale
    let mut scaled = vec![0u8; (out_w * out_h * 4) as usize];
    for y in 0..out_h {
        for x in 0..out_w {
            let sx = ((x as f32 / scale) as u32).min(data.width - 1);
            let sy = ((y as f32 / scale) as u32).min(data.height - 1);
            let si = (sy * data.width + sx) as usize * 4;
            let di = (y * out_w + x) as usize * 4;
            scaled[di..di + 4].copy_from_slice(&data.pixels[si..si + 4]);
        }
    }

    if let Some(hbmp) = create_bgra_bitmap(out_w, out_h, &scaled) {
        unsafe {
            let _ = DwmSetIconicThumbnail(hwnd, hbmp, 0);
            let _ = DeleteObject(hbmp);
        }
    }
}

/// Create a 32-bit BGRA HBITMAP from raw pixel data
fn create_bgra_bitmap(width: u32, height: u32, pixels: &[u8]) -> Option<HBITMAP> {
    unsafe {
        let bmi = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32), // top-down
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut bits: *mut std::ffi::c_void = std::ptr::null_mut();
        let hdc = CreateCompatibleDC(None);
        let hbmp = CreateDIBSection(hdc, &bmi, DIB_RGB_COLORS, &mut bits, None, 0);
        let _ = DeleteDC(hdc);

        match hbmp {
            Ok(hbmp) => {
                if !bits.is_null() {
                    std::ptr::copy_nonoverlapping(pixels.as_ptr(), bits as *mut u8, pixels.len());
                }
                Some(hbmp)
            }
            Err(_) => None,
        }
    }
}

/// Update the taskbar thumbnail with artwork image + track title
/// Called from frontend via Tauri command
pub fn update_thumbnail(thumbnail_path: Option<&str>, title: &str) {
    let lock = TASKBAR.get_or_init(|| Mutex::new(None));
    let guard = lock.lock().unwrap();
    let Some(state) = guard.as_ref() else {
        return;
    };

    // Set tooltip to track title
    unsafe {
        let wide: Vec<u16> = title.encode_utf16().chain(std::iter::once(0)).collect();
        let _ = state.taskbar.SetThumbnailTooltip(state.hwnd, PCWSTR(wide.as_ptr()));
    }

    // Render thumbnail bitmap from artwork image
    let max_dim: u32 = 200;
    let (out_w, out_h, rgba_pixels) = if let Some(path) = thumbnail_path {
        if let Ok(img) = image::open(path) {
            // Use actual image aspect ratio
            let thumb = img.thumbnail(max_dim, max_dim);
            let rgba = thumb.to_rgba8();
            let (iw, ih) = (rgba.width(), rgba.height());
            let mut pixels = vec![0u8; (iw * ih * 4) as usize];
            for py in 0..ih {
                for px in 0..iw {
                    let src = rgba.get_pixel(px, py);
                    let idx = (py * iw + px) as usize * 4;
                    pixels[idx] = src[2];     // B
                    pixels[idx + 1] = src[1]; // G
                    pixels[idx + 2] = src[0]; // R
                    pixels[idx + 3] = src[3]; // A
                }
            }
            (iw, ih, pixels)
        } else {
            // Fallback: dark gray square
            let s = max_dim;
            let mut pixels = vec![0u8; (s * s * 4) as usize];
            for i in (0..pixels.len()).step_by(4) {
                pixels[i] = 0x30; pixels[i+1] = 0x28; pixels[i+2] = 0x24; pixels[i+3] = 0xFF;
            }
            (s, s, pixels)
        }
    } else {
        let s = max_dim;
        let mut pixels = vec![0u8; (s * s * 4) as usize];
        for i in (0..pixels.len()).step_by(4) {
            pixels[i] = 0x30; pixels[i+1] = 0x28; pixels[i+2] = 0x24; pixels[i+3] = 0xFF;
        }
        (s, s, pixels)
    };

    // Store pixel data for on-demand bitmap creation
    {
        let pix_lock = THUMBNAIL_PIXELS.get_or_init(|| Mutex::new(None));
        let mut pix_guard = pix_lock.lock().unwrap();
        *pix_guard = Some(ThumbnailData {
            pixels: rgba_pixels,
            width: out_w,
            height: out_h,
        });
    }

    // Enable FORCE_ICONIC_REPRESENTATION now that we have pixel data
    unsafe {
        let val: i32 = 1;
        let _ = DwmSetWindowAttribute(state.hwnd, DWMWA_FORCE_ICONIC_REPRESENTATION, &val as *const _ as *const _, 4);
        let _ = DwmInvalidateIconicBitmaps(state.hwnd);
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
