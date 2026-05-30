use std::fs;
use std::io;
use std::path::PathBuf;

use crate::cleaner::{HistoryEntry, UserSettings};

pub fn load_settings() -> UserSettings {
    read_json(settings_path()).unwrap_or_default()
}

pub fn save_settings(settings: &UserSettings) -> io::Result<()> {
    write_json(settings_path(), settings)
}

pub fn load_history() -> Vec<HistoryEntry> {
    read_json(history_path()).unwrap_or_default()
}

pub fn save_history(history: &[HistoryEntry]) -> io::Result<()> {
    write_json(history_path(), history)
}

fn read_json<T: serde::de::DeserializeOwned>(path: PathBuf) -> io::Result<T> {
    let contents = fs::read_to_string(path)?;
    serde_json::from_str(&contents)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}

fn write_json<T: serde::Serialize + ?Sized>(path: PathBuf, value: &T) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let contents = serde_json::to_string_pretty(value)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    fs::write(path, contents)
}

fn base_dir() -> PathBuf {
    dirs::config_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Sweep")
}

fn settings_path() -> PathBuf {
    base_dir().join("settings.json")
}

fn history_path() -> PathBuf {
    base_dir().join("history.json")
}
