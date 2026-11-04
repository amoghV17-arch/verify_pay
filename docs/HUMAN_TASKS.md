# HUMAN_TASKS.md: what only the owner can do

Everything else is automated by the agent. These tasks need your identity, accounts, or judgment. The agent asks for each one at the moment it is needed, with these steps, and keeps working on unblocked tasks (using mock adapters) while it waits.

Dashboards change their labels from time to time. If a menu name differs from what is written here, look for the closest match.

| ID | Needed by | Task |
|---|---|---|
| H1 | M0 | Create the GitHub repo |
| H2 | M3 | PayPal developer account and sandbox app |
| H3 | M3 / M4 | Sandbox accounts and a Payouts check |
| H4 | M1 | Bryntum Gantt access (trial or licensed) |
| H5 | M5 | LLM API key |
| H6 | M11 | Free Postgres database |
| H7 | M11 | Render deployment |
| H8 | M11 | Register the PayPal webhook |
| H9 | M12 | Review the AI-tools explanation and limitations text |
| H10 | M13 | Record, upload, and submit |

## H1. GitHub repo (before M0)

1. Create a **public** repo named `milestone` on GitHub with the **MIT license** and a README.
2. Clone it, copy the contents of this kit into it, commit, and push.
3. Tell the agent the remote is set up.

## H2. PayPal developer account and sandbox app (before M3)

1. Sign in at developer.paypal.com with a PayPal account (a personal one is fine).
2. Go to the Apps and Credentials area, switch to the **Sandbox** tab, and create an app (type: Merchant).
3. Copy the **Client ID** and **Secret** into your local `.env` as `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Set `PAYPAL_ENV=sandbox`.
4. Never paste these into chat or commit them.

## H3. Sandbox accounts and Payouts check (before M3 and M4)

1. In the sandbox accounts area, confirm you have:
   - a **Business** account (this is the platform that receives the client's payment and sends payouts, created with the app),
   - a **Personal** account to act as the **client** (buyer),
   - a second **Personal** account to act as the **freelancer** (payout recipient).
2. Note the freelancer account's email. The agent will store it as `DEMO_FREELANCER_PAYPAL_EMAIL` in `.env`.
3. Check that **Payouts** works for the business account. If the agent's first sandbox payout fails with a permissions or insufficient-funds error, check the business account's settings and balance in the sandbox dashboard, and add test funds if needed. Tell the agent the exact error text.
4. Log in once to the sandbox site as the buyer and freelancer to confirm the logins work (sandbox account passwords are visible in the sandbox account details).

## H4. Bryntum Gantt access (before M1)

Bryntum is commercial software with a free trial.
1. Get the **trial** package route working: the agent will use the trial npm package so that anyone who clones the public repo can run it.
2. If the hackathon provides a sponsor license or the organizers gave you credentials, tell the agent whether you want to use the licensed package for the final build. Licensed packages need registry credentials, so **do not commit them** and keep the public repo runnable with the trial package.
3. Read Bryntum's license terms for the trial and for hackathon use, and confirm you are allowed to show it in a public demo and repo.

## H5. LLM API key (before M5)

1. Choose a provider you have credits or free-tier access for (the code supports Anthropic, Google Gemini, and any OpenAI-compatible endpoint).
2. Put the key in `.env` as `LLM_API_KEY`, set `LLM_PROVIDER` and `LLM_MODEL`.
3. Tell the agent which provider you chose, so the evals can be tuned for it. Use a stronger model for the final demo and evals, and a cheaper one for day-to-day iteration.

## H6. Free Postgres (before M11)

1. Create a free Postgres database with a provider whose free tier does not expire (for example Neon or Supabase).
2. Copy the connection string into `.env` as `DATABASE_URL`, and later into Render's environment settings.

## H7. Render deployment (before M11)

1. Create a Render account and connect your GitHub repo.
2. Use the `render.yaml` blueprint the agent creates, or create a Web Service manually with the build and start commands the agent gives you.
3. Add environment variables from `.env.example` (never commit values).
4. Copy the public URL to the agent.

## H8. Register the PayPal webhook (before M11 completes)

1. In the sandbox app's settings, add a webhook with URL `https://<your-render-url>/api/webhooks/paypal`.
2. Subscribe to the events the agent lists in `docs/PAYPAL_INTEGRATION.md`.
3. Copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID` (locally and on Render).
4. Trigger a test event or a full test payment and confirm the agent's smoke test passes.

## H9. Review honesty text (before M12 completes)

Read the README sections "AI tools used", "How the AI is kept safe", and "Limitations and production path". Correct anything that does not match your understanding. These are what judges read, and everything in them must be true.

## H10. Record, upload, submit (M13)

1. Run `pnpm demo:reset`, rehearse the video script 3 times, then record (screen plus voice) in one or two takes.
2. Upload to YouTube (unlisted or public as the rules require), under 3 minutes.
3. Fill in the submission form: repo URL, hosted demo URL, video URL, description, and AI-tools explanation. The agent drafts each text in `docs/DEMO_AND_SUBMISSION.md`.
4. Submit at least 24 hours before the deadline, and verify the submission page afterwards by opening each link in a private window.
