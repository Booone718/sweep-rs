pub mod cleaner;
mod commands;
mod storage;

use std::sync::Arc;

use commands::{
    cancel_scan, clean_items, get_history, get_scan_report, get_settings, open_trash, reveal_path,
    start_scan, update_settings, AppState,
};
use tauri::{LogicalSize, Manager, WindowEvent};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(AppState::new()))
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Some(size) = storage::load_window_size() {
                    let _ = window.set_size(LogicalSize::new(size.width, size.height));
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            if let WindowEvent::Resized(size) = event {
                let scale_factor = window.scale_factor().unwrap_or(1.0);
                let logical = size.to_logical::<f64>(scale_factor);
                let _ = storage::save_window_size(&storage::WindowSize {
                    width: logical.width,
                    height: logical.height,
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_scan,
            cancel_scan,
            get_scan_report,
            clean_items,
            get_settings,
            update_settings,
            get_history,
            open_trash,
            reveal_path
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Sweep");
}
