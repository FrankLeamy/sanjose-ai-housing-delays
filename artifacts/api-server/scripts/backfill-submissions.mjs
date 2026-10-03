import pg from "pg";

// Idempotent, additive: account-owned source records remain unchanged.
export async function backfillSubmissions(client) {
  await client.query(`
    INSERT INTO submissions (user_id, kind, subject, address, message, report_id, created_at, updated_at)
    SELECT user_id, 'report', 'Correction report: ' || address, address, summary, id, created_at, created_at
    FROM reports ON CONFLICT (report_id) DO NOTHING
  `);
  await client.query(`
    INSERT INTO submissions (user_id, kind, subject, message, question_id, created_at, updated_at)
    SELECT user_id, 'question', left(question, 200), question, id, created_at, created_at
    FROM permit_questions WHERE user_id IS NOT NULL ON CONFLICT (question_id) DO NOTHING
  `);
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await backfillSubmissions(client);
    await client.query("COMMIT");
    console.log("Existing account-owned reports and questions added to the review queue. No source records changed.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}