import assert from 'node:assert/strict';
import { drawMechanism } from './gate';
import { makeMechanism } from './simulation';

function contextWithArcCounter() {
  const checkpointRadii: number[] = [];
  const text: string[] = [];
  const context = new Proxy({}, {
    get(_target, property) {
      if (property === 'arc') return (_x: number, _y: number, radius: number) => { checkpointRadii.push(radius); };
      if (property === 'fillText') return (value: string) => { text.push(value); };
      return () => {};
    },
    set() {
      return true;
    },
  }) as CanvasRenderingContext2D;
  return {
    context,
    getCheckpointArcs: () => checkpointRadii.filter(radius => radius >= 14).length,
    text,
  };
}

const available = contextWithArcCounter();
drawMechanism(available.context, makeMechanism(0), 0, 0, 'locked');
assert(available.getCheckpointArcs() > 0, 'an unsolved mechanism shows its checkpoint');
assert.deepEqual(available.text, [], 'a closed door carries no text label');

const answering = contextWithArcCounter();
drawMechanism(answering.context, makeMechanism(0), 0, 0, 'active');
assert.deepEqual(answering.text, [], 'the active doorway carries no text label');

const wrong = contextWithArcCounter();
drawMechanism(wrong.context, makeMechanism(0), 0, 0, 'wrong');
assert.deepEqual(wrong.text, [], 'a wrong answer adds no text label');

const completed = contextWithArcCounter();
drawMechanism(completed.context, { ...makeMechanism(0), solved: true, animation: 0.8 }, 0, 0, 'open');
assert.equal(completed.getCheckpointArcs(), 0, 'a solved mechanism no longer draws its checkpoint');
assert.deepEqual(completed.text, [], 'an open door carries no text label');

console.log('2D door rendering passed: framed door without text labels, checkpoint removal and open state.');
