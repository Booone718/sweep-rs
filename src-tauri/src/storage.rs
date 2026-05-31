use std::fs;
use std::io;
use std::path::PathBuf;

use crate::cleaner::{HistoryEntry, UserSettings};

pub const MIN_WINDOW_WIDTH: f64 = 980.0;
pub const MIN_WINDOW_HEIGHT: f64 = 720.0;

#[derive(Clone, Copy, Debug, PartialEq, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSize {
    pub width: f64,
    pub height: f64,
}

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

pub fn load_window_size() -> Option<WindowSize> {
    read_json(window_size_path()).ok().map(sanitize_window_size)
}

pub fn save_window_size(size: &WindowSize) -> io::Result<()> {
    write_json(window_size_path(), &sanitize_window_size(*size))
}

pub fn sanitize_window_size(size: WindowSize) -> WindowSize {
    WindowSize {
        width: size.width.max(MIN_WINDOW_WIDTH),
        height: size.height.max(MIN_WINDOW_HEIGHT),
    }
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

fn window_size_path() -> PathBuf {
    base_dir().join("window-size.json")
}

#[cfg(test)]
mod tests {
    use super::{sanitize_window_size, WindowSize};

    #[test]
    fn sanitize_window_size_clamps_too_small_values() {
        assert_eq!(
            sanitize_window_size(WindowSize {
                width: 320.0,
                height: 240.0,
            }),
            WindowSize {
                width: 980.0,
                height: 720.0,
            }
        );
    }

    #[test]
    fn sanitize_window_size_preserves_usable_values() {
        assert_eq!(
            sanitize_window_size(WindowSize {
                width: 1320.0,
                height: 880.0,
            }),
            WindowSize {
                width: 1320.0,
                height: 880.0,
            }
        );
    }
}
