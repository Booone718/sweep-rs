use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::Path;

use uuid::Uuid;

use super::{AppResidueGroup, CleanupCategory, RiskLevel, ScanItem};

const IGNORED_SUPPORT_DIRS: &[&str] = &[
    "AddressBook",
    "CloudDocs",
    "com.apple.sharedfilelist",
    "CrashReporter",
    "Dock",
    "MobileSync",
    "NotificationCenter",
];

pub fn detect_app_residue(
    home_dir: &Path,
    installed_app_names: &[String],
) -> io::Result<Vec<AppResidueGroup>> {
    let installed: HashSet<String> = installed_app_names
        .iter()
        .map(|name| normalize_name(name))
        .collect();
    let support_dir = home_dir.join("Library/Application Support");
    if !support_dir.exists() {
        return Ok(Vec::new());
    }

    let mut groups = Vec::new();
    for entry in fs::read_dir(support_dir)? {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let app_name = entry.file_name().to_string_lossy().to_string();
        if IGNORED_SUPPORT_DIRS
            .iter()
            .any(|ignored| ignored.eq_ignore_ascii_case(&app_name))
        {
            continue;
        }

        if installed.contains(&normalize_name(&app_name)) {
            continue;
        }

        let size_bytes = directory_size(&path).unwrap_or(0);
        let item = ScanItem {
            id: Uuid::new_v4().to_string(),
            path: path.to_string_lossy().to_string(),
            display_name: app_name.clone(),
            category: CleanupCategory::AppResidue,
            size_bytes,
            risk: RiskLevel::Review,
            reason: "疑似已卸载应用留下的支持文件".to_string(),
            default_selected: false,
        };

        groups.push(AppResidueGroup {
            id: Uuid::new_v4().to_string(),
            app_name,
            bundle_id: None,
            total_bytes: size_bytes,
            items: vec![item],
        });
    }

    groups.sort_by(|left, right| right.total_bytes.cmp(&left.total_bytes));
    Ok(groups)
}

pub fn installed_application_names() -> Vec<String> {
    fs::read_dir("/Applications")
        .ok()
        .into_iter()
        .flat_map(|entries| entries.flatten())
        .filter_map(|entry| {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("app") {
                return None;
            }
            path.file_stem()
                .and_then(|value| value.to_str())
                .map(|value| value.to_string())
        })
        .collect()
}

fn normalize_name(name: &str) -> String {
    name.to_ascii_lowercase()
        .replace(".app", "")
        .replace([' ', '-', '_'], "")
}

fn directory_size(path: &Path) -> io::Result<u64> {
    let mut total = 0_u64;
    for entry in walkdir::WalkDir::new(path) {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if entry.file_type().is_file() {
            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            total = total.saturating_add(metadata.len());
        }
    }
    Ok(total)
}
