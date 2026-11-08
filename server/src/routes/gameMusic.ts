import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Router, type IRouter } from 'express';

// Resolved from the bundled dist/index.mjs, like the maths engine executable.
const MUSIC_FILE = path.resolve(import.meta.dirname, '../assets/grand-dark-waltz-allegro.mp3');

const router: IRouter = Router();
// Only this one bundled track is exposed. Range support is essential
// for selecting music passages without downloading the entire recording.
router.get('/math/music', async (req, res): Promise<void> => {
  const { size } = await stat(MUSIC_FILE);
  res.set({ 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' });
  let start = 0;
  let end = size - 1;
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) {
      res.set('Content-Range', `bytes */${size}`).sendStatus(416); return;
    }
    start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
    if (start > end || start >= size) {
      res.set('Content-Range', `bytes */${size}`).sendStatus(416); return;
    }
    res.status(206).set('Content-Range', `bytes ${start}-${end}/${size}`);
  }
  res.set('Content-Length', String(end - start + 1));
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(MUSIC_FILE, { start, end });
  stream.on('error', (error) => {
    req.log.error({ err: error }, 'Background music stream failed');
    res.destroy(error);
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
});

export default router;
