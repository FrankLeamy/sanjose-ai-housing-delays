import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { asc, desc, eq } from "drizzle-orm";
import { db, permitQuestionsTable, publicPermitsTable } from "@workspace/db";
import {
  AskPermitQuestionBody,
  AskPermitQuestionResponse,
  ListPermitQuestionsResponse,
} from "@workspace/api-zod";
import { answerFromPublicPermits, questionIntents, type QuestionIntent } from "../lib/public-permit-answers";

const router: IRouter = Router();

router.get("/questions", async (req, res): Promise<void> => {
  const questions = await db
    .select()
    .from(permitQuestionsTable)
    .where(eq(permitQuestionsTable.userId, req.session.userId!))
    .orderBy(desc(permitQuestionsTable.createdAt), desc(permitQuestionsTable.id));
  res.json(ListPermitQuestionsResponse.parse(questions));
});

router.post("/questions", async (req, res): Promise<void> => {
  const input = AskPermitQuestionBody.safeParse(req.body);
  const question = input.success ? input.data.question.trim() : "";
  if (!input.success || !question) {
    res.status(400).json({ error: "Please enter a permitting question (up to 5,000 characters)." });
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({ error: "Answer generation is not configured yet." });
    return;
  }

  let answer: string;
  try {
    const records = await db.select().from(publicPermitsTable).orderBy(asc(publicPermitsTable.displayOrder));
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            `Classify a question about a database of City of San José residential permits. Reply with exactly ONE of these intent words and nothing else: ${questionIntents.join(", ")}. Use status for a permit-number status question, adu for ADUs, review for under-review statuses, address for a project at an address, corrections for correction information, missing for missing fields, multifamily for apartments/townhouses, documents for attached documents, lookup for other record searches, and other when the question cannot be answered from permit records. Do not provide any permit facts.`,
        },
        { role: "user", content: question },
      ],
    });
    const intent = completion.choices[0]?.message?.content?.trim().toLowerCase() ?? "";
    if (!questionIntents.includes(intent as QuestionIntent)) {
      throw new Error("AI returned an invalid question classification");
    }
    answer = answerFromPublicPermits(question, intent as QuestionIntent, records);
  } catch (error) {
    req.log.error({ error }, "Could not generate permitting answer");
    res.status(502).json({ error: "Unable to generate an answer right now. Please try again." });
    return;
  }

  const [record] = await db
    .insert(permitQuestionsTable)
    .values({ userId: req.session.userId!, question, response: answer })
    .returning();
  res.status(201).json(AskPermitQuestionResponse.parse(record));
});

export default router;