# Account recovery configuration

Password recovery is off by default. Configure these values in the installation's
protected runtime environment, then recreate the app service:

- `SMTP_URL`: the provider's SMTP connection URL, with URL-encoded credentials.
- `SMTP_FROM`: a sender address verified by that provider.
- `PASSWORD_RECOVERY_ENABLED=true`: enables the reset request endpoint and links.
- `REQUIRE_EMAIL_VERIFICATION=false`: preserves the existing sign-up policy.

SMTP availability does not change whether accounts must verify their email.
Enable `REQUIRE_EMAIL_VERIFICATION` only as an explicit account-policy change,
after verifying delivery and planning for existing unverified accounts.

Before enabling recovery, verify sender/domain ownership, TLS and actual email
delivery with the chosen provider. Test account creation, reset, expired links,
resending, delivery failure and successful sign-in. Resetting a password revokes
existing sessions. Accounts that do not exist receive the same request confirmation.

Recovery and verification tokens are carried in URL fragments and submitted in
POST bodies. Mail content and authentication links must never be logged. Do not
enable SMTP protocol debugging or capture request bodies at a reverse proxy.

The public capability `passwordRecoveryAvailable` requires both SMTP settings and
the explicit recovery flag. `emailVerificationRequired` reports the independent
verification policy. The existing account schema is unchanged.

For local tests, use a disposable SMTP capture server without outbound delivery.
Keep its HTTP interface private; captured messages contain usable test links.

An SMTP failure returns a retryable `503 EMAIL_DELIVERY_FAILED` response. The
request-scoped outcome guard is necessary because Better Auth catches mail
callback errors internally. It records only a boolean, keeps simultaneous
requests isolated, and never records message contents or authentication links.
