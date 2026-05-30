use std::fs;
use std::path::Path;

use sweep_lib::cleaner::{
    app_residue::detect_app_residue,
    duplicates::find_duplicate_groups,
    rules::classify_path,
    scanner::{scan_directory, scan_directory_with_progress, ScanOptions},
    trash::{MockTrash, TrashBackend},
    CleanupCategory, RiskLevel,
};
use tempfile::tempdir;

fn write_file(path: &Path, contents: &[u8]) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(path, contents).unwrap();
}

#[test]
fn classifies_low_risk_cache_logs_and_review_only_large_files() {
    let home = tempdir().unwrap();
    let cache = home.path().join("Library/Caches/com.example/cache.db");
    let log = home.path().join("Library/Logs/example.log");
    let large = home.path().join("Movies/archive.mov");

    assert_eq!(
        classify_path(&cache, home.path(), 1024).unwrap().category,
        CleanupCategory::Cache
    );
    assert_eq!(
        classify_path(&cache, home.path(), 1024).unwrap().risk,
        RiskLevel::Low
    );
    assert!(
        classify_path(&cache, home.path(), 1024)
            .unwrap()
            .default_selected
    );

    assert_eq!(
        classify_path(&log, home.path(), 1024).unwrap().category,
        CleanupCategory::Logs
    );
    assert_eq!(
        classify_path(&large, home.path(), 2_000_000_000)
            .unwrap()
            .category,
        CleanupCategory::LargeFiles
    );
    assert_eq!(
        classify_path(&large, home.path(), 2_000_000_000)
            .unwrap()
            .risk,
        RiskLevel::Review
    );
    assert!(
        !classify_path(&large, home.path(), 2_000_000_000)
            .unwrap()
            .default_selected
    );
}

#[test]
fn browser_cleanup_does_not_classify_firefox_profile_data_as_cache() {
    let home = tempdir().unwrap();
    let firefox_cookie = home
        .path()
        .join("Library/Application Support/Firefox/Profiles/abc.default/cookies.sqlite");
    let firefox_cache = home
        .path()
        .join("Library/Caches/Firefox/Profiles/abc.default/cache2/entry");

    assert!(classify_path(&firefox_cookie, home.path(), 4096).is_none());
    assert_eq!(
        classify_path(&firefox_cache, home.path(), 4096)
            .unwrap()
            .category,
        CleanupCategory::BrowserCache
    );
}

#[test]
fn scan_directory_respects_exclusions_and_permission_warnings() {
    let home = tempdir().unwrap();
    write_file(&home.path().join("Library/Caches/keep.tmp"), b"cache");
    write_file(
        &home.path().join("Library/Caches/excluded/skip.tmp"),
        b"skip",
    );

    let report = scan_directory(ScanOptions {
        home_dir: home.path().to_path_buf(),
        exclusions: vec![home.path().join("Library/Caches/excluded")],
        large_file_threshold_bytes: 100_000,
        duplicate_min_size_bytes: 1,
        include_browser_caches: true,
        include_protected_user_folders: true,
    })
    .unwrap();

    assert_eq!(report.items.len(), 1);
    assert_eq!(report.items[0].display_name, "keep.tmp");
    assert!(report.permission_warnings.is_empty());
}

#[test]
fn scan_directory_skips_macos_privacy_protected_user_folders_by_default() {
    let home = tempdir().unwrap();
    write_file(&home.path().join("Library/Caches/keep.tmp"), b"cache");
    write_file(&home.path().join("Downloads/installer.dmg"), b"installer");
    write_file(&home.path().join("Documents/debug.log"), b"log");

    let report = scan_directory(ScanOptions {
        home_dir: home.path().to_path_buf(),
        exclusions: vec![],
        large_file_threshold_bytes: 100_000,
        duplicate_min_size_bytes: 1,
        include_browser_caches: true,
        include_protected_user_folders: false,
    })
    .unwrap();

    let item_paths: Vec<_> = report.items.iter().map(|item| item.path.as_str()).collect();
    assert!(item_paths.iter().any(|path| path.contains("keep.tmp")));
    assert!(!item_paths.iter().any(|path| path.contains("installer.dmg")));
    assert!(!item_paths.iter().any(|path| path.contains("debug.log")));
}

