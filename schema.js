// schema.js — validates the timeline JSON that the user pastes in.

export function validateSignals(input) {
  if (!Array.isArray(input)) {
    throw new Error('Signals must be a JSON array like [{"time":"14:02",...}]');
  }

  if (input.length === 0) {
    throw new Error('Timeline is empty. Provide at least one signal.');
  }

  for (let i = 0; i < input.length; i++) {
    const s = input[i];

    if (typeof s !== 'object' || s === null) {
      throw new Error(`Signal #${i} is not an object.`);
    }
    if (typeof s.time !== 'string' || !/^\d{2}:\d{2}/.test(s.time)) {
      throw new Error(`Signal #${i} has a bad "time". Use "HH:MM".`);
    }
    if (typeof s.type !== 'string' || s.type.length === 0) {
      throw new Error(`Signal #${i} is missing a "type" string.`);
    }
    if (typeof s.detail !== 'string') {
      throw new Error(`Signal #${i} is missing a "detail" string.`);
    }
  }

  const times = input.map(s => s.time);
  const sorted = [...times].sort();
  for (let i = 0; i < times.length; i++) {
    if (times[i] !== sorted[i]) {
      throw new Error('Signals must be sorted by time, ascending.');
    }
  }

  return input;
}
