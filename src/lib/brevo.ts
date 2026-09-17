import "server-only";

const BREVO_DOUBLE_OPT_IN_URL =
  "https://api.brevo.com/v3/contacts/doubleOptinConfirmation";
const BREVO_REQUEST_TIMEOUT_MS = 10_000;

export type BrevoSubscribeOutcome =
  | "accepted"
  | "rate_limited"
  | "unavailable";

type BrevoConfiguration = {
  apiKey: string;
  listId: number;
  templateId: number;
  redirectUrl: string;
};

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function getConfiguration(): BrevoConfiguration | null {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const listId = parsePositiveInteger(process.env.BREVO_LIST_ID);
  const templateId = parsePositiveInteger(process.env.BREVO_DOI_TEMPLATE_ID);
  const redirectUrl = parseHttpsUrl(process.env.BREVO_DOI_REDIRECT_URL);

  return apiKey && listId && templateId && redirectUrl
    ? { apiKey, listId, templateId, redirectUrl }
    : null;
}

async function isKnownDuplicate(response: Response): Promise<boolean> {
  try {
    const body: unknown = await response.json();

    return (
      !!body &&
      typeof body === "object" &&
      "code" in body &&
      ((body as { code?: unknown }).code === "duplicate_parameter" ||
        (body as { code?: unknown }).code === "duplicate_request")
    );
  } catch {
    return false;
  }
}

export async function requestBrevoDoubleOptIn(
  email: string,
): Promise<BrevoSubscribeOutcome> {
  const configuration = getConfiguration();

  if (!configuration) return "unavailable";

  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<BrevoSubscribeOutcome>((resolve) => {
    timeout = setTimeout(() => {
      controller.abort();
      resolve("unavailable");
    }, BREVO_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(BREVO_DOUBLE_OPT_IN_URL, {
          method: "POST",
          headers: {
            "api-key": configuration.apiKey,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            includeListIds: [configuration.listId],
            templateId: configuration.templateId,
            redirectionUrl: configuration.redirectUrl,
          }),
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.ok) return "accepted";
        if (response.status === 429) return "rate_limited";
        if (await isKnownDuplicate(response)) return "accepted";

        console.error("brevo_doi_request_failed", response.status);
        return "unavailable";
      })(),
      deadline,
    ]);
  } catch {
    return "unavailable";
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
