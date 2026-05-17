# Product Ops Template

## 1. Current State

Describe the product, campaign, customer, and current workflow. Keep private details in your local copy, not in the public template.

## 2. Ideal State / Definition of Done

- [ ] The harness can identify high-signal moments or prospects for this product.
- [ ] Drafts are useful enough for an operator to approve, edit, or skip quickly.
- [ ] No live post can happen without approval, content filtering, daily cap checks, and STOP grace period.
- [ ] Runtime state, drafts, prospect data, credentials, and generated voice profiles remain uncommitted.

## 3. Gap

List the gap between the current workflow and the ideal operating loop.

## 4. Options Considered

Document the product channels, data sources, and outreach/content strategies considered.

## 5. Plan

**What I need from you**

- **Product brief** - problem, target user, promise, constraints.
- **Operator context** - X handle, voice source, approval channel.
- **Data source** - X cache, Discord channels, CSV, sheet, or other private source.

**My next steps**

- [ ] Fill in private `product.md`.
- [ ] Configure `.env`.
- [ ] Build voice profile.
- [ ] Run dry-run mining.
- [ ] Review Telegram drafts.
- [ ] Run verifier.

## 6. Execute Log

<!-- Newest entries first. Runtime appends here only in your private product spec. -->

## 7. Verification

Run:

```bash
cd harness
bun scripts/verify-harness
```

Manual checks:

- Telegram approval inbox receives drafts.
- `DRY_RUN=1` prevents live posting.
- STOP cancels during the grace window.
- Private files are ignored by git.

## 8. Retrospective

After a dry run or live run, record what worked, what failed, and whether to ship, revise, or stop.
