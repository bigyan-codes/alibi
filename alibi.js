// Alibi — on-device plausibility auditor. See README.md for usage.
// alibi.js — the main CLI.

import { loadModel, LLAMA_3_2_1B_INST_Q4_0, completion, unloadModel } from '@qvac/sdk';
import { validateSignals } from './schema.js';
import { buildSummaryPrompt, judgeFromSignals, computeGaps, runCompletion } from './auditor.js';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';

const args = process.argv.slice(2);
const demoArg = args.find(a => a.startsWith('--demo='));
const demoName = demoArg ? demoArg.split('=')[1] : null;
const claimArg = args.find(a => !a.startsWith('--'));

let claim = claimArg;

if (!claim && !demoName) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  claim = await rl.question('Your claim: ');
  rl.close();
}

let signals;

if (demoName) {
  const path = `./demo/${demoName}.json`;
  try {
    const text = await readFile(path, 'utf8');
    signals = JSON.parse(text);
  } catch (e) {
    console.error(`Could not read demo file ${path}: ${e.message}`);
    process.exit(1);
  }
  if (!claim) {
    claim = demoName === 'consistent'
      ? 'I was working on code between 14:00 and 16:00'
      : 'I was on a client call from 14:00 to 15:00';
  }
} else {
  if (process.stdin.isTTY) {
    console.error('No timeline provided. Either pipe JSON in or use --demo=consistent');
    process.exit(1);
  }
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const rawJson = Buffer.concat(chunks).toString('utf8').trim();
  if (!rawJson) {
    console.error('No timeline provided. Pipe JSON in, or use --demo=consistent');
    process.exit(1);
  }
  try {
    signals = JSON.parse(rawJson);
  } catch (e) {
    console.error('Timeline is not valid JSON:', e.message);
    process.exit(1);
  }
}

try {
  signals = validateSignals(signals);
} catch (e) {
  console.error('Timeline validation failed:', e.message);
  process.exit(1);
}

let modelId;

try {
  console.error('Loading model... (first run downloads it)');

  modelId = await loadModel({
    modelSrc: LLAMA_3_2_1B_INST_Q4_0,
    onProgress: (p) => {
      const pct = p?.percentage?.toFixed(0) ?? '?';
      process.stderr.write(`\rDownloading: ${pct}%   `);
    }
  });

  console.error('\nModel ready. Auditing...');

  // 1. Deterministic judgment.
  const verdict = judgeFromSignals(claim, signals);
  const gaps = computeGaps(claim, signals);

  // 2. LLM summarizes the evidence (neutral — cannot contradict verdict).
  const prompt = buildSummaryPrompt(signals);
  const raw = await runCompletion(completion, modelId, [{ role: 'user', content: prompt }]);
  let summary = raw.trim().split('\n')[0].replace(/^Summary:\s*/i, '').trim();
  if (!summary || summary.length > 200) {
    summary = 'Timeline recorded across the claimed window.';
  }

  console.log('');
  console.log('┌─────────────────────────────────────────');
  console.log(`│  CLAIM:   ${claim}`);
  console.log(`│  VERDICT: ${verdict}`);
  console.log('├─────────────────────────────────────────');
  console.log(`│  Evidence: ${summary}`);
  console.log(`│  GAPS: ${gaps}`);
  console.log('└─────────────────────────────────────────');

  signals = null;
  claim = null;
} catch (err) {
  console.error('\nSomething went wrong:', err.message);
  process.exitCode = 1;
} finally {
  if (modelId) {
    await unloadModel({ modelId });
  }
  console.error('Done. (No data was stored.)');
}
