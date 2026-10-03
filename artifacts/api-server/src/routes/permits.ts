import { Router, type IRouter } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, notificationsTable, publicPermitsTable, reportsTable } from "@workspace/db";
import {
  AnalyzeLetterBody,
  AnalyzeLetterResponse,
  GetReportParams,
  GetReportResponse,
  ListNotificationsResponse,
  ListSamplesResponse,
  ListReportsResponse,
  ListPublicPermitsResponse,
  UpdateReportItemBody,
  UpdateReportItemParams,
  UpdateReportItemResponse,
} from "@workspace/api-zod";
import { prepareDocuments, saveSubmission, SubmissionInputError } from "../lib/submission-service";

type Item = {
  id: number;
  comment: string;
  status: "met" | "needs_fix";
  howToFix: string;
  department: string;
  category: string;
  unclear: boolean;
  completed: boolean;
};

type Report = {
  id: number;
  address: string;
  summary: string;
  createdAt: string;
  items: Item[];
};

const router: IRouter = Router();

const samples = [
  {
    id: "mostly-met",
    title: "Mostly met",
    description: "A residential addition with most requested revisions addressed.",
  },
  {
    id: "needs-fixes",
    title: "Needs several fixes",
    description: "A second-story project with FAR, size, and stamp corrections outstanding.",
  },
];

function buildReport(needsFixes: boolean, id: number): Report {
  const items: Item[] = [
    {
      id: id * 100 + 1,
      comment: "Provide a dimensioned site plan showing property lines and all required setbacks.",
      status: "met",
      howToFix: "No action needed. The revised plan includes the requested dimensions.",
      department: "Planning",
      category: "Missing site plan details",
      unclear: false,
      completed: false,
    },
    {
      id: id * 100 + 2,
      comment: needsFixes
        ? "Revise the floor area calculation. The submitted FAR of 0.49 exceeds the 0.45 limit."
        : "Provide a floor area calculation confirming compliance with the 0.45 FAR limit.",
      status: needsFixes ? "needs_fix" : "met",
      howToFix: needsFixes
        ? "Reduce counted floor area or revise the calculation to exclude only qualifying garages, basements, accessory structures, and ADUs. Show the math on the plans."
        : "No action needed. The revised calculation shows an FAR of 0.42.",
      department: "Planning",
      category: "Floor area ratio (FAR)",
      unclear: false,
      completed: false,
    },
    {
      id: id * 100 + 3,
      comment: needsFixes
        ? "The proposed second story appears larger than allowed for administrative review."
        : "Demonstrate that the second story is no more than 60% of the first-floor area.",
      status: needsFixes ? "needs_fix" : "met",
      howToFix: needsFixes
        ? "Reduce the second-story floor area to 60% or less of the first floor, including the attached garage, and show the additional 10-foot front setback."
        : "No action needed. The area diagram and setback dimension satisfy the request.",
      department: "Planning",
      category: "Second-story addition",
      unclear: false,
      completed: false,
    },
    {
      id: id * 100 + 4,
      comment: "Plans must bear the signature and stamp of the responsible design professional.",
      status: needsFixes ? "needs_fix" : "met",
      howToFix: needsFixes
        ? "Have the responsible architect or engineer sign and stamp every required plan sheet before resubmittal."
        : "No action needed. All required sheets are signed and stamped.",
      department: "Building",
      category: "Missing signature or stamp",
      unclear: false,
      completed: false,
    },
    {
      id: id * 100 + 5,
      comment: "Confirm fire apparatus access remains compliant throughout construction.",
      status: needsFixes ? "needs_fix" : "met",
      howToFix: needsFixes
        ? "Ask the Fire reviewer which access width, turning radius, and construction-phasing details are required before revising the plan."
        : "No action needed. The access plan is included.",
      department: "Fire",
      category: "Fire access requirement",
      unclear: needsFixes,
      completed: false,
    },
  ];

  return {
    id,
    address: needsFixes ? "1487 Alder Creek Drive" : "326 Juniper Avenue",
    summary: needsFixes
      ? "The resubmittal addresses the site plan request, but planning and building corrections remain. Focus on FAR, second-story size, professional stamps, and fire access clarification."
      : "The revised package appears to address the City’s principal planning, building, and fire comments. Keep the supporting calculations with the resubmittal.",
    createdAt: new Date().toISOString(),
    items,
  };
}

router.get("/samples", (_req, res): void => {
  res.json(ListSamplesResponse.parse(samples));
});

router.post("/analyze", async (req, res): Promise<void> => {
  const input = AnalyzeLetterBody.strict().safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Please choose a supported letter or sample." });
    return;
  }
  if (input.data.fileData || !input.data.sampleId && !input.data.documentId) {
    res.status(400).json({ error: "Please select a PDF, PNG, or JPG file." });
    return;
  }
  if (input.data.sampleId && !samples.some((sample) => sample.id === input.data.sampleId)) {
    res.status(400).json({ error: "Please choose a supported sample." }); return;
  }
  if (input.data.sampleId && input.data.documentId) {
    res.status(400).json({ error: "Choose a sample or an uploaded file, not both." }); return;
  }

  try {
  const documents = await prepareDocuments(input.data.documentId ? [input.data.documentId] : [], req.authUser!.id);
  const needsFixes =
    input.data.sampleId === "needs-fixes" ||
    (documents[0]?.name.toLowerCase().includes("fix") ?? false);
  const draft = buildReport(needsFixes, 0);
  const report = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(reportsTable)
      .values({
        userId: req.session.userId!,
        address: draft.address,
        summary: draft.summary,
        items: [],
      })
      .returning();
    const [saved] = await tx
      .update(reportsTable)
      .set({ items: buildReport(needsFixes, created.id).items })
      .where(eq(reportsTable.id, created.id))
      .returning();
    await tx.insert(notificationsTable).values({
      userId: req.session.userId!,
      message: needsFixes
        ? "Your submission needs changes. See the items below."
        : "Good news! Your submission appears complete.",
    });
    await saveSubmission(tx, {
      userId: req.authUser!.id, kind: "report", reportId: saved.id,
      subject: documents[0]?.name.slice(0, 200) ?? `Sample correction report: ${input.data.sampleId}`,
      address: saved.address, message: saved.summary,
    }, documents);
    return saved;
  });
  res.status(201).json(AnalyzeLetterResponse.parse(report));
  } catch (error) {
    if (error instanceof SubmissionInputError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});

router.get("/reports", async (req, res): Promise<void> => {
  const reports = await db
    .select()
    .from(reportsTable)
    .where(req.authUser!.role === "city_staff_admin" ? undefined : eq(reportsTable.userId, req.authUser!.id))
    .orderBy(desc(reportsTable.createdAt), desc(reportsTable.id));
  res.json(ListReportsResponse.parse(reports));
});

router.get("/public-permits", async (_req, res): Promise<void> => {
  const permits = await db
    .select({
      permitNumber: publicPermitsTable.permitNumber,
      address: publicPermitsTable.address,
      housingType: publicPermitsTable.housingType,
      projectDescription: publicPermitsTable.projectDescription,
      permitType: publicPermitsTable.permitType,
      status: publicPermitsTable.status,
      issuedDate: publicPermitsTable.issuedDate,
      finalDate: publicPermitsTable.finalDate,
      permitApprovals: publicPermitsTable.permitApprovals,
      sourceUrl: publicPermitsTable.sourceUrl,
      source: publicPermitsTable.source,
      dataLabel: publicPermitsTable.dataLabel,
    })
    .from(publicPermitsTable)
    .orderBy(asc(publicPermitsTable.displayOrder));
  res.json(ListPublicPermitsResponse.parse(permits));
});

router.get("/reports/:id", async (req, res): Promise<void> => {
  const params = GetReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid report." });
    return;
  }
  const [report] = await db
    .select()
    .from(reportsTable)
    .where(and(eq(reportsTable.id, params.data.id),
      req.authUser!.role === "city_staff_admin" ? undefined : eq(reportsTable.userId, req.authUser!.id)));
  if (!report) {
    res.status(403).json({ error: "Unauthorized access" });
    return;
  }
  res.json(GetReportResponse.parse(report));
});

router.patch("/reports/:reportId/items/:itemId", async (req, res): Promise<void> => {
  const params = UpdateReportItemParams.safeParse(req.params);
  const body = UpdateReportItemBody.strict().safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid progress update." });
    return;
  }
  const [report] = await db
    .select()
    .from(reportsTable)
    .where(and(eq(reportsTable.id, params.data.reportId), eq(reportsTable.userId, req.session.userId!)));
  if (!report) {
    res.status(403).json({ error: "Unauthorized access" }); return;
  }
  const item = report?.items.find((candidate) => candidate.id === params.data.itemId);
  if (!item) {
    res.status(404).json({ error: "Checklist item not found." });
    return;
  }
  const items = report.items.map((candidate) =>
    candidate.id === item.id ? { ...candidate, completed: body.data.completed } : candidate,
  );
  await db
    .update(reportsTable)
    .set({ items })
    .where(and(eq(reportsTable.id, report.id), eq(reportsTable.userId, req.session.userId!)));
  res.json(UpdateReportItemResponse.parse({ ...item, completed: body.data.completed }));
});

router.get("/notifications", async (req, res): Promise<void> => {
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.session.userId!))
    .orderBy(desc(notificationsTable.createdAt), desc(notificationsTable.id));
  res.json(ListNotificationsResponse.parse(notifications));
});

export default router;