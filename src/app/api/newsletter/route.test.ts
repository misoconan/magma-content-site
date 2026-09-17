import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestBrevoDoubleOptIn } = vi.hoisted(() => ({
  requestBrevoDoubleOptIn: vi.fn(),
}));

vi.mock("@/lib/brevo", () => ({ requestBrevoDoubleOptIn }));

import { POST } from "./route";

function newsletterRequest(body: BodyInit, contentType = "application/json") {
  return new Request("http://localhost/api/newsletter", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
}

describe("POST /api/newsletter", () => {
  beforeEach(() => {
    requestBrevoDoubleOptIn.mockReset();
  });

  it("returns 422 when the request body is not JSON", async () => {
    const response = await POST(
      newsletterRequest("not json", "text/plain") as never,
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      status: "invalid",
      field: "email",
      message: "유효한 이메일 주소를 입력해 주세요.",
    });
    expect(requestBrevoDoubleOptIn).not.toHaveBeenCalled();
  });

  it.each([undefined, 42, "not-an-email"])(
    "returns 422 when email is malformed: %j",
    async (email) => {
      const response = await POST(
        newsletterRequest(JSON.stringify({ email })) as never,
      );

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        status: "invalid",
        field: "email",
        message: "유효한 이메일 주소를 입력해 주세요.",
      });
      expect(requestBrevoDoubleOptIn).not.toHaveBeenCalled();
    },
  );

  it("returns accepted after normalizing a valid email", async () => {
    requestBrevoDoubleOptIn.mockResolvedValueOnce("accepted");

    const response = await POST(
      newsletterRequest(JSON.stringify({ email: "  READER@EXAMPLE.COM " })) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "accepted" });
    expect(requestBrevoDoubleOptIn).toHaveBeenCalledWith("reader@example.com");
  });

  it("returns rate_limited when the provider rate limits", async () => {
    requestBrevoDoubleOptIn.mockResolvedValueOnce("rate_limited");

    const response = await POST(
      newsletterRequest(JSON.stringify({ email: "reader@example.com" })) as never,
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({ status: "rate_limited" });
  });

  it("returns a private unavailable response when the provider is unavailable", async () => {
    requestBrevoDoubleOptIn.mockResolvedValueOnce("unavailable");

    const response = await POST(
      newsletterRequest(JSON.stringify({ email: "reader@example.com" })) as never,
    );

    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toBe(JSON.stringify({ status: "unavailable" }));
    expect(body).not.toContain("reader@example.com");
    expect(body.toLowerCase()).not.toContain("brevo");
  });
});
