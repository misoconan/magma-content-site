import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { requestBrevoDoubleOptIn } from "./brevo";

const requiredEnvironment = {
  BREVO_API_KEY: "brevo-test-key",
  BREVO_LIST_ID: "27",
  BREVO_DOI_TEMPLATE_ID: "42",
  BREVO_DOI_REDIRECT_URL: "https://magma.example/newsletter/confirmed",
};
const originalEnvironment = { ...process.env };
const fetchMock = vi.fn();

describe("requestBrevoDoubleOptIn", () => {
  beforeEach(() => {
    process.env = { ...originalEnvironment, ...requiredEnvironment };
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["BREVO_API_KEY", ""],
    ["BREVO_LIST_ID", "0"],
    ["BREVO_DOI_TEMPLATE_ID", "42.5"],
    ["BREVO_DOI_REDIRECT_URL", "http://magma.example/confirmed"],
  ])("does not request when %s is invalid", async (name, value) => {
    process.env[name] = value;

    await expect(requestBrevoDoubleOptIn("reader@example.com")).resolves.toBe(
      "unavailable",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not request when a required environment variable is absent", async () => {
    delete process.env.BREVO_API_KEY;

    await expect(requestBrevoDoubleOptIn("reader@example.com")).resolves.toBe(
      "unavailable",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits configured DOI request", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));

    await expect(requestBrevoDoubleOptIn("reader@example.com")).resolves.toBe(
      "accepted",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/contacts/doubleOptinConfirmation",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: {
          "api-key": "brevo-test-key",
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "reader@example.com",
          includeListIds: [27],
          templateId: 42,
          redirectionUrl: "https://magma.example/newsletter/confirmed",
        }),
      }),
    );
  });

  it("aborts timed-out requests and maps them to unavailable", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, request?: RequestInit) =>
        new Promise((_, reject) => {
          request?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Request timed out", "AbortError")),
            { once: true },
          );
        }),
    );

    const outcome = requestBrevoDoubleOptIn("reader@example.com");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(request.signal).toBeInstanceOf(AbortSignal);

    await vi.advanceTimersByTimeAsync(10_000);
    await expect(outcome).resolves.toBe("unavailable");
  });

  it("returns unavailable when a provider error body stalls past the deadline", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => new Promise<never>(() => undefined),
    } as unknown as Response);

    const outcome = requestBrevoDoubleOptIn("reader@example.com");

    await vi.advanceTimersByTimeAsync(10_000);
    await expect(outcome).resolves.toBe("unavailable");
  });

  it("maps duplicates and rate limits", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "duplicate_parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(requestBrevoDoubleOptIn("reader@example.com")).resolves.toBe(
      "accepted",
    );

    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));

    await expect(requestBrevoDoubleOptIn("reader@example.com")).resolves.toBe(
      "rate_limited",
    );
  });

  it("hides provider failures", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ message: "reader@example.com brevo-test-key" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(requestBrevoDoubleOptIn("reader@example.com")).resolves.toBe(
      "unavailable",
    );
    expect(spy).toHaveBeenCalledWith("brevo_doi_request_failed", 500);
    expect(spy.mock.calls.flat().join(" ")).not.toContain("reader@example.com");
  });

  it("hides email and API key when fetch rejects", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(
      new Error("reader@example.com brevo-test-key transport failure"),
    );

    await expect(requestBrevoDoubleOptIn("reader@example.com")).resolves.toBe(
      "unavailable",
    );
    expect(spy).not.toHaveBeenCalled();
  });
});
