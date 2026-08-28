export type MailshakeProviderWritePolicyMode =
  | "preview_allowlist"
  | "production_locked"
  | "unsupported_environment";

export type MailshakeProviderWritePolicy = {
  enabled: boolean;
  environment: string;
  mode: MailshakeProviderWritePolicyMode;
  allowedRecipientEmails: string[];
  reason: string;
};

function cleanText(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function normalizeEmail(
  value: unknown
) {
  return cleanText(
    value
  ).toLowerCase();
}

export function getMailshakeProviderWritePolicy(): MailshakeProviderWritePolicy {
  const environment =
    cleanText(
      process.env.VERCEL_ENV
    ).toLowerCase() ||
    "local";

  /*
   * Version 3.27H3A safety boundary:
   *
   * Production is deliberately and explicitly locked.
   * A later H3 revision must add a separate Production
   * authorization mechanism before this policy may allow
   * Production provider writes.
   */
  if (
    environment ===
    "production"
  ) {
    return {
      enabled:
        false,

      environment,

      mode:
        "production_locked",

      allowedRecipientEmails:
        [],

      reason:
        "Production Mailshake provider submission is explicitly locked. Version 3.27H3A does not authorize Production provider writes.",
    };
  }

  if (
    environment !==
    "preview"
  ) {
    return {
      enabled:
        false,

      environment,

      mode:
        "unsupported_environment",

      allowedRecipientEmails:
        [],

      reason:
        "Mailshake provider submission is currently enabled only on Vercel Preview deployments. Production remains explicitly locked.",
    };
  }

  const allowedRecipientEmails =
    Array.from(
      new Set(
        [
          cleanText(
            process.env.MAILSHAKE_PREVIEW_TEST_EMAILS
          ),
          cleanText(
            process.env.MAILSHAKE_PREVIEW_AUTHORIZED_TEST_EMAILS
          ),
        ]
          .join(",")
          .split(
            /[,;\n\r]+/
          )
          .map(
            normalizeEmail
          )
          .filter(Boolean)
      )
    );

  if (
    allowedRecipientEmails.length ===
    0
  ) {
    return {
      enabled:
        false,

      environment,

      mode:
        "preview_allowlist",

      allowedRecipientEmails,

      reason:
        "Mailshake provider submission is disabled because MAILSHAKE_PREVIEW_TEST_EMAILS is not configured for Preview.",
    };
  }

  return {
    enabled:
      true,

    environment,

    mode:
      "preview_allowlist",

    allowedRecipientEmails,

    reason:
      "Controlled Preview provider writes are enabled only for configured test recipients. Production remains explicitly locked.",
  };
}