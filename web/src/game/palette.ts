/** Charcoal, parchment, aged brass, slate; red only for danger. */
export const P = {
  ink: '#111213', night: '#17191a', char: '#1e2021', far: '#24272a', mid: '#2c2f31',
  iron: '#33302c', ironHi: '#4a453e', plate: '#2a2622', shadow: 'rgba(5,5,6,0.55)',
  slate: '#5d666b', slateHi: '#8f989b',
  brass: '#a8874f', brassDeep: '#76603a', brassHi: '#d2b67a',
  ivory: '#efe6cf', ivoryDim: '#b9af98',
  red: '#c8432f', redDim: '#6e2a22',
};

export function gear(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, teeth: number, rot: number, fill: string, stroke?: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  const inner = r * 0.84;
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const s = (Math.PI * 2) / teeth;
    ctx.lineTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a + s * 0.15) * r, Math.sin(a + s * 0.15) * r);
    ctx.lineTo(Math.cos(a + s * 0.45) * r, Math.sin(a + s * 0.45) * r);
    ctx.lineTo(Math.cos(a + s * 0.6) * inner, Math.sin(a + s * 0.6) * inner);
  }
  ctx.closePath();
  ctx.moveTo(r * 0.3, 0);
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2, true);
  ctx.fillStyle = fill;
  ctx.fill('evenodd');
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32);
      ctx.lineTo(Math.cos(a) * inner * 0.9, Math.sin(a) * inner * 0.9);
    }
    ctx.stroke();
  }
  ctx.restore();
}
