const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 10000) : null;
const numeric = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const cleaned = typeof value === "string" ? value.replace(/[$,\s]/g, "") : value;
  if (typeof cleaned !== "number" && (typeof cleaned !== "string" || !/^\d+(?:\.\d+)?$/.test(cleaned))) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) && number >= 0 ? number : null;
};
export function cityDate(value: unknown): string | null {
  const source = text(value);
  if (!source) return null;
  const iso = source.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/);
  const us = source.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$|\s)/);
  if (!iso && !us) return null;
  const year = Number(iso ? iso[1] : us![3]);
  const month = Number(iso ? iso[2] : us![1]);
  const day = Number(iso ? iso[3] : us![2]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function cityRecordUrl(sourceUrl: string, permitNumber: string): URL {
  const source = new URL(sourceUrl);
  if (source.protocol !== "https:" || source.hostname !== "data.sanjoseca.gov" ||
      source.port || source.username || source.password || source.pathname !== "/api/3/action/datastore_search") {
    throw new Error("Unsupported City record source.");
  }
  const resource = source.searchParams.get("resource_id");
  if (!resource || !/^[a-f0-9-]{36}$/i.test(resource)) throw new Error("Unsupported City dataset.");
  const url = new URL("https://data.sanjoseca.gov/api/3/action/datastore_search");
  url.searchParams.set("resource_id", resource);
  url.searchParams.set("filters", JSON.stringify({ FOLDERNUMBER: permitNumber }));
  url.searchParams.set("limit", "2");
  return url;
}

export function parseCityPermit(payload: unknown, permitNumber: string, address: string) {
  if (!payload || typeof payload !== "object") throw new Error("Invalid City response.");
  const body = payload as { success?: unknown; result?: { records?: unknown } };
  if (body.success !== true || !Array.isArray(body.result?.records)) throw new Error("Invalid City response.");
  const records = body.result.records.filter((row): row is Record<string, unknown> =>
    row != null && typeof row === "object" && !Array.isArray(row) && row.FOLDERNUMBER === permitNumber);
  if (records.length === 0) return null;
  if (records.length !== 1) throw new Error("City returned an ambiguous permit record.");
  const record = records[0];
  const approvals = text(record.PERMITAPPROVALS);
  const labels: Record<string, string> = { B: "Building", E: "Electrical", M: "Mechanical", P: "Plumbing" };
  const dwellingUnits = numeric(record.DWELLINGUNITS);
  // Explicit allowlist: never forward the City payload, owner, applicant,
  // contractor, parcel identifiers, coordinates, or resource/database IDs.
  return {
    permitNumber,
    status: text(record.Status),
    address,
    projectDescription: text(record.FOLDERNAME) ?? text(record.FOLDERDESC),
    workDescription: text(record.WORKDESCRIPTION),
    approvalStatus: approvals?.split(",").map((part) => part.trim().replace(/^([BEMP])-/,
      (_match, code: string) => `${labels[code]}: `)).join("; ") ?? null,
    issueDate: cityDate(record.ISSUEDATE),
    finalDate: cityDate(record.FINALDATE),
    dwellingUnits: dwellingUnits != null && Number.isInteger(dwellingUnits) ? dwellingUnits : null,
    squareFootage: numeric(record.SQUAREFOOTAGE),
    valuation: numeric(record.PERMITVALUATION),
  };
}