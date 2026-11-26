# T&C Guardian

T&C Guardian turns dense Terms & Conditions into a fast, human-readable risk scan. Paste a policy, spot the clauses that matter, calculate the price behind a free trial, save deadlines, and copy a ready-to-send action draft.

## Features

- Rule-based clause detection for money, privacy, legal rights, and account control, with plain-English explanations and a weighted risk score.
- Three-item summary before detailed clause review.
- Recurring-cost calculator when trial, auto-renewal, and monthly price language are detected.
- Deadline countdowns, browser notification reminders, and `.ics` calendar exports.
- Copy-ready cancellation, data deletion, and arbitration opt-out drafts.
- Ask Guardian answers using the pasted terms, with clause citations and an offline rule-based fallback.
- Sample subscription terms, clear/reset actions, and a shareable text report.
- Reminder settings persist in localStorage. Pasted terms and scan results stay in page memory and are not saved.

## Tech stack

Next.js App Router, React, TypeScript, Tailwind CSS v4, Lucide icons, and the Vercel AI SDK with Vercel AI Gateway for the optional grounded assistant.

## Run locally

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env.local` if you want to configure the optional assistant.
3. Start the development server with `pnpm dev`.
4. Open `http://localhost:3000`.

The rule-based scanner, deadline tools, and action drafts work without AI configuration. The assistant endpoint uses Vercel AI Gateway in supported Vercel environments.

## Environment variables

- `AI_GATEWAY_API_KEY` — optional local AI Gateway credential, if your environment does not provide Gateway authentication automatically.

Do not commit `.env` files or real credentials.

## Offline fallback

If the assistant endpoint cannot respond, the UI switches to a local rule-based answer using detected clauses and the terms currently in the page. It displays an “Offline mode” note. When it cannot find a relevant clause, it says the pasted text does not answer the question rather than guessing. Rule-based scoring and analysis never depend on an AI response.

## Disclaimer

T&C Guardian is an explanation tool, not legal advice. It does not determine whether a term is enforceable or replace a qualified professional.
