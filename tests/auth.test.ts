import { vi, describe, it, expect, afterEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn()
}));

import { cookies } from "next/headers";
import { getSessionMode } from "@/lib/auth";

const mockCookies = cookies as ReturnType<typeof vi.fn>;

function setupCookies(value: string | undefined) {
  mockCookies.mockResolvedValue({
    get: (name: string) => (name === "whisky_access" && value !== undefined ? { value } : undefined)
  });
}

afterEach(() => {
  vi.resetAllMocks();
  delete process.env.APP_LOCK_ENABLED;
  delete process.env.APP_ACCESS_TOKEN;
});

describe("getSessionMode", () => {
  it("returns 'owner' when APP_LOCK_ENABLED is not 'true'", async () => {
    process.env.APP_LOCK_ENABLED = "false";
    process.env.APP_ACCESS_TOKEN = "secret";
    setupCookies("secret");

    const result = await getSessionMode();
    expect(result).toBe("owner");
  });

  it("returns 'owner' when APP_ACCESS_TOKEN is unset", async () => {
    process.env.APP_LOCK_ENABLED = "true";
    // APP_ACCESS_TOKEN intentionally not set
    setupCookies("secret");

    const result = await getSessionMode();
    expect(result).toBe("owner");
  });

  it("returns 'owner' when cookie matches token", async () => {
    process.env.APP_LOCK_ENABLED = "true";
    process.env.APP_ACCESS_TOKEN = "correct-token";
    setupCookies("correct-token");

    const result = await getSessionMode();
    expect(result).toBe("owner");
  });

  it("returns 'guest' when cookie is absent", async () => {
    process.env.APP_LOCK_ENABLED = "true";
    process.env.APP_ACCESS_TOKEN = "secret";
    setupCookies(undefined);

    const result = await getSessionMode();
    expect(result).toBe("guest");
  });

  it("returns 'guest' when cookie does not match token", async () => {
    process.env.APP_LOCK_ENABLED = "true";
    process.env.APP_ACCESS_TOKEN = "correct-token";
    setupCookies("wrong-token");

    const result = await getSessionMode();
    expect(result).toBe("guest");
  });
});
