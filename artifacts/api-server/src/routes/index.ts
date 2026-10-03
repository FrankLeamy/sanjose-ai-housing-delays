import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import permitsRouter from "./permits";
import questionsRouter from "./questions";
import documentsRouter from "./documents";
import submissionsRouter from "./submissions";
import staffRouter from "./staff";
import { requireUser } from "../middlewares/require-user";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(requireUser);
router.use(permitsRouter);
router.use(questionsRouter);
router.use(documentsRouter);
router.use(submissionsRouter);
router.use(staffRouter);

export default router;
