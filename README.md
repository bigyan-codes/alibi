# Alibi

**An on-device witness that watches nothing. Forensics with instant amnesia.**

Alibi audits whether a claim about your own activity holds up against your
device's local signals — and forgets everything the moment the audit is done.

You type a claim, paste a timeline of local signals (file edits, screen state,
input events), and a small LLM running fully on-device via the QVAC SDK
returns CONSISTENT / INCONSISTENT / UNCERTAIN, plus any gaps. Raw signals are
never written to disk and never sent anywhere.

## Why

Plausibility auditing of your private activity is pointless if the data goes to
a cloud API. Alibi's entire premise is that the judgment happens on your
machine, and the evidence is discarded immediately after.

## Requirements

- Node.js >= 22.17
- npm >= 10.9
- macOS 14+ arm64 / Ubuntu 22+ / Windows 10+ x64 (Vulkan >= 1.4 required even for CPU-only)
- 4 GB RAM or more, 5 GB free disk (the model is a few hundred MB)

## Install

    git clone <your repo URL>
    cd alibi
    npm install

## Run

Try the built-in demos (no JSON to type):

    node alibi.js --demo=consistent
    node alibi.js --demo=inconsistent

Or pipe in your own timeline:

    echo '[{"time":"14:02","type":"file-edit","detail":"alibi.js modified"}]' | node alibi.js "I was working on code between 14:00 and 16:00"

## SDK version

Built against `@qvac/sdk` ^0.19.0, using `loadModel` + `completion`.

## How it works

Two jobs, cleanly separated:

1. **Verdict** — computed deterministically in code (judgeFromSignals in
   auditor.js). Given the claim's time window and the timeline, it counts
   genuine activity signals, excludes idle/away signals, and flags gaps over
   45 minutes. No LLM involved. Stable and reproducible.
2. **Narration** — the on-device LLM (via QVAC completion) writes a
   one-sentence neutral summary of the activity pattern. It never decides
   the verdict, so it cannot contradict it.

This split is deliberate: small on-device models are good at language but
unreliable at strict reasoning. We use each where it is strong.

## Privacy — the amnesia contract

- **No user data leaves the device.** The only network traffic ever is the
  one-time model download from the public QVAC registry (model weights, not
  user data).
- **No persistence.** Claim and signals exist only in RAM for one audit.
- **Post-verdict discard.** References are explicitly nulled after printing.
- **No telemetry, analytics, or crash reporters.**

"Instant amnesia" means nothing is persisted — signals do live in RAM
during the single inference call. Precision matters here.

## License

MIT
