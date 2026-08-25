export function formatDuration(minutes?: number | null): string {
  if (!minutes && minutes !== 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatNumber(n?: number | null): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("en-US");
}

export function levelLabel(level?: string | null): string {
  if (!level) return "";
  return level.charAt(0).toUpperCase() + level.slice(1);
}
