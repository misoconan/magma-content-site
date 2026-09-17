import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import NewsletterSignup from "./NewsletterSignup";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function submitEmail(email = "reader@example.com") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("이메일 주소"), email);
  await user.click(screen.getByRole("button", { name: "구독 신청" }));
}

describe("NewsletterSignup", () => {
  it("renders an accessible email field", () => {
    render(<NewsletterSignup />);

    expect(screen.getByLabelText("이메일 주소")).toHaveAttribute("type", "email");
    expect(screen.getByRole("button", { name: "구독 신청" })).toBeEnabled();
  });

  it("disables submission and announces Korean progress while a request is pending", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    render(<NewsletterSignup />);

    await submitEmail();

    expect(screen.getByRole("button", { name: "구독 처리 중…" })).toBeDisabled();
    expect(screen.getByText("구독 처리 중…")).toBeInTheDocument();
  });

  it("replaces the form with a success region after acceptance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "accepted" }))),
    );
    render(<NewsletterSignup />);

    await submitEmail();

    expect(await screen.findByRole("status")).toHaveTextContent("확인 이메일을 보냈습니다");
    expect(screen.queryByRole("button", { name: "구독 신청" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("이메일 주소")).not.toBeInTheDocument();
  });

  it("retains the email and announces a generic alert when an unsuccessful response claims acceptance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "accepted" }), { status: 500 })),
    );
    render(<NewsletterSignup />);

    await submitEmail();

    expect(await screen.findByRole("alert")).toHaveTextContent("현재 구독을 처리할 수 없습니다");
    expect(screen.getByLabelText("이메일 주소")).toHaveValue("reader@example.com");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it.each(["invalid", "rate_limited", "unavailable"] as const)(
    "retains the email and announces an alert for a %s API response",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ status }))),
      );
      render(<NewsletterSignup />);

      await submitEmail();

      expect(await screen.findByRole("alert")).toBeInTheDocument();
      expect(screen.getByLabelText("이메일 주소")).toHaveValue("reader@example.com");
    },
  );

  it("announces a rate-limit alert without marking or describing the email field as invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "rate_limited" }), { status: 429 })),
    );
    render(<NewsletterSignup />);

    await submitEmail();

    expect(await screen.findByRole("alert")).not.toHaveAttribute("id");
    expect(screen.getByLabelText("이메일 주소")).not.toHaveAttribute("aria-describedby");
    expect(screen.getByLabelText("이메일 주소")).not.toHaveAttribute("aria-invalid");
  });

  it("associates a displayed error alert with the email field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "invalid", field: "email", message: "유효한 이메일 주소를 입력해 주세요." }), {
          status: 400,
        }),
      ),
    );
    render(<NewsletterSignup />);

    await submitEmail();

    expect(await screen.findByRole("alert")).toHaveAttribute("id", "newsletter-email-error");
    expect(screen.getByLabelText("이메일 주소")).toHaveAttribute("aria-describedby", "newsletter-email-error");
    expect(screen.getByLabelText("이메일 주소")).toHaveAttribute("aria-invalid", "true");
  });

  it("retains the email and announces an alert after a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<NewsletterSignup />);

    await submitEmail();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("이메일 주소")).toHaveValue("reader@example.com");
  });
});
