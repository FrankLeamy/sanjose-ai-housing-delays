import { Router, type IRouter } from "express";
import OpenAI from "openai";
import { desc, eq } from "drizzle-orm";
import { db, permitQuestionsTable } from "@workspace/db";
import {
  AskPermitQuestionBody,
  AskPermitQuestionResponse,
  ListPermitQuestionsResponse,
} from "@workspace/api-zod";

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
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a permitting assistance guide. Give useful, plain-language guidance about building permits and city correction requests. Explain likely next steps and what information to confirm with the relevant city department. Do not claim to approve a permit, invent jurisdiction-specific rules, or present uncertain requirements as certain. If the question is ambiguous, say what details are needed. Keep the answer clear and practical.",
        },
        { role: "user", content: question },
      ],
    });
    answer = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!answer) {
      throw new Error("AI returned an empty response");
    }
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