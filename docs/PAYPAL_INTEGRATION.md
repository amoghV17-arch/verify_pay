# PAYPAL_INTEGRATION.md

> **Verification rule:** the details below come from general knowledge of the PayPal REST APIs. Before implementing each call, open the official documentation at developer.paypal.com, confirm the endpoint, fields, and sandbox behavior, and record the date you verified in the "Verified" column. If the docs differ from this file, the docs win. Update this file.

**Sandbox base URL:** `https://api-m.sandbox.paypal.com`
**Guard:** refuse to run if `PAYPAL_ENV` is not `sandbox` or `mock`.

## 1. Honest framing: holding balance, not escrow

PayPal does not provide an escrow product for this flow. Milestone's platform business account receives the client's payment and the platform releases it to the freelancer through Payouts as milestones are approved. In all user-facing and submission text, call this a **milestone holding balance**, and note that a production version would need licensing and compliance review (money transmission rules, KYC, dispute handling). This is a strength in the write-up, not a weakness.

## 2. Calls used

| Purpose | API | Endpoint | Verified |
|---|---|---|---|
| Auth | OAuth2 client credentials | `POST /v1/oauth2/token` (basic auth with client id and secret, `grant_type=client_credentials`) | 2026-11-05 (RFC 6749, Basic Auth, 3600s cache) |
| Create funding order | Orders v2 | `POST /v2/checkout/orders` | 2026-11-05 (intent: CAPTURE, single purchase unit, amount in USD decimal) |
| Capture funding | Orders v2 | `POST /v2/checkout/orders/{id}/capture` | 2026-11-05 (captures[0].status COMPLETED, PayPal-Request-Id) |
| Get order (reconcile) | Orders v2 | `GET /v2/checkout/orders/{id}` | 2026-11-05 (id, status, purchase_units) |
| Release milestone | Payouts | `POST /v1/payments/payouts` | ☐ |
| Get payout batch (reconcile) | Payouts | `GET /v1/payments/payouts/{payout_batch_id}` | ☐ |
| Refund unreleased funds (stretch) | Payments v2 | `POST /v2/payments/captures/{capture_id}/refund` | ☐ |
| Verify webhook | Notifications | `POST /v1/notifications/verify-webhook-signature` | 2026-11-05 (auth_algo, cert_url, transmission_id, transmission_sig, transmission_time, webhook_id) |

Token handling: cache the access token in memory until shortly before it expires, refresh on 401 once, never log it.

## 3. Funding order

Create one order for the **whole project budget**.

```json
{
  "intent": "CAPTURE",
  "purchase_units": [{
    "reference_id": "project_<projectId>",
    "custom_id": "<projectId>",
    "description": "Milestone project funding: <title>",
    "amount": { "currency_code": "USD", "value": "600.00" }
  }]
}
```

- Send `PayPal-Request-Id: fund:<projectId>:<attempt>` so a retried create does not duplicate.
- The browser renders the PayPal Buttons using `createOrder` (your API) and `onApprove` (calls your capture endpoint).
- Map the capture to the project with `custom_id` (verify in the capture response or webhook resource that it is available; if not, store `orderId -> projectId` yourself at creation and look it up).
- Ledger entry `funded` uses idempotency key `fund:<projectId>:<captureId>`.

## 4. Release via Payouts
*(Verified against PayPal Payouts REST API docs on 2026-11-05: `POST /v1/payments/payouts` and `GET /v1/payments/payouts/{batch_id}`)*

```json
{
  "sender_batch_header": {
    "sender_batch_id": "ms_<milestoneId>",
    "email_subject": "Milestone payment released",
    "email_message": "<milestone name> was approved."
  },
  "items": [{
    "recipient_type": "EMAIL",
    "receiver": "<freelancer sandbox email>",
    "amount": { "currency": "USD", "value": "180.00" },
    "note": "<project title>: <milestone name>",
    "sender_item_id": "ms_<milestoneId>_item"
  }]
}
```

