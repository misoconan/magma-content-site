export type NewsletterResult =
  | { status: "accepted" }
  | { status: "invalid"; field: "email"; message: string }
  | { status: "rate_limited" }
  | { status: "unavailable" };

export const INVALID_NEWSLETTER_EMAIL_MESSAGE = "유효한 이메일 주소를 입력해 주세요.";

const EMAIL_RE = /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

export function normalizeNewsletterEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;

  const email = input.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}
