use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CleanupCategory {
    Cache,
    Logs,
    CrashReports,
    Trash,
    Downloads,
    BrowserCache,
    LargeFiles,
    Duplicates,
    IosBackups,
    AppResidue,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Low,
    Review,
    High,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanItem {
    pub id: String,
    pub path: String,
    pub display_name: String,
    pub category: CleanupCategory,
    pub size_bytes: u64,
    pub risk: RiskLevel,
    pub reason: String,
    pub default_selected: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub id: String,
    pub size_bytes: u64,
    pub hash: String,
    pub items: Vec<ScanItem>,
    pub reclaimable_bytes: u64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppResidueGroup {
    pub id: String,
    pub app_name: String,
    pub bundle_id: Option<String>,
    pub items: Vec<ScanItem>,
    pub total_bytes: u64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanReport {
    pub session_id: String,
    pub total_bytes: u64,
    pub items: Vec<ScanItem>,
    pub duplicate_groups: Vec<DuplicateGroup>,
    pub app_residue_groups: Vec<AppResidueGroup>,
    pub permission_warnings: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub phase: String,
    pub current_path: String,
    pub scanned_files: u64,
    pub matched_items: usize,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanReport {
    pub cleaned_bytes: u64,
    pub moved_item_count: usize,
    pub failed_items: Vec<CleanFailure>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanFailure {
    pub path: String,
    pub error: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    pub exclusions: Vec<String>,
    pub include_browser_caches: bool,
    pub include_large_files: bool,
    #[serde(default)]
    pub include_protected_user_folders: bool,
    pub large_file_threshold_bytes: u64,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            exclusions: Vec::new(),
            include_browser_caches: true,
            include_large_files: true,
            include_protected_user_folders: false,
            large_file_threshold_bytes: 1024 * 1024 * 1024,
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub cleaned_bytes: u64,
    pub moved_item_count: usize,
    pub created_at: String,
}