#[test]
fn scan_directory_emits_file_progress_for_visible_work() {
    let home = tempdir().unwrap();
    write_file(&home.path().join("Library/Caches/keep.tmp"), b"cache");
    let mut events = Vec::new();

    scan_directory_with_progress(
        ScanOptions {
            home_dir: home.path().to_path_buf(),
            exclusions: vec![],
            large_file_threshold_bytes: 100_000,
            duplicate_min_size_bytes: 1,
            include_browser_caches: true,
            include_protected_user_folders: true,
        },
        |progress| events.push(progress),
    )
    .unwrap();

    assert!(events
        .iter()
        .any(|event| event.current_path.contains("keep.tmp")));
    assert!(events.iter().any(|event| event.scanned_files >= 1));
    assert!(events.iter().any(|event| event.matched_items >= 1));
}

#[test]
fn duplicate_detection_groups_files_by_content_hash() {
    let home = tempdir().unwrap();
    let first = home.path().join("Documents/a.txt");
    let second = home.path().join("Downloads/b.txt");
    let unique = home.path().join("Downloads/c.txt");
    write_file(&first, b"same-data");
    write_file(&second, b"same-data");
    write_file(&unique, b"different");

    let report = scan_directory(ScanOptions {
        home_dir: home.path().to_path_buf(),
        exclusions: vec![],
        large_file_threshold_bytes: 100_000,
        duplicate_min_size_bytes: 1,
        include_browser_caches: true,
        include_protected_user_folders: true,
    })
    .unwrap();
    let groups = find_duplicate_groups(&report.items).unwrap();

    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].items.len(), 2);
    assert_eq!(groups[0].reclaimable_bytes, b"same-data".len() as u64);
}

#[test]
fn duplicate_detection_skips_files_that_disappear_during_scan() {
    let home = tempdir().unwrap();
    let first = home.path().join("Documents/a.txt");
    let second = home.path().join("Downloads/b.txt");
    write_file(&first, b"same-data");
    write_file(&second, b"same-data");

    let report = scan_directory(ScanOptions {
        home_dir: home.path().to_path_buf(),
        exclusions: vec![],
        large_file_threshold_bytes: 100_000,
        duplicate_min_size_bytes: 1,
        include_browser_caches: true,
        include_protected_user_folders: true,
    })
    .unwrap();
    fs::remove_file(&second).unwrap();

    let groups = find_duplicate_groups(&report.items).unwrap();

    assert!(groups.is_empty());
}

#[test]
fn app_residue_detects_leftovers_for_missing_application() {
    let home = tempdir().unwrap();
    write_file(
        &home
            .path()
            .join("Library/Application Support/ExampleApp/state.json"),
        b"state",
    );
    write_file(
        &home.path().join("Library/Caches/com.example.app/blob"),
        b"cache",
    );

    let groups = detect_app_residue(home.path(), &[]).unwrap();

    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].app_name, "ExampleApp");
    assert_eq!(groups[0].items.len(), 1);
    assert!(groups[0].items[0].path.contains("ExampleApp"));
}

#[test]
fn mock_trash_records_selected_paths_without_deleting() {
    let home = tempdir().unwrap();
    let file = home.path().join("Library/Caches/com.example/cache.db");
    write_file(&file, b"cache");
    let trash = MockTrash::default();

    trash.move_to_trash(&file).unwrap();

    assert_eq!(trash.moved_paths(), vec![file]);
    assert!(home
        .path()
        .join("Library/Caches/com.example/cache.db")
        .exists());
}
