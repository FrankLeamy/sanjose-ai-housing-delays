import { Router, type IRouter } from "express";
import healthRouter from "./health";
import permitsRouter from "./permits";
import questionsRouter from "./questions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(permitsRouter);
router.use(questionsRouter);

export default router;
