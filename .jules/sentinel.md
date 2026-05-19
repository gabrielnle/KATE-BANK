## 2024-05-24 - [Remove Hardcoded Secret]
**Vulnerability:** Found a hardcoded bank secret key in `kate-equity-crowdfunding/kate2/src/lib/stellar/client.ts`.
**Learning:** Hardcoded secrets could be inadvertently committed to version control and exposed, leading to unauthorized operations and financial loss.
**Prevention:** Always use environment variables for sensitive configuration details.
## 2024-05-18 - Prevent XSS in user-provided URLs
**Vulnerability:** A cross-site scripting (XSS) vulnerability existed where a user-provided URL (`offer.issuer.website`) was directly injected into an `href` attribute without validating the scheme, allowing potentially malicious protocols like `javascript:`.
**Learning:** React escapes text content but does not sanitize attributes like `href`. If a user provides `javascript:alert(1)`, clicking the link executes the JavaScript.
**Prevention:** Always sanitize user-provided URLs before using them in `href` or `src` attributes. Use a utility function (like `getSafeUrl`) to enforce allowed protocols (e.g., `http:`, `https:`) and reject others.
