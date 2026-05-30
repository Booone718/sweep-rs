use std::cell::RefCell;
use std::io;
use std::path::{Path, PathBuf};

pub trait TrashBackend {
    fn move_to_trash(&self, path: &Path) -> io::Result<()>;
}

pub struct SystemTrash;

impl TrashBackend for SystemTrash {
    fn move_to_trash(&self, path: &Path) -> io::Result<()> {
        trash::delete(path).map_err(|error| io::Error::new(io::ErrorKind::Other, error.to_string()))
    }
}

#[derive(Default)]
pub struct MockTrash {
    moved_paths: RefCell<Vec<PathBuf>>,
}

impl MockTrash {
    pub fn moved_paths(&self) -> Vec<PathBuf> {
        self.moved_paths.borrow().clone()
    }
}

impl TrashBackend for MockTrash {
    fn move_to_trash(&self, path: &Path) -> io::Result<()> {
        self.moved_paths.borrow_mut().push(path.to_path_buf());
        Ok(())
    }
}
