export function formatCurrency(value: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2
  }).format(value);
}

export function formatDate(value?: string) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return sum(values) / values.length;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export async function readResponseMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: string | { fieldErrors?: Record<string, string[]> };
    };

    if (typeof payload.error === "string") {
      return payload.error;
    }

    if (payload.error && typeof payload.error === "object" && "fieldErrors" in payload.error) {
      const fieldErrors = Object.values(payload.error.fieldErrors ?? {}).flat().filter(Boolean);
      if (fieldErrors.length > 0) {
        return fieldErrors.join(". ");
      }
    }
  } catch {
    // JSON parse failed — fall through to fallback
  }

  return fallback;
}
