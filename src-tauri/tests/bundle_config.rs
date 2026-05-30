use std::path::Path;

#[test]
fn tauri_bundle_declares_existing_app_icons() {
    let manifest_dir = env!("CARGO_MANIFEST_DIR");
    let config: serde_json::Value =
        serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri config is valid json");
    let icons = config["bundle"]["icon"]
        .as_array()
        .expect("bundle.icon is an array");

    assert!(
        icons.iter().any(|icon| icon.as_str() == Some("icons/icon.icns")),
        "macOS app icon must include icons/icon.icns"
    );

    for icon in icons {
        let icon = icon.as_str().expect("icon entries are strings");
        assert!(
            Path::new(manifest_dir).join(icon).exists(),
            "configured icon does not exist: {icon}"
        );
    }
}
