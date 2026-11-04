# DESIGN.md

## 1. Design brief

- **Subject:** a workspace where a client and a freelancer share a project plan and the money attached to each milestone.
- **Audience:** a freelancer who has been paid late before, and a small-business client who is nervous about paying for work they cannot yet see. Both are non-experts in finance.
- **Primary job of the interface:** make it obvious, at a glance, **what is done, what is paid, and what is waiting on whom**.
- **Feeling:** calm, exact, fair. Closer to a well-kept workshop ledger than a fintech dashboard. Nothing flashy except one moment.

## 2. The one memorable thing: the settle moment

Everything is quiet and disciplined, so one thing can be remembered. When a payout succeeds:

1. The milestone's bar fills with the paid color in a left-to-right sweep (about 700 ms).
2. The milestone diamond releases a small coin marker showing the amount.
3. The coin travels along an arc to the freelancer's balance chip in the header (about 900 ms).
4. The chip's number counts up to the new total, and the Trust Panel adds the ledger entry with the PayPal reference.
5. A single `aria-live` announcement: "Milestone 2 paid, $180.00 to Arjun."

`prefers-reduced-motion`: skip the travel and sweep, show the final state with a brief highlight. No other autonomous motion in the app, except the review "in progress" texture (a slow diagonal stripe) which pauses under reduced motion.

## 3. Tokens

### Color (named values; use CSS variables)

| Token | Hex | Role |
|---|---|---|
| `--chalk` | `#F5F7F9` | App background (cool, not cream) |
| `--paper` | `#FFFFFF` | Surfaces |
| `--ink` | `#16202B` | Primary text |
| `--slate` | `#5B6B7C` | Secondary text, gridlines |
| `--line` | `#DDE3E9` | Borders, dividers |
| `--tide` | `#1F7A8C` | Funded (money committed) |
| `--brass` | `#B07A12` | In review / waiting |
| `--settled` | `#1D8F5A` | Paid |
| `--flag` | `#C8402F` | Changes requested, failures |
| `--focus` | `#2F5FD0` | Focus rings, links |

Money states are encoded by **fill treatment as well as color**, so color-blind users are not left out:

| State | Bar treatment |
|---|---|
| Unfunded | Dashed outline, no fill |
| Funded | Solid tide at 25% fill, tide outline, small filled circle on the diamond |
| In review | Brass stripe texture (slow), clock glyph |
| Changes requested | Flag outline, solid flag corner mark |
| Approved / releasing | Brass solid, small spinner |
| Paid | Solid settled fill, check glyph |

Check all text and meaningful graphics against WCAG AA contrast (4.5:1 text, 3:1 graphics). Adjust a hex if it fails. Do not use gradients as decoration.

### Typography

| Role | Typeface | Notes |
|---|---|---|
| Headings and numbers display | **Bricolage Grotesque** | Distinct, slightly quirky grotesque; use medium weights, tight but readable tracking |
| UI and body | **Instrument Sans** | Clean companion; use `font-variant-numeric: tabular-nums` for all money and dates |

Load from Google Fonts with `font-display: swap` and system fallbacks. Scale (px): 12, 14, 16, 20, 28, 40. Body 15 to 16 px, line height 1.5, line length under 75 characters. Sentence case everywhere. No all-caps labels. No eyebrow labels above headings. No decorative monospace.

### Space and shape

- 4 px base grid. Spacing steps: 4, 8, 12, 16, 24, 32, 48.
- Radius by role: 4 px for inputs and bars, 8 px for panels, 999 px only for chips and the avatar. Do not use one radius everywhere.
- Borders carry structure, shadows are used only for overlays (modals, popovers).

## 4. Layout

Desktop first (judges will watch on a laptop). Tablet works. Mobile gets a read-only workspace view.

```
+--------------------------------------------------------------------------+
| Milestone   Brand-site redesign   [Client | Freelancer]     Arjun  $180.00 |
+------------+------------------------------------------+------------------+
| Projects   |  Funds   $600 funded   $180 paid   $420 held               |
|  - Brand   |  [=====|=======.........]                                  |
|  - Docs    +-------------------------------------------+---------------+
|            |  BRYNTUM GANTT                            | Trust panel   |
|            |  task grid | timeline with bars,          | Milestone 2   |
|            |  dependencies, diamonds with amounts      | Criteria      |
|            |                                           |  [x] ...      |
|            |                                           | AI review     |
|            |                                           | Ledger        |
+------------+-------------------------------------------+---------------+
```

