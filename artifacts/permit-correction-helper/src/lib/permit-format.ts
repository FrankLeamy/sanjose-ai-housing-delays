export function readablePermitDate(value: string | null): string {
  const day = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!day) return "Not available";
  const parsed = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}