"use client";

import { type FormEvent, useState } from "react";

import type { NewsletterResult } from "@/lib/newsletter";

type SignupState = "idle" | "pending" | "accepted" | "error";

const GENERIC_ERROR_MESSAGE = "현재 구독을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.";

function isNewsletterResult(value: unknown): value is NewsletterResult {
  if (typeof value !== "object" || value === null) return false;

  const response = value as Record<string, unknown>;
  if (response.status === "accepted" || response.status === "rate_limited" || response.status === "unavailable") {
    return true;
  }

  return response.status === "invalid" && response.field === "email" && typeof response.message === "string";
}

function errorMessageFor(response: NewsletterResult) {
  if (response.status === "invalid") {
    return response.message ?? "유효한 이메일 주소를 입력해 주세요.";
  }

  if (response.status === "rate_limited") {
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  }

  return GENERIC_ERROR_MESSAGE;
}

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SignupState>("idle");
  const [error, setError] = useState("");
  const [hasEmailValidationError, setHasEmailValidationError] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("pending");
    setError("");
    setHasEmailValidationError(false);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      let body: unknown;

      try {
        body = await response.json();
      } catch {
        setError(GENERIC_ERROR_MESSAGE);
        setState("error");
        return;
      }

      if (!isNewsletterResult(body) || (!response.ok && body.status === "accepted")) {
        setError(GENERIC_ERROR_MESSAGE);
        setState("error");
        return;
      }

      if (response.ok && body.status === "accepted") {
        setState("accepted");
        return;
      }

      setHasEmailValidationError(body.status === "invalid");
      setError(errorMessageFor(body));
      setState("error");
    } catch {
      setError("네트워크 연결을 확인한 뒤 다시 시도해 주세요.");
      setState("error");
    }
  }

  return (
    <section className="container-page py-16" aria-labelledby="newsletter-heading">
      <div className="rounded-card border border-line bg-card p-6 sm:p-8">
        <p className="eyebrow mb-2">뉴스레터</p>
        <h2 id="newsletter-heading" className="font-display text-2xl font-bold text-primary sm:text-3xl">
          MAGMA의 소식을 받아보세요
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-sub">
          이메일은 브랜드와 저널 소식 전달에만 사용합니다. 구독은 이메일 확인 후 완료되며,
          언제든 구독을 취소할 수 있으며, 12개월 동안 비활성인 데이터는 삭제합니다.
        </p>

        {state === "accepted" ? (
          <div className="mt-6 rounded-ui border border-line-dark bg-canvas px-4 py-3 text-sm text-ink" role="status">
            확인 이메일을 보냈습니다. 이메일의 링크를 눌러 구독을 완료해 주세요.
          </div>
        ) : (
          <form className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="newsletter-email">
              이메일 주소
            </label>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={hasEmailValidationError ? "newsletter-email-error" : undefined}
              aria-invalid={hasEmailValidationError || undefined}
              placeholder="email@example.com"
              className="min-w-0 flex-1 rounded-ui border border-line bg-canvas px-4 py-3 text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={state === "pending"}
              className="rounded-ui bg-primary px-5 py-3 text-sm font-bold text-canvas hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "pending" ? "구독 처리 중…" : "구독 신청"}
            </button>
            {state === "error" && (
              <p
                id={hasEmailValidationError ? "newsletter-email-error" : undefined}
                className="text-sm text-accent-light sm:col-span-2"
                role="alert"
              >
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
