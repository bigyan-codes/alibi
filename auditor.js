// auditor.js — code judges, LLM summarizes.

export function buildSummaryPrompt(signals) {
  const times = signals.map(s => s.time).join(', ');
  return `Device activity was recorded at these times: ${times}.

Write ONE short sentence (under 15 words) describing the activity pattern. Just describe what you see — do not judge it.

Summary:`;
}

export async function runCompletion(completionFn, modelId, messages) {
  const result = completionFn({ modelId, history: messages, stream: true });
  let raw = '';
  for await (const token of result.tokenStream) raw += token;
  return raw;
}

// A signal is "activity" unless it explicitly says idle/away/etc.
function isActivity(s) {
  const txt = `${s.type} ${s.detail}`.toLowerCase();
  return !/(idle|away|afk|inactive|no input)/.test(txt);
}

export function computeGaps(claim, signals) {
  const times = claim.match(/\b(\d{1,2}):(\d{2})\b/g) || [];
  if (times.length < 2) return 'none';

  const start = toMinutes(times[0]);
  const end = toMinutes(times[1]);
  if (start == null || end == null || end <= start) return 'none';

  // Only count real activity as "presence".
  const inWindow = signals
    .filter(isActivity)
    .map(s => ({ ...s, mins: toMinutes(s.time) }))
    .filter(s => s.mins != null && s.mins >= start && s.mins <= end)
    .sort((a, b) => a.mins - b.mins);

  if (inWindow.length === 0) return `${times[0]}-${times[1]}`;

  const gaps = [];
  const GAP_THRESHOLD = 45;

  if (inWindow[0].mins - start >= GAP_THRESHOLD) {
    gaps.push(`${times[0]}-${inWindow[0].time}`);
  }
  for (let i = 1; i < inWindow.length; i++) {
    if (inWindow[i].mins - inWindow[i - 1].mins >= GAP_THRESHOLD) {
      gaps.push(`${inWindow[i - 1].time}-${inWindow[i].time}`);
    }
  }
  if (end - inWindow[inWindow.length - 1].mins >= GAP_THRESHOLD) {
    gaps.push(`${inWindow[inWindow.length - 1].time}-${times[1]}`);
  }

  return gaps.length > 0 ? gaps.join(', ') : 'none';
}

export function judgeFromSignals(claim, signals) {
  const times = claim.match(/\b(\d{1,2}):(\d{2})\b/g) || [];
  if (times.length < 2) return 'UNCERTAIN';

  const start = toMinutes(times[0]);
  const end = toMinutes(times[1]);
  if (start == null || end == null || end <= start) return 'UNCERTAIN';

  const activityInWindow = signals.filter(s => {
    if (!isActivity(s)) return false;
    const m = toMinutes(s.time);
    return m != null && m >= start && m <= end;
  });

  if (activityInWindow.length === 0) return 'INCONSISTENT';

  const gaps = computeGaps(claim, signals);
  return gaps === 'none' ? 'CONSISTENT' : 'INCONSISTENT';
}

function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
