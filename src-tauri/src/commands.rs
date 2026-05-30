use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{Emitter, State};
use uuid::Uuid;

use crate::cleaner::scanner::{scan_directory_with_progress, ScanOptions};
use crate::cleaner::trash::{SystemTrash, TrashBackend};
use crate::cleaner::{CleanFailure, CleanReport, HistoryEntry, ScanReport, UserSettings};
use crate::storage;

pub struct AppState {
    sessions: Mutex<HashMap<String, ScanSession>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Clone)]
enum ScanSession {
    Running,
    Ready(ScanReport),
    Failed(String),
}

#[tauri::command]
pub fn start_scan(
    config: UserSettings,
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    state
        .sessions
        .lock()
        .map_err(|_| "无法锁定扫描状态".to_string())?
        .insert(session_id.clone(), ScanSession::Running);

    let session_id_for_thread = session_id.clone();
    let state_for_thread = Arc::clone(state.inner());
    std::thread::spawn(move || {
        let _ = app.emit(
            "scan_progress",
            serde_json::json!({ "sessionId": session_id_for_thread, "phase": "scanning" }),
        );
        let home_dir = match dirs::home_dir() {
            Some(path) => path,
            None => {
                let message = "无法定位当前用户目录".to_string();
                let _ = store_failed(&state_for_thread, &session_id_for_thread, message.clone());
                let _ = app.emit(
                    "scan_completed",
                    serde_json::json!({ "sessionId": session_id_for_thread, "ok": false, "error": message }),
                );
                return;
            }
        };

        let progress_app = app.clone();
        let mut report = match scan_directory_with_progress(
            ScanOptions {
                home_dir,
                exclusions: config.exclusions.iter().map(PathBuf::from).collect(),
                large_file_threshold_bytes: if config.include_large_files {
                    config.large_file_threshold_bytes
                } else {
                    u64::MAX
                },
                duplicate_min_size_bytes: 10 * 1024 * 1024,
                include_browser_caches: config.include_browser_caches,
                include_protected_user_folders: config.include_protected_user_folders,
            },
            |progress| {
                let _ = progress_app.emit(
                    "scan_progress",
                    serde_json::json!({
                        "sessionId": session_id_for_thread,
                        "phase": progress.phase,
                        "currentPath": progress.current_path,
                        "scannedFiles": progress.scanned_files,
                        "matchedItems": progress.matched_items
                    }),
                );
            },
        ) {
            Ok(report) => report,
            Err(error) => {
                let message = error.to_string();
                let _ = store_failed(&state_for_thread, &session_id_for_thread, message.clone());
                let _ = app.emit(
                    "scan_completed",
                    serde_json::json!({ "sessionId": session_id_for_thread, "ok": false, "error": message }),
                );
                return;
            }
        };

        report.session_id = session_id_for_thread.clone();
        let _ = record_scan_history(&report);
        let _ = store_report(&state_for_thread, &session_id_for_thread, report.clone());
        let _ = app.emit(
            "scan_completed",
            serde_json::json!({ "sessionId": session_id_for_thread, "ok": true, "totalBytes": report.total_bytes }),
        );
    });

    Ok(session_id)
}

#[tauri::command]
pub fn cancel_scan(session_id: String, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    state
        .sessions
        .lock()
        .map_err(|_| "无法锁定扫描状态".to_string())?
        .insert(session_id, ScanSession::Failed("扫描已取消".to_string()));
    Ok(())
}

