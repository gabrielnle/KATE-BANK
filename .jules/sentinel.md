## 2024-05-24 - [Remove Hardcoded Secret]
**Vulnerability:** Found a hardcoded bank secret key in `kate-equity-crowdfunding/kate2/src/lib/stellar/client.ts`.
**Learning:** Hardcoded secrets could be inadvertently committed to version control and exposed, leading to unauthorized operations and financial loss.
**Prevention:** Always use environment variables for sensitive configuration details.
