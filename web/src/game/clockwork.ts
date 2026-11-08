const TURN = Math.PI * 2;

/** Canvas y increases downward, so increasing angles are clockwise from the front. */
export function clockHandAngles(time: number, offset = 0) {
  const elapsed = time + offset;
  return {
    minute: -Math.PI / 2 + elapsed * TURN / 60,
    hour: -Math.PI / 2 + elapsed * TURN / 720,
  };
}

export function clockFace(
  ctx: CanvasRenderingContext2D, x: number, y: number, radius: number,
  time: number, alpha: number, offset = x * 0.14 + radius * 6,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.fillStyle = '#191c1c';
  ctx.strokeStyle = '#84775b';
  ctx.lineWidth = Math.max(1, radius * 0.025);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TURN);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#a9a28e';
  for (let i = 0; i < 12; i++) {
    const angle = i * TURN / 12 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * radius * 0.82, Math.sin(angle) * radius * 0.82);
    ctx.lineTo(Math.cos(angle) * radius * 0.94, Math.sin(angle) * radius * 0.94);
    ctx.stroke();
  }
  const angles = clockHandAngles(time, offset);
  ctx.lineCap = 'round';
  for (const hand of [
    { angle: angles.hour, length: 0.48, width: 0.055, colour: '#c6b081' },
    { angle: angles.minute, length: 0.76, width: 0.032, colour: '#e3dbc7' },
  ]) {
    ctx.strokeStyle = hand.colour;
    ctx.lineWidth = Math.max(1, radius * hand.width);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(hand.angle) * radius * hand.length, Math.sin(hand.angle) * radius * hand.length);
    ctx.stroke();
  }
  ctx.fillStyle = '#b69c67';
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.5, radius * 0.055), 0, TURN);
  ctx.fill();
  ctx.restore();
}
