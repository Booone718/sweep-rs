use std::collections::HashMap;
use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::{CleanupCategory, DuplicateGroup, RiskLevel, ScanItem};

pub fn find_duplicate_groups(items: &[ScanItem]) -> io::Result<Vec<DuplicateGroup>> {
    let mut by_size: HashMap<u64, Vec<&ScanItem>> = HashMap::new();
    for item in items {
        if item.size_bytes > 0 {
            by_size.entry(item.size_bytes).or_default().push(item);
        }
    }

    let mut groups = Vec::new();
    for (size, same_size_items) in by_size {
        if same_size_items.len() < 2 {
            continue;
        }

        let mut by_hash: HashMap<String, Vec<ScanItem>> = HashMap::new();
        for item in same_size_items {
            let hash = match hash_file(Path::new(&item.path)) {
                Ok(hash) => hash,
                Err(_) => continue,
            };
            by_hash
                .entry(hash)
                .or_default()
                .push(as_duplicate_item(item));
        }

        for (hash, duplicate_items) in by_hash {
            if duplicate_items.len() < 2 {
                continue;
            }

            let reclaimable_bytes =
                size.saturating_mul(duplicate_items.len().saturating_sub(1) as u64);
            groups.push(DuplicateGroup {
                id: Uuid::new_v4().to_string(),
                size_bytes: size,
                hash,
                items: duplicate_items,
                reclaimable_bytes,
            });
        }
    }

    groups.sort_by(|left, right| right.reclaimable_bytes.cmp(&left.reclaimable_bytes));
    Ok(groups)
}

fn as_duplicate_item(item: &ScanItem) -> ScanItem {
    let mut duplicate = item.clone();
    duplicate.id = Uuid::new_v4().to_string();
    duplicate.category = CleanupCategory::Duplicates;
    duplicate.risk = RiskLevel::Review;
    duplicate.reason = "内容相同的重复文件，至少保留一份".to_string();
    duplicate.default_selected = false;
    duplicate
}

fn hash_file(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 16 * 1024];

    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}
