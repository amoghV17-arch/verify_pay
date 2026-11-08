# ACCEPTANCE_RUNBOOK.md: 4-Window Side-by-Side Live Verification Runbook

This runbook guides manual and automated side-by-side verification of Milestone with real PayPal Sandbox accounts before recording the demo video or submitting to judges.

---

## 1. Setup (10 Minutes)

### 1.1 Sandbox Accounts Required
In [developer.paypal.com](https://developer.paypal.com) under **Testing Tools > Sandbox Accounts**, identify three test accounts:
1. **Business Account (Platform / Facilitator):** Collects client funding capture and dispatches milestone payouts.
2. **Personal Buyer (Client Payer):** Used to log into the PayPal checkout popup and approve funding orders.
3. **Personal Freelancer (Payout Recipient):** Configured in `DEMO_FREELANCER_PAYPAL_EMAIL` to receive milestone payouts.

### 1.2 Browser Layout (Four Windows Side-by-Side)
Arrange four browser windows side by side (using separate private/incognito profiles to prevent PayPal session collisions):

| Window | Target URL / View | Role & Perspective |
|---|---|---|
| **Window A** | `https://verify-pay.onrender.com/client` (or Left Pane of `/demo/split`) | Client Persona (Project Planning, Funding, Review & Release) |
| **Window B** | `https://verify-pay.onrender.com/freelancer` (or Middle Pane of `/demo/split`) | Freelancer Persona (Deliverable Submission & Payment Receipt) |
| **Window C** | `https://sandbox.paypal.com` (Logged in as Freelancer Personal) | Freelancer PayPal Activity & Balance |
| **Window D** | `https://sandbox.paypal.com` (Logged in as Business Account) | Platform PayPal Activity & Balance |

*Optional 5th Tab:* Open `https://verify-pay.onrender.com/demo/proof` (or Right Pane of `/demo/split`) for live telemetry and reconciliation tape.

---

## 2. Verification Execution Matrix

| Step | Action (You Do) | Milestone App Response | PayPal Sandbox Reaction | Evidence to Capture |
|---|---|---|---|---|
| **Step 1: Plan** | Paste brief & budget on `/client/projects/new` | Real AI-generated schedule, milestones, and verifiable criteria. Call tape logs LLM request. | None (off-chain) | Model name, token counts, latency (ms) |
| **Step 2: Invite & Accept** | Generate invite link/code; accept in Window B | Project accepted; freelancer member added to project. | None | Invite code & acceptance timestamp |
| **Step 3: Fund** | Click "Fund with PayPal"; log in with Sandbox Buyer | Order captured; ledger records `funded` entry with capture ID. | **Window D:** Receives payment for exact project amount. **Buyer:** Payment sent. | Capture ID on both sides; exact cent match |
| **Step 4: Webhook** | Wait 3-5 seconds | Webhook tape displays `CHECKOUT.ORDER.APPROVED` / `PAYMENT.CAPTURE.COMPLETED` with verified signature. | **PayPal Developer Dashboard:** Event marked `200 Success`. | Webhook event ID and signature verification |
| **Step 5: Submit** | Submit prepared good deliverable in Window B | Reviewer agent evaluates observable criteria; verdict passes. | None | Review trace and criteria pass chips |
| **Step 6: Release Payout** | Click "Release Payout" in Window A | Status transitions to `releasing` then `paid`. Settle moment animation runs. | **Window C:** Payment received from Business account. **Window D:** Payout item debited. Balances updated. | Batch ID, Item ID, amounts, balance diff |
| **Step 7: Reconcile** | Open `/demo/proof` (or inspect 3rd Pane) | Every row shows **100% MATCH**. External call tape lists PayPal debug IDs. | N/A | Screenshot of matching reconciliation table |
| **Step 8: Injection Defense** | Submit injection deliverable on Milestone 2 | Flagged as injection attack; verdict escalated to human; **zero money moved**. | **Window C & D:** No new transaction or balance change. | Injection alert overlay; clean balances |

---

## 3. Automated Verification Script

To run the automated headless acceptance test suite locally or in CI:

```bash
pnpm acceptance:live
```

This verifies:
1. Operational health across `/status` and `/api/system/mode`.
2. Complete lifecycle reconciliation with canary values ($1,337.42 budget, Zebra Co, Quill).
3. Artificial mismatch injection test proving that tamper attempts trigger `matches: false` and `mismatch` alerts.
4. Generates `evals/results/acceptance-latest.json`.

