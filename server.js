import express from 'express';
import { loadModel, LLAMA_3_2_1B_INST_Q4_0, completion, unloadModel } from '@qvac/sdk';
import { validateSignals } from './schema.js';
import { buildSummaryPrompt, judgeFromSignals, computeGaps, runCompletion } from './auditor.js';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

let modelId = null;

async function initializeModel() {
  try {
    console.log('Loading QVAC model...');
    modelId = await loadModel({
      modelSrc: LLAMA_3_2_1B_INST_Q4_0,
      onProgress: (p) => {
        const pct = p?.percentage?.toFixed(0) ?? '?';
        process.stdout.write('\rDownloading: ' + pct + '%   ');
      }
    });
    console.log('\nQVAC model ready.');
  } catch (error) {
    console.error('Failed to load model:', error);
    process.exit(1);
  }
}

app.post('/api/audit', async (req, res) => {
  const { claim, signals } = req.body;

  if (!claim || !signals) {
    return res.status(400).json({ error: 'Claim and signals are required.' });
  }

  try {
    const validatedSignals = validateSignals(signals);

    const verdict = judgeFromSignals(claim, validatedSignals);
    const gaps = computeGaps(claim, validatedSignals);

    const prompt = buildSummaryPrompt(validatedSignals);
    const raw = await runCompletion(completion, modelId, [{ role: 'user', content: prompt }]);
    let evidence = raw.trim().split('\n')[0].replace(/^Summary:\s*/i, '').trim();
    if (!evidence || evidence.length > 200) {
      evidence = 'Timeline recorded across the claimed window.';
    }

    res.json({ verdict, gaps, evidence });
  } catch (error) {
    console.error('Audit error:', error);
    res.status(500).json({ error: error.message || 'An unexpected error occurred.' });
  }
});

initializeModel().then(() => {
  app.listen(PORT, () => {
    console.log('Alibi server running at http://localhost:' + PORT);
  });
});
