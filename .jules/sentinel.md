## 2024-05-24 - [Remove Hardcoded Secret]
**Vulnerability:** Found a hardcoded bank secret key in `kate-equity-crowdfunding/kate2/src/lib/stellar/client.ts`.
**Learning:** Hardcoded secrets could be inadvertently committed to version control and exposed, leading to unauthorized operations and financial loss.
**Prevention:** Always use environment variables for sensitive configuration details.
## 2025-05-18 - XSS vulnerability in external links
**Vulnerability:** Potential XSS via unvalidated URL scheme in `src/app/offers/[id]/page.tsx`
**Learning:** React safely encodes children to prevent XSS, but it does NOT validate the `href` attribute of an `<a>` tag. Rendering a user-supplied URL with a malicious scheme (like `javascript:`) can lead to XSS.
**Prevention:** Always validate URLs before rendering them in `href` attributes. A simple way is to use a regular expression like `/^https?:\/\//i` to ensure the URL starts with `http://` or `https://`.
