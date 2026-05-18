## 2026-05-15 - Accessibility: Added aria-label to icon-only refresh button\n**Learning:** The LiveBalanceCard component relies on a title attribute for its icon-only refresh button, which isn't enough for screen readers. There is a general lack of focus styles for interactive elements.\n**Action:** Add aria-label and standard focus-visible styles to improve keyboard and screen reader accessibility.

## 2026-05-16 - Accessibility: Added aria-label to password toggle button
**Learning:** The password visibility toggle button lacked screen reader labels and focus styles. Icon-only buttons often miss these attributes, making them inaccessible to keyboard users and screen readers.
**Action:** Always add aria-label, title, and focus-visible styles to icon-only buttons.
