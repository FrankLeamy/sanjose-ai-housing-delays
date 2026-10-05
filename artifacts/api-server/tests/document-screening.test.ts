import assert from "node:assert/strict";
import test from "node:test";
import { extractText, getDocumentProxy } from "unpdf";
import { screenDocumentPages, unreadableDocument } from "../src/lib/document-screening.ts";

test("Conflicting dimensions include both quoted values, pages and human review", () => {
  const report = screenDocumentPages(["Front setback: 10 ft. Project plans.", "Front setback: 12 ft. Revised notes."], "plans.pdf");
  const conflict = report.items.find((item) => item.category === "Measurement conflict")!;
  assert.ok(conflict);
  assert.match(conflict.comment, /10 ft/);
  assert.match(conflict.comment, /12 ft/);
  assert.match(conflict.comment, /page 1/);
  assert.match(conflict.comment, /page 2/);
  assert.match(conflict.howToFix, /Human review required/);
  assert.match(report.summary, /Human review required/);
  assert.equal(conflict.status, "needs_fix");
  assert.equal(conflict.completed, false);
});

test("Equivalent units, different setbacks, limits and existing/proposed states are not contradictions", () => {
  for (const pages of [
    ["Door width: 36 in. Plan detail.", "Door width: 3 ft. Dimension schedule."],
    ["Front setback: 10 ft. Plan detail.", "Rear setback: 12 ft. Plan detail."],
    ["Minimum door width: 32 in. Requirement.", "Door width: 36 in. Proposed detail."],
    ["Existing building height: 20 ft.", "Proposed building height: 25 ft."],
    ["Ceiling height: 8'6\". Room detail.", "Ceiling height: 8.5 ft. Room detail."],
  ]) assert.ok(!screenDocumentPages(pages, "plans.pdf").items.some((item) => item.category === "Measurement conflict"));
});

test("Safety contradictions are escalated rather than resolved or marked met", () => {
  const report = screenDocumentPages(["Sprinklers are required for this project.", "Sprinklers are not required for this project."], "safety.pdf");
  const safety = report.items.find((item) => item.category === "Safety review")!;
  assert.match(safety.comment, /conflicting safety information/);
  assert.match(safety.comment, /not required/);
  assert.match(safety.howToFix, /licensed architect or engineer/);
  assert.ok(report.items.every((item) => item.status !== "met"));
});

test("Different safety topics or a required but missing feature are not called contradictory", () => {
  for (const pages of [
    ["Fire alarms are installed throughout.", "Gas ventilation is missing in the utility room."],
    ["Sprinklers are required for this project.", "Sprinklers are missing from the plans."],
  ]) {
    const safety = screenDocumentPages(pages, "safety.pdf").items.find((item) => item.category === "Safety review")!;
    assert.match(safety.comment, /needs expert verification/);
    assert.doesNotMatch(safety.comment, /conflicting safety information/);
  }
});

test("Unreadable or partially unreadable documents cannot appear approved", () => {
  assert.match(unreadableDocument("scan.png").summary, /not been verified/);
  assert.match(screenDocumentPages([""], "scan.pdf").summary, /Human review required/);
  const partial = screenDocumentPages(["Front setback: 10 ft. Front setback: 12 ft.", ""], "mixed.pdf");
  assert.ok(partial.items.some((item) => item.category === "Measurement conflict"));
  assert.ok(partial.items.some((item) => item.category === "Document review"));
});

test("Routine requests do not hide conflict warnings", () => {
  const report = screenDocumentPages(["Provide a stamped site plan.\nFront setback: 10 ft.\nFront setback: 12 ft."], "correction.pdf");
  assert.equal(report.items[0].category, "Measurement conflict");
  assert.ok(report.items.some((item) => item.category === "Document correction"));
  assert.match(report.summary, /Human review required/);
});

// Real text PDF fixture, without customer documents or external credentials.
export function makeTestPdf(lines: string[]): Uint8Array {
  const stream = `BT /F1 12 Tf 50 750 Td ${lines.map((line) => `(${line.replace(/[\\()]/g, "\\$&")}) Tj 0 -18 Td`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf));
}

test("Real PDF extraction feeds measurement conflicts into the report", async () => {
  const pdf = await getDocumentProxy(makeTestPdf(["Front setback: 10 ft.", "Front setback: 12 ft.", "Fire access is blocked."]));
  try {
    const extracted = await extractText(pdf, { mergePages: false });
    const report = screenDocumentPages(extracted.text, "actual-pdf.pdf");
    assert.ok(report.items.some((item) => item.category === "Measurement conflict"));
    assert.ok(report.items.some((item) => item.category === "Safety review"));
  } finally {
    await pdf.loadingTask.destroy();
  }
});