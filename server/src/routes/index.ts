import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mathRouter from "./math";
import gameMusicRouter from "./gameMusic";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mathRouter);
router.use(gameMusicRouter);

export default router;
