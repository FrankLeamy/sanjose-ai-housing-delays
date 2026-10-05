export const HUMAN_REVIEW_CATEGORIES = ["Measurement conflict", "Safety review", "Document review"];
export type ScreeningItem = {
  id: number; comment: string; status: "met" | "needs_fix"; howToFix: string;
  department: string; category: string; unclear: boolean; completed: boolean;
};
export type ScreeningDraft = { address: string; summary: string; items: ScreeningItem[] };

const reviewAdvice = "Human review required. Do not choose a value, assume compliance, or proceed with safety-critical work based on this checklist. Ask the City reviewer and the responsible licensed architect or engineer to reconcile the cited information and confirm corrected plans.";
const item = (category: string, comment: string, department = "Building"): ScreeningItem => ({
  id: 0, category, comment, department, status: "needs_fix", unclear: true,
  completed: false, howToFix: reviewAdvice,
});
export function unreadableDocument(name: string): ScreeningDraft {
  return {
    address: "Uploaded document",
    summary: "Human review required: document contents could not be reliably read. Measurements and safety information have not been verified.",
    items: [item("Document review", `${name}: readable text was unavailable, incomplete, or the file requires visual review. This is not evidence that the document has no conflicts.`)],
  };
}

// Conservative, evidence-based screening, not code-compliance or engineering verification.
export function screenDocumentPages(pages: string[], name: string): ScreeningDraft {
  if (!pages.length || pages.every((page) => page.trim().length < 15)) return unreadableDocument(name);
  const partiallyUnreadable = pages.some((page) => page.trim().length < 15);
  const lines = pages.flatMap((page, index) =>
    page.split(/\n|;|(?<=[.!?])\s+(?=[A-Z])/).map((text) => ({ text: text.trim(), page: index + 1 }))
      .filter((line) => line.text.length > 0));
  const cite = (line: typeof lines[number]) => `${name}, page ${line.page}: “${line.text.slice(0, 700)}”`;
  const findings: ScreeningItem[] = [];
  const measurements = new Map<string, { value: number; source: typeof lines[number] }[]>();
  const dimension = /((?:(?:front|rear|side|east|west|north|south)\s+)?(?:setback|ceiling height|building height|door width|stair width|corridor width|exit width|fire access width|access width|beam span|floor area ratio|floor area|FAR|ramp slope))\s*(?:(?:is|of|measures|shown as|listed as)\s*|[:=]\s*)?(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|square feet|sf|ft|feet|foot|inches|inch|in|mm|cm|meters|metres|m|%|['″"])?/gi;
  const factor: Record<string, number> = { ft: 304.8, feet: 304.8, foot: 304.8, "'": 304.8, in: 25.4, inch: 25.4, inches: 25.4, '"': 25.4, "″": 25.4, mm: 1, cm: 10, m: 1000, meters: 1000, metres: 1000 };
  for (const line of lines) {
    // A required limit and a proposed dimension are not inherently conflicting.
    if (/\b(minimum|maximum|required|allowed|at least|at most|must|limit)\b/i.test(line.text)) continue;
    for (const match of line.text.matchAll(dimension)) {
      const label = match[1].toLowerCase().replace(/\s+/g, " ");
      const unit = (match[3] ?? "").toLowerCase().replace(/\s+/g, " ");
      if (!unit && !/far|floor area ratio/.test(label)) continue;
      const scope = line.text.slice(0, match.index).match(/\b(existing|proposed)\b/i)?.[1]?.toLowerCase() ?? "";
      const unitKind = factor[unit] ? "length" : /sf|sq|square/.test(unit) ? "area" : unit || "ratio";
      const key = `${scope} ${label} (${unitKind})`.trim();
      const values = measurements.get(key) ?? [];
      const inches = (unit === "'" || /^(ft|feet|foot)$/.test(unit))
        ? line.text.slice((match.index ?? 0) + match[0].length).match(/^\s*(\d+(?:\.\d+)?)\s*(?:"|″|inches|inch|in\b)/)?.[1]
        : undefined;
      values.push({ value: Number(match[2]) * (factor[unit] ?? 1) + Number(inches ?? 0) * 25.4, source: line });
      measurements.set(key, values);
    }
  }
  for (const [label, values] of measurements) {
    const first = values[0];
    const other = values.find((value) => Math.abs(value.value - first.value) > 0.001);
    if (other) findings.push(item("Measurement conflict",
      `Potential conflicting measurements for ${label}. ${cite(first.source)} versus ${cite(other.source)}. Neither value has been selected as correct.`));
  }
  const safetyLines = lines.filter((line) => /\b(fire|sprinklers?|smoke alarms?|egress|exits?|load.bearing|structural|seismic|foundation|electrical|gas|carbon monoxide)\b/i.test(line.text));
  if (safetyLines.length) {
    const states = [
      { kind: "requirement", negative: /\bnot required\b/i, positive: /\brequired\b/i },
      { kind: "installation", negative: /\b(not provided|not installed|missing|omitted)\b/i, positive: /\b(provided|installed)\b/i },
      { kind: "compliance", negative: /\b(not compliant|non.compliant|unsafe|inadequate)\b/i, positive: /\b(compliant|safe|adequate)\b/i },
      { kind: "access", negative: /\bblocked\b/i, positive: /\bclear\b/i },
    ];
    const facts = new Map<string, { negative: boolean; line: typeof lines[number] }>();
    let conflict: (typeof lines[number])[] | undefined;
    for (const line of safetyLines) {
      const subject = line.text.match(/\b(fire apparatus access|fire access|sprinklers?|smoke alarms?|fire alarms?|egress|exit|load.bearing|structural|foundation|electrical|gas|carbon monoxide)\b/i)?.[1]?.toLowerCase().replace(/s$/, "");
      if (!subject) continue;
      for (const state of states) {
        const negative = state.negative.test(line.text);
        if (!negative && !state.positive.test(line.text)) continue;
        const key = `${subject}:${state.kind}`;
        const previous = facts.get(key);
        if (previous && previous.negative !== negative) conflict ??= [previous.line, line];
        facts.set(key, { negative, line });
      }
    }
    const evidence = conflict ?? safetyLines.slice(0, 4);
    findings.push(item("Safety review",
      `${conflict ? "Potential conflicting safety information" : "Safety-related information needs expert verification"}: ${evidence.map(cite).join(" versus ")}. Automated screening cannot determine which statement is correct or certify safety.`,
      /\b(fire|sprinkler|smoke|egress|exit)\b/i.test(evidence.map((line) => line.text).join(" ")) ? "Fire / Building" : "Building"));
  }
  if (partiallyUnreadable) findings.push(item("Document review", `${name}: at least one page has insufficient readable text. Conflicts found on readable pages are listed, but unreadable pages and drawings also require human review.`));
  const routine = lines.filter((line) => /^(?:\d+[.)]\s*)?(provide|revise|clarify|submit|show|update)\b/i.test(line.text))
    .slice(0, 20).map((line) => ({
      ...item("Document correction", cite(line)),
      unclear: false,
      howToFix: "Address this quoted request with the responsible design professional and confirm the requirement with the City reviewer. Do not infer approval from this checklist.",
    }));
  const items = [...findings, ...routine];
  if (!items.length) items.push(item("Document review", `${name}: limited text screening did not identify a conflict. It cannot rule out conflicts in drawings, tables, unreadable annotations, or other documents. Have the City reviewer verify the complete package.`));
  return {
    address: "Uploaded document",
    summary: findings.length
      ? "Human review required. Potential measurement conflicts or safety-related information are identified below with source references. Do not rely on routine corrections alone."
      : "Limited document-text screening only—not permit approval or a safety determination. Check the cited requests with the City reviewer; drawings and other documents still require human review.",
    items,
  };
}