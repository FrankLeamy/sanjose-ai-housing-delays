import { Router, type IRouter } from "express";
import {
  AnalyzeLetterBody,
  AnalyzeLetterResponse,
  GetReportParams,
  GetReportResponse,
  ListNotificationsResponse,
  ListSamplesResponse,
  UpdateReportItemBody,
  UpdateReportItemParams,
  UpdateReportItemResponse,
} from "@workspace/api-zod";

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
const reports = new Map<number, Report>();
const notifications: Array<{ id: number; message: string; createdAt: string }> = [];
let nextReportId = 1;

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

function buildReport(needsFixes: boolean): Report {
  const id = nextReportId++;
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

router.post("/analyze", (req, res): void => {
  const input = AnalyzeLetterBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Please choose a supported letter or sample." });
    return;
  }
  if (!input.data.sampleId && !input.data.fileData) {
    res.status(400).json({ error: "Please select a PDF, PNG, or JPG file." });
    return;
  }

  const needsFixes =
    input.data.sampleId === "needs-fixes" ||
    (input.data.fileName?.toLowerCase().includes("fix") ?? false);
  const report = buildReport(needsFixes);
  reports.set(report.id, report);
  notifications.unshift({
    id: notifications.length + 1,
    message: needsFixes
      ? "Your submission needs changes. See the items below."
      : "Good news! Your submission appears complete.",
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(AnalyzeLetterResponse.parse(report));
});

router.get("/reports/:id", (req, res): void => {
  const params = GetReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid report." });
    return;
  }
  const report = reports.get(params.data.id);
  if (!report) {
    res.status(404).json({ error: "Report not found." });
    return;
  }
  res.json(GetReportResponse.parse(report));
});

router.patch("/reports/:reportId/items/:itemId", (req, res): void => {
  const params = UpdateReportItemParams.safeParse(req.params);
  const body = UpdateReportItemBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid progress update." });
    return;
  }
  const report = reports.get(params.data.reportId);
  const item = report?.items.find((candidate) => candidate.id === params.data.itemId);
  if (!item) {
    res.status(404).json({ error: "Checklist item not found." });
    return;
  }
  item.completed = body.data.completed;
  res.json(UpdateReportItemResponse.parse(item));
});

router.get("/notifications", (_req, res): void => {
  res.json(ListNotificationsResponse.parse(notifications));
});

export default router;