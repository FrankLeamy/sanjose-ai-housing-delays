import { Router, type IRouter } from "express";
import healthRouter from "./health";
import permitsRouter from "./permits";

const router: IRouter = Router();

router.use(healthRouter);
router.use(permitsRouter);

export default router;
