## 2026-05-15 - Accessibility: Added aria-label to icon-only refresh button\n**Learning:** The LiveBalanceCard component relies on a title attribute for its icon-only refresh button, which isn't enough for screen readers. There is a general lack of focus styles for interactive elements.\n**Action:** Add aria-label and standard focus-visible styles to improve keyboard and screen reader accessibility.

## 2024-05-17 - Accessibility: Programmatically associate label and input
**Learning:** Found an `input` element and its `label` element missing explicit association in `InvestCheckoutCard.tsx`. This causes screen readers to have a hard time announcing the input correctly and reduces click target size.
**Action:** Always link form labels to their inputs using `htmlFor` on the `<label>` matching the `id` on the `<input>` to improve accessibility and clickability.
