import { NextRequest, NextResponse } from "next/server";

import {
  INVALID_NEWSLETTER_EMAIL_MESSAGE,
  normalizeNewsletterEmail,
} from "@/lib/newsletter";
import { requestBrevoDoubleOptIn } from "@/lib/brevo";

const invalidEmailResponse = () =>
  NextResponse.json(
    {
      status: "invalid",
      field: "email",
      message: INVALID_NEWSLETTER_EMAIL_MESSAGE,
    },
    { status: 422 },
  );

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return invalidEmailResponse();
  }

  const email = normalizeNewsletterEmail(
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as { email?: unknown }).email
      : undefined,
  );

  if (!email) return invalidEmailResponse();

  try {
    const outcome = await requestBrevoDoubleOptIn(email);

    if (outcome === "accepted") {
      return NextResponse.json({ status: "accepted" });
    }

    if (outcome === "rate_limited") {
      return NextResponse.json({ status: "rate_limited" }, { status: 429 });
    }
  } catch {
    // Return the same public response for unexpected adapter failures.
  }

  return NextResponse.json({ status: "unavailable" }, { status: 503 });
}