#[tauri::command]
pub fn get_scan_report(
    session_id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<ScanReport, String> {
    match state
        .sessions
        .lock()
        .map_err(|_| "无法锁定扫描状态".to_string())?
        .get(&session_id)
        .cloned()
    {
        Some(ScanSession::Ready(report)) => Ok(report),
        Some(ScanSession::Failed(error)) => Err(error),
        Some(ScanSession::Running) => Err("scan_not_ready".to_string()),
        None => Err("找不到扫描会话".to_string()),
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanRequest {
    pub session_id: String,
    pub item_ids: Vec<String>,
}

#[tauri::command]
pub fn clean_items(
    request: CleanRequest,
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<CleanReport, String> {
    let report = get_scan_report(request.session_id.clone(), state)?;
    let selected: Vec<_> = report
        .items
        .iter()
        .filter(|item| request.item_ids.contains(&item.id))
        .cloned()
        .collect();
    let trash = SystemTrash;
    let mut cleaned_bytes = 0_u64;
    let mut moved_item_count = 0_usize;
    let mut failed_items = Vec::new();

    for item in selected {
        let _ = app.emit(
            "clean_progress",
            serde_json::json!({ "sessionId": request.session_id, "path": item.path }),
        );
        match trash.move_to_trash(Path::new(&item.path)) {
            Ok(()) => {
                cleaned_bytes = cleaned_bytes.saturating_add(item.size_bytes);
                moved_item_count += 1;
            }
            Err(error) => failed_items.push(CleanFailure {
                path: item.path,
                error: error.to_string(),
            }),
        }
    }

    let clean_report = CleanReport {
        cleaned_bytes,
        moved_item_count,
        failed_items,
    };
    record_clean_history(&clean_report).map_err(|error| error.to_string())?;
    let _ = app.emit(
        "clean_completed",
        serde_json::json!({ "sessionId": request.session_id, "cleanedBytes": cleaned_bytes, "movedItemCount": moved_item_count }),
    );
    Ok(clean_report)
}

#[tauri::command]
pub fn get_settings() -> UserSettings {
    storage::load_settings()
}

#[tauri::command]
pub fn update_settings(settings: UserSettings) -> Result<UserSettings, String> {
    storage::save_settings(&settings).map_err(|error| error.to_string())?;
    Ok(settings)
}

#[tauri::command]
pub fn get_history() -> Vec<HistoryEntry> {
    storage::load_history()
}

#[tauri::command]
pub fn open_trash() -> Result<(), String> {
    let trash_path = dirs::home_dir()
        .ok_or_else(|| "无法定位当前用户目录".to_string())?
        .join(".Trash");
    Command::new("open")
        .arg(trash_path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn reveal_path(path: String) -> Result<(), String> {
    Command::new("open")
        .arg("-R")
        .arg(path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn store_report(state: &Arc<AppState>, session_id: &str, report: ScanReport) -> Result<(), String> {
    state
        .sessions
        .lock()
        .map_err(|_| "无法锁定扫描状态".to_string())?
        .insert(session_id.to_string(), ScanSession::Ready(report));
    Ok(())
}

fn store_failed(state: &Arc<AppState>, session_id: &str, error: String) -> Result<(), String> {
    state
        .sessions
        .lock()
        .map_err(|_| "无法锁定扫描状态".to_string())?
        .insert(session_id.to_string(), ScanSession::Failed(error));
    Ok(())
}

fn record_scan_history(report: &ScanReport) -> std::io::Result<()> {
    let mut history = storage::load_history();
    history.insert(
        0,
        HistoryEntry {
            id: Uuid::new_v4().to_string(),
            event_type: "scan".to_string(),
            total_bytes: report.total_bytes,
            item_count: report.items.len(),
            cleaned_bytes: 0,
            moved_item_count: 0,
            created_at: now_iso_like(),
        },
    );
    history.truncate(50);
    storage::save_history(&history)
}

fn record_clean_history(report: &CleanReport) -> std::io::Result<()> {
    let mut history = storage::load_history();
    history.insert(
        0,
        HistoryEntry {
            id: Uuid::new_v4().to_string(),
            event_type: "clean".to_string(),
            total_bytes: report.cleaned_bytes,
            item_count: report.moved_item_count,
            cleaned_bytes: report.cleaned_bytes,
            moved_item_count: report.moved_item_count,
            created_at: now_iso_like(),
        },
    );
    history.truncate(50);
    storage::save_history(&history)
}

fn now_iso_like() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    format!("{seconds}")
}
