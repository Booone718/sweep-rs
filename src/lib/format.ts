export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${Math.round(value)} ${units[unitIndex]}`;
  }

  const rounded = value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, "");
  return `${rounded} ${units[unitIndex]}`;
}

export function formatItemCount(count: number): string {
  return `${count} 项`;
}

