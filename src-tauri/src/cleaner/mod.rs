pub mod app_residue;
pub mod duplicates;
pub mod rules;
pub mod scanner;
pub mod trash;
pub mod types;

pub use types::{
    AppResidueGroup, CleanFailure, CleanReport, CleanupCategory, DuplicateGroup, HistoryEntry,
    RiskLevel, ScanItem, ScanProgress, ScanReport, UserSettings,
};
