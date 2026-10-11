# ADR 0007: Session-only token storage
Status: accepted. The design says data is "cached locally for session only", so the JWT lives in `sessionStorage` and is gone when the tab closes. Short-lived tokens (`JWT_TTL_SECONDS`) and strict CSP/security headers limit XSS exposure. A cookie-based session is an alternative if refresh tokens are needed.
