import { Router, type IRouter } from 'express';
import {
  CreateMathQuestionBody, CreateMathQuestionResponse,
  SubmitMathAnswerBody, SubmitMathAnswerResponse, MathHealthResponse,
} from '@lambda-rush/api-schemas';
import { MATH_ORIGIN } from '../lib/math-engine';

const router: IRouter = Router();

router.post('/math/question', async (req, res): Promise<void> => {
  const parsed = CreateMathQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid question request' });
    return;
  }
  try {
    const response = await fetch(`${MATH_ORIGIN}/math/question`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      res.status(response.status).json(await response.json());
      return;
    }
    res.json(CreateMathQuestionResponse.parse(await response.json()));
  } catch (error) {
    req.log.error({ error }, 'Mathematics service question failure');
    res.status(503).json({ error: 'Haskell mathematics engine unavailable. Retry the connection.' });
  }
});

router.post('/math/answer', async (req, res): Promise<void> => {
  const parsed = SubmitMathAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid answer request' });
    return;
  }
  try {
    const response = await fetch(`${MATH_ORIGIN}/math/answer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      res.status(response.status).json(await response.json());
      return;
    }
    res.json(SubmitMathAnswerResponse.parse(await response.json()));
  } catch (error) {
    req.log.error({ error }, 'Mathematics service answer failure');
    res.status(503).json({ error: 'Haskell mathematics engine unavailable. Retry the connection.' });
  }
});

router.get('/math/health', async (req, res): Promise<void> => {
  try {
    const result = await fetch(`${MATH_ORIGIN}/math/health`, { signal: AbortSignal.timeout(1500) });
    res.json(MathHealthResponse.parse(await result.json()));
  } catch (error) {
    req.log.warn({ error }, 'Haskell engine health check failed');
    res.status(503).json({ error: 'Haskell mathematics engine unavailable' });
  }
});

export default router;
