import type { PublicPermit } from "@workspace/db";

export const INSUFFICIENT_RECORDS =
  "I could not find enough information in the available permit records.";
export const ANSWER_LABEL = "AI-generated explanation — verify with the City.";

export const questionIntents = [
  "status",
  "adu",
  "review",
  "address",
  "corrections",
  "missing",
  "multifamily",
  "documents",
  "lookup",
  "other",
] as const;
export type QuestionIntent = (typeof questionIntents)[number];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const display = (value: string) => value.trim().replace(/\s+/g, " ").replace(/\s+,/g, ",");
const permitPattern = /\b\d{4}-\d{6}-(?:RS|MF)\b/i;
const ignoredWords = new Set([
  "about", "any", "are", "can", "city", "could", "database", "find", "for",
  "from", "have", "housing", "information", "is", "me", "of", "permit", "permits",
  "please", "project", "record", "records", "residential", "show", "the", "this",
  "what", "which", "with", "would", "you",
]);

function findAddress(question: string, records: PublicPermit[]): PublicPermit | undefined {
  const match = question.match(/\bat\s+(.+?)(?:\?|$)/i);
  if (!match || match[1].includes("[") || !/\d/.test(match[1])) return;
  const address = normalize(match[1]);
  if (address.length < 7) return;
  return records.find((record) => {
    const stored = normalize(record.address);
    return stored.startsWith(address) || address.startsWith(stored);
  });
}

function relatedRecord(record: PublicPermit): string {
  return `Permit ${record.permitNumber} · ${display(record.address)} · Status: ${record.status} · Project type: ${display(record.housingType)}\nOfficial source: ${record.sourceUrl}`;
}

function withRecords(summary: string, records: PublicPermit[]): string {
  return `${ANSWER_LABEL}\n\n${summary}\n\n${records.map(relatedRecord).join("\n\n")}`;
}

function notEnough(records: PublicPermit[] = []): string {
  return records.length
    ? withRecords(INSUFFICIENT_RECORDS, records)
    : `${ANSWER_LABEL}\n\n${INSUFFICIENT_RECORDS}`;
}

export function answerFromPublicPermits(
  question: string,
  intent: QuestionIntent,
  records: PublicPermit[],
): string {
  const number = question.match(permitPattern)?.[0].toUpperCase();
  const exact = number ? records.find((record) => record.permitNumber === number) : undefined;
  if (number && !exact) return notEnough();

  if (intent === "corrections" || intent === "documents") {
    // PERMITAPPROVALS is review sign-off text, not a correction or document field.
    return notEnough(exact ? [exact] : []);
  }

  if (intent === "missing") {
    if (!exact) return notEnough();
    const missing = [
      ...(!exact.finalDate ? ["final date"] : []),
      "application and approval dates",
      "correction details",
      "attached documents",
    ];
    return withRecords(`The available record does not provide ${missing.join(", ")}.`, [exact]);
  }

  if (intent === "review") {
    const underReview = records.filter((record) => /\breview\b/i.test(record.status));
    return underReview.length
      ? withRecords(`I found ${underReview.length} permit${underReview.length === 1 ? "" : "s"} marked under review in the available records.`, underReview.slice(0, 3))
      : notEnough();
  }

  if (intent === "adu" || intent === "multifamily") {
    const matches = records.filter((record) => intent === "adu"
      ? /\badu\b|accessory dwelling/i.test(record.housingType)
      : /apartment|townhouse|multi.?family/i.test(record.housingType));
    const kind = intent === "adu" ? "ADU" : "multifamily housing";
    return matches.length
      ? withRecords(`I found ${matches.length} ${kind} permit${matches.length === 1 ? "" : "s"} in the available records. Here are ${Math.min(matches.length, 3)}:`, matches.slice(0, 3))
      : notEnough();
  }

  if (intent === "status") {
    return exact
      ? withRecords(`The available City record lists this permit as ${exact.status}.`, [exact])
      : notEnough();
  }

  if (intent === "address") {
    const match = exact ?? findAddress(question, records);
    return match
      ? withRecords(`The available record describes this as ${display(match.housingType)}: ${display(match.projectDescription)}.`, [match])
      : notEnough();
  }

  if (exact) {
    return withRecords(`The available record describes ${display(exact.projectDescription)}.`, [exact]);
  }

  if (intent === "other") return notEnough();

  const terms = normalize(question).split(" ").filter((term) => term.length > 2 && !ignoredWords.has(term));
  if (!terms.length) return notEnough();
  const matches = records
    .map((record) => {
      const text = normalize([record.address, record.housingType, record.projectDescription, record.permitType, record.status].join(" "));
      return { record, score: terms.filter((term) => text.split(" ").includes(term)).length };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ record }) => record);
  return matches.length
    ? withRecords(`I found ${matches.length} related permit record${matches.length === 1 ? "" : "s"} in the available data.`, matches)
    : notEnough();
}