import { describe, expect, it } from "vitest";
import {
  INVALID_NEWSLETTER_EMAIL_MESSAGE,
  normalizeNewsletterEmail,
  type NewsletterResult,
} from "@/lib/newsletter";

describe("normalizeNewsletterEmail", () => {
  it("trims and lowercases a valid email address", () => {
    expect(normalizeNewsletterEmail("  READER@EXAMPLE.COM  ")).toBe("reader@example.com");
  });

  it.each([null, undefined, 42, {}, []])("rejects non-string input: %j", (input) => {
    expect(normalizeNewsletterEmail(input)).toBeNull();
  });

  it.each(["", "   ", "reader", "reader@", "@example.com", "reader@example", "reader @example.com"])(
    "rejects an invalid email address: %j",
    (input) => {
      expect(normalizeNewsletterEmail(input)).toBeNull();
    },
  );

  it("rejects an address with a leading local-part dot", () => {
    expect(normalizeNewsletterEmail(".reader@example.com")).toBeNull();
  });

  it("rejects an address with a trailing local-part dot", () => {
    expect(normalizeNewsletterEmail("reader.@example.com")).toBeNull();
  });

  it("rejects an address with consecutive local-part dots", () => {
    expect(normalizeNewsletterEmail("reader..two@example.com")).toBeNull();
  });
});

describe("NewsletterResult", () => {
  it("includes the public rate_limited response", () => {
    const result: NewsletterResult = { status: "rate_limited" };

    expect(result).toEqual({ status: "rate_limited" });
  });
});

describe("INVALID_NEWSLETTER_EMAIL_MESSAGE", () => {
  it("exports the shared Korean invalid-email message", () => {
    expect(INVALID_NEWSLETTER_EMAIL_MESSAGE).toBe("유효한 이메일 주소를 입력해 주세요.");
  });
});