- Left rail: project list, collapsible.
- Top: project title, persona switch (demo only, labeled "Viewing as"), freelancer balance chip (the settle target).
- Funds meter: one horizontal bar split into paid, held (funded but not released), and unfunded, with plain numbers.
- Center: the Gantt, which takes most of the width.
- Right: the **Trust Panel**, a drawer that follows the selected milestone. Its sections:
  1. **Status and next step**, in one sentence ("Waiting for Arjun to submit", "AI review in progress").
  2. **Acceptance criteria**, each with a status mark once reviewed and an evidence line.
  3. **AI review**, with the live reasoning steps while running ("Reading the repo tree", "Checking the README for the install steps"), then the verdict and confidence per criterion.
  4. **Money**, with the amount, the ledger entries, and the PayPal reference for each.
  5. **History**, the activity trail with actor (client, freelancer, AI, system).

## 5. Screens

1. **Start.** A large text area for the brief, a budget field, and a "Create plan" button. Include one sample brief the user can click to fill. Empty state sentence: "Describe the work in your own words. The plan comes back with milestones you can edit."
2. **Plan review.** Gantt with the generated plan, editable. A side form shows milestone names, percentages (live total must equal 100), and criteria. Primary action: "Approve plan". Show assumptions from the AI in a collapsible list the user can accept or edit.
3. **Fund.** Summary of milestones and amounts, the PayPal buttons, and a note: "Funds are held for this project and released milestone by milestone." Success state shows the funded Gantt.
4. **Workspace.** As in the layout above.
5. **Submit deliverable (modal).** Choose the type that matches the milestone (text, repo link, URL, image, document text), shows the criteria checklist for reference, and a "Submit for review" button.
6. **Review result.** Inside the Trust Panel, not a separate page. Pass shows the settle moment (or "Released in 20 seconds unless the client objects" in assisted mode with a visible countdown). Fail shows a checklist of what to fix.
7. **Closeout.** A one-page receipt: what was delivered, what was paid and when, PayPal references, and a link to export the audit trail as JSON.

## 6. Components

- **Money chip:** amount in tabular numerals, state glyph, and a text state label on hover and for screen readers.
- **Milestone diamond (Gantt):** shows the amount on hover and always the glyph for its state.
- **Criteria row:** mark, text, evidence (collapsed by default), confidence meter.
- **Reasoning step list:** appended in real time, each with a short plain-language description and a duration.
- **Autonomy selector:** three options with a one-line consequence each ("You approve each payment", "Paid in 20 seconds unless you object", "Paid immediately when the AI is confident").
- **Toasts:** use sparingly, announce through `aria-live`.
- **Countdown ring** for assisted release.

## 7. Bryntum theming

- Use a Bryntum stylesheet theme as the base and override with the tokens above via CSS variables (verify variable names in the docs for the version in use).
- Custom milestone renderer draws the state glyph and amount; bars use the fill treatments above through CSS classes bound to `paymentStatus`.
- Hide Bryntum features that do not serve the story (for example heavy toolbars). Keep: dependencies, drag to reschedule, progress, task editor with the custom criteria fields, zoom.
- Stretch: critical path highlight and baselines as "what slipped" overlay.

## 8. Copy guidelines

- Sentence case, plain verbs, active voice. Name things by what users do: "Fund project", "Submit for review", "Release payment", "Request changes".
- Keep one name for an action across the flow ("Release payment" in the button, the toast, and the history).
- Errors say what happened and what to do next, without apology. Example: "The payout didn't go through. The milestone is still approved. Try again, or check the freelancer's PayPal email."
- AI is always labeled as AI ("AI review"), with confidence shown as words plus a meter ("High confidence").
- Money always shows currency symbol and two decimals. Dates are written the same way everywhere.
- Never imply the money is "in escrow". Use "held for this project".

Sample micro-copy:
| Where | Text |
|---|---|
| Plan review CTA | Approve plan |
| Fund CTA | Fund project |
| Funded toast | Project funded. $600.00 is held for this project. |
| Review running | AI review in progress. You can leave this page. |
| Changes requested | 2 criteria need work. See what to fix. |
| Injection flagged | The AI found instructions inside the deliverable and ignored them. A person needs to review this. |
| Assisted countdown | Releases in 14 seconds unless you object |
| Paid | Paid. $180.00 sent to Arjun. |
| Empty ledger | No payments yet. Entries appear here as milestones are paid. |

## 9. Accessibility checklist

- Fully keyboard operable, including the Trust Panel and the modals.
- Visible focus ring using `--focus`, 2 px, offset 2 px.
- Do not rely on color alone for any state (see the treatment table).
- `aria-live="polite"` region for state changes and the settle announcement.
- Respect `prefers-reduced-motion`.
- Minimum 44 px touch targets on tablet and mobile.
- Labels on every control, error text tied to inputs with `aria-describedby`.

## 10. Quality bar before feature freeze

- Screenshot every screen at 1440, 1024, and 390 px widths and review them critically.
- Remove one thing from each screen that does not serve the story.
- Check the first 5 seconds of the video flow: is the plan appearing in the Gantt clear and striking?
- Check that a person who has never seen the app can say what a green bar means within 5 seconds.
