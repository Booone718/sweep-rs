use std::io;
use std::path::{Component, Path, PathBuf};

use uuid::Uuid;
use walkdir::WalkDir;

use super::app_residue::{detect_app_residue, installed_application_names};
use super::duplicates::find_duplicate_groups;
use super::rules::{classify_path, is_excluded, item_from_match, RuleMatch};
use super::{CleanupCategory, RiskLevel, ScanItem, ScanProgress, ScanReport};

#[derive(Clone, Debug)]
pub struct ScanOptions {
    pub home_dir: PathBuf,
    pub exclusions: Vec<PathBuf>,
    pub large_file_threshold_bytes: u64,
    pub duplicate_min_size_bytes: u64,
    pub include_browser_caches: bool,
    pub include_protected_user_folders: bool,
}

pub fn scan_directory(options: ScanOptions) -> io::Result<ScanReport> {
    scan_directory_with_progress(options, |_| {})
}

pub fn scan_directory_with_progress<F>(
    options: ScanOptions,
    mut on_progress: F,
) -> io::Result<ScanReport>
where
    F: FnMut(ScanProgress),
{
    let mut items = Vec::new();
    let mut duplicate_candidates = Vec::new();
    let mut permission_warnings = Vec::new();
    let mut scanned_files = 0_u64;
    let mut last_reported_matches = 0_usize;

    for entry in WalkDir::new(&options.home_dir)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            !is_excluded(entry.path(), &options.exclusions)
                && (options.include_protected_user_folders
                    || !is_macos_privacy_protected_user_path(entry.path(), &options.home_dir))
        })
    {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                permission_warnings.push(error.to_string());
                continue;
            }
        };

        if !entry.file_type().is_file() {
            continue;
        }
        scanned_files += 1;

        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(error) => {
                permission_warnings.push(format!("{}: {}", path.display(), error));
                continue;
            }
        };
        let size_bytes = metadata.len();

        let mut match_result = classify_path(path, &options.home_dir, size_bytes);
        if match_result.is_none()
            && options.include_large_files()
            && size_bytes >= options.large_file_threshold_bytes
        {
            match_result = Some(RuleMatch {
                category: CleanupCategory::LargeFiles,
                risk: RiskLevel::Review,
                reason: format!(
                    "超过 {} MB 的大文件",
                    options.large_file_threshold_bytes / 1024 / 1024
                ),
                default_selected: false,
            });
        }

        if let Some(mut rule_match) = match_result {
            if rule_match.category == CleanupCategory::BrowserCache
                && !options.include_browser_caches
            {
                continue;
            }
            if rule_match.category == CleanupCategory::LargeFiles {
                if !options.include_large_files() || size_bytes < options.large_file_threshold_bytes
                {
                    continue;
                }
                rule_match.reason = format!(
                    "超过 {} MB 的大文件",
                    options.large_file_threshold_bytes / 1024 / 1024
                );
            }
            items.push(item_from_match(path, size_bytes, rule_match));
        }

        let matched_items = items.len();
        if scanned_files == 1 || scanned_files % 100 == 0 || matched_items != last_reported_matches
        {
            on_progress(ScanProgress {
                phase: "walking".to_string(),
                current_path: path.to_string_lossy().to_string(),
                scanned_files,
                matched_items,
            });
            last_reported_matches = matched_items;
        }

        if size_bytes >= options.duplicate_min_size_bytes {
            duplicate_candidates.push(ScanItem {
                id: Uuid::new_v4().to_string(),
                path: path.to_string_lossy().to_string(),
                display_name: path
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or("未命名项目")
                    .to_string(),
                category: CleanupCategory::Duplicates,
                size_bytes,
                risk: RiskLevel::Review,
                reason: "重复文件候选".to_string(),
                default_selected: false,
            });
        }
    }

    on_progress(ScanProgress {
        phase: "duplicates".to_string(),
        current_path: "重复文件检测".to_string(),
        scanned_files,
        matched_items: items.len(),
    });
    let duplicate_groups = find_duplicate_groups(&duplicate_candidates)?;
    for group in &duplicate_groups {
        items.extend(group.items.clone());
    }

    on_progress(ScanProgress {
        phase: "app_residue".to_string(),
        current_path: "应用残留检测".to_string(),
        scanned_files,
        matched_items: items.len(),
    });
    let app_residue_groups = detect_app_residue(&options.home_dir, &installed_application_names())?;
    for group in &app_residue_groups {
        items.extend(group.items.clone());
    }

    let total_bytes = items.iter().map(|item| item.size_bytes).sum();

    Ok(ScanReport {
        session_id: Uuid::new_v4().to_string(),
        total_bytes,
        items,
        duplicate_groups,
        app_residue_groups,
        permission_warnings,
    })
}

impl ScanOptions {
    fn include_large_files(&self) -> bool {
        self.large_file_threshold_bytes > 0 && self.large_file_threshold_bytes < u64::MAX
    }
}

fn is_macos_privacy_protected_user_path(path: &Path, home_dir: &Path) -> bool {
    let components: Vec<String> = path
        .strip_prefix(home_dir)
        .unwrap_or(path)
        .components()
        .filter_map(|component| match component {
            Component::Normal(value) => value.to_str().map(|text| text.to_ascii_lowercase()),
            _ => None,
        })
        .collect();

    let Some(first) = components.first().map(String::as_str) else {
        return false;
    };

    if matches!(
        first,
        "desktop" | "documents" | "downloads" | "movies" | "music" | "pictures"
    ) {
        return true;
    }

    if components.len() < 2 || first != "library" {
        return false;
    }

    matches!(
        components[1].as_str(),
        "calendars" | "cloudstorage" | "mail" | "messages" | "mobile documents" | "safari"
    )
}
