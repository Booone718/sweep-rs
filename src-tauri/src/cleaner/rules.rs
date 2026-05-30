use std::path::{Path, PathBuf};

use uuid::Uuid;

use super::{CleanupCategory, RiskLevel, ScanItem};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RuleMatch {
    pub category: CleanupCategory,
    pub risk: RiskLevel,
    pub reason: String,
    pub default_selected: bool,
}

pub fn is_excluded(path: &Path, exclusions: &[PathBuf]) -> bool {
    exclusions.iter().any(|excluded| path.starts_with(excluded))
}

pub fn classify_path(path: &Path, home_dir: &Path, size_bytes: u64) -> Option<RuleMatch> {
    let relative = path.strip_prefix(home_dir).unwrap_or(path);
    let normalized = relative.to_string_lossy().replace('\\', "/");
    let lower = normalized.to_ascii_lowercase();
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    if is_browser_cache_path(&lower) {
        return Some(RuleMatch {
            category: CleanupCategory::BrowserCache,
            risk: RiskLevel::Review,
            reason: "浏览器缓存；不会清理 Cookie、历史记录或密码".to_string(),
            default_selected: false,
        });
    }

    if lower.contains("library/application support/mobilesync/backup") {
        return Some(RuleMatch {
            category: CleanupCategory::IosBackups,
            risk: RiskLevel::Review,
            reason: "旧 iPhone/iPad 备份，需要手动确认".to_string(),
            default_selected: false,
        });
    }

    if lower.contains("library/caches")
        || file_name.ends_with(".tmp")
        || file_name.ends_with(".temp")
    {
        return Some(RuleMatch {
            category: CleanupCategory::Cache,
            risk: RiskLevel::Low,
            reason: "缓存或临时文件，可重新生成".to_string(),
            default_selected: true,
        });
    }

    if lower.contains("library/logs/diagnosticreports")
        || lower.contains("library/application support/crashreporter")
        || lower.contains("crashreporter")
    {
        return Some(RuleMatch {
            category: CleanupCategory::CrashReports,
            risk: RiskLevel::Low,
            reason: "旧崩溃报告，可安全移到废纸篓".to_string(),
            default_selected: true,
        });
    }

    if lower.contains("library/logs") || file_name.ends_with(".log") {
        return Some(RuleMatch {
            category: CleanupCategory::Logs,
            risk: RiskLevel::Low,
            reason: "历史日志文件".to_string(),
            default_selected: true,
        });
    }

    if lower.starts_with(".trash/") || lower.contains("/.trash/") {
        return Some(RuleMatch {
            category: CleanupCategory::Trash,
            risk: RiskLevel::Review,
            reason: "废纸篓内容，清理前需要确认".to_string(),
            default_selected: false,
        });
    }

    if is_download_residue(&lower, &file_name) {
        return Some(RuleMatch {
            category: CleanupCategory::Downloads,
            risk: RiskLevel::Review,
            reason: "安装包、压缩包或未完成下载".to_string(),
            default_selected: false,
        });
    }

    if size_bytes >= 1024 * 1024 * 1024 {
        return Some(RuleMatch {
            category: CleanupCategory::LargeFiles,
            risk: RiskLevel::Review,
            reason: "大文件，需要手动确认是否仍要保留".to_string(),
            default_selected: false,
        });
    }

    None
}

pub fn item_from_match(path: &Path, size_bytes: u64, rule_match: RuleMatch) -> ScanItem {
    ScanItem {
        id: Uuid::new_v4().to_string(),
        path: path.to_string_lossy().to_string(),
        display_name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("未命名项目")
            .to_string(),
        category: rule_match.category,
        size_bytes,
        risk: rule_match.risk,
        reason: rule_match.reason,
        default_selected: rule_match.default_selected,
    }
}

fn is_browser_cache_path(lower: &str) -> bool {
    lower.contains("library/caches/com.apple.safari")
        || lower.contains("library/caches/google/chrome")
        || lower.contains("library/caches/com.google.chrome")
        || lower.contains("library/caches/microsoft edge")
        || lower.contains("library/caches/firefox")
        || lower.contains("library/caches/org.mozilla.firefox")
}

fn is_download_residue(lower: &str, file_name: &str) -> bool {
    lower.starts_with("downloads/")
        && (file_name.ends_with(".dmg")
            || file_name.ends_with(".pkg")
            || file_name.ends_with(".zip")
            || file_name.ends_with(".crdownload")
            || file_name.ends_with(".download")
            || file_name.ends_with(".part"))
}
