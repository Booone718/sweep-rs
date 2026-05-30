pub mod cleaner;
mod commands;
mod storage;

use std::sync::Arc;

use commands::{
    cancel_scan, clean_items, get_history, get_scan_report, get_settings, open_trash, reveal_path,
    start_scan, update_settings, AppState,
};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(AppState::new()))
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