- `sender_batch_id` must be unique per milestone, which also protects against duplicates.
- Send header `PayPal-Request-Id: release:<milestoneId>`.
- Payout creation returns a batch with a status; the **final item status** arrives by webhook or by polling the batch. Treat only SUCCESS as paid. Treat FAILED, DENIED, RETURNED, BLOCKED, and similar terminal failures as `release_failed`. Treat PENDING and ONHOLD as still in progress. UNCLAIMED applies when the recipient has no PayPal account: show it as "waiting for the freelancer to claim" and do not mark it paid.
- If the first sandbox payout fails with an insufficient-funds or permission error, that is a **gate** (`HUMAN_TASKS.md` H3).

## 5. Webhooks

Endpoint: `POST /api/webhooks/paypal` (raw body needed for signature verification).

Events to subscribe to (verify exact names in the dashboard):
- `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`
- `CHECKOUT.ORDER.APPROVED` (optional, for diagnostics)
- `PAYMENT.PAYOUTSBATCH.SUCCESS`, `PAYMENT.PAYOUTSBATCH.DENIED` and item-level `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `PAYMENT.PAYOUTS-ITEM.FAILED`, `PAYMENT.PAYOUTS-ITEM.UNCLAIMED`, `PAYMENT.PAYOUTS-ITEM.RETURNED`, `PAYMENT.PAYOUTS-ITEM.BLOCKED`, `PAYMENT.PAYOUTS-ITEM.DENIED`

Handler rules:
1. Verify the signature by calling the verify API with the transmission headers, `PAYPAL_WEBHOOK_ID`, and the raw event body. Reject if the result is not `SUCCESS`.
2. Insert into `paypal_events` with a unique event id. If it already exists, return 200 and do nothing.
3. Apply the event in a transaction using the same ledger idempotency keys as the synchronous paths.
4. Return 200 quickly. Do slow work after responding.
5. Unknown event types: store, ignore, return 200.
6. In `mock` mode, verify an HMAC header using a shared secret instead.

## 6. Mock adapter

`mockAdapter` implements `PayPalPort` and:
- creates fake order ids, auto-approves on request, returns captures,
- emits webhook events to the app's own webhook handler after a configurable delay (default 500 ms),
- supports failure injection (`FAIL_NEXT_PAYOUT`, `DELAY_WEBHOOK_MS`, `DUPLICATE_WEBHOOK`) used by the failure drills,
- never talks to the network.

The e2e tests and the failure drills run on the mock. The sandbox smoke test (`pnpm smoke:sandbox`) proves the real adapter.

## 7. Reconciler (worker)

Every 30 seconds:
- milestones in `releasing` for more than 20 seconds with no webhook: `GET` the payout batch, apply the result.
- projects with an approved order but no `funded` ledger entry after 30 seconds: `GET` the order, apply the result.

## 8. Money rules

- Cents internally. Convert to `"180.00"` strings only inside the adapter.
- Percent to cents: largest-remainder method so milestone amounts always sum exactly to the project total.
- Currency: USD only for the demo. Say so in the limitations.
- Fees: sandbox payouts and captures may show fees. The holding balance is the captured gross amount; the write-up notes that production fee handling needs a decision (who bears fees).

## 9. Sandbox gotchas to check

- Webhooks require a public URL: use the Render deployment, or a tunnel (ngrok or cloudflared) for local testing.
- Webhook delivery can lag by seconds to minutes; the reconciler and a "Sync status" button cover it.
- Sandbox buyer login is needed to approve the order. For automated tests use the mock; for the video use a prepared, logged-in browser profile.
- Payout recipients must be sandbox accounts. Use the freelancer personal sandbox account email.
- Rate limits and occasional sandbox slowness: add timeouts and one retry with the same request id.

## 10. What to show judges about PayPal depth

- Orders, Payouts, Webhooks (with verification and dedupe), reconciliation, idempotency keys, and an append-only ledger.
- A short README section "Money safety" listing the invariants and the tests that prove them.
