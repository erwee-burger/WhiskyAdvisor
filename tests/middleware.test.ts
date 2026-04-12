import { describe, it, expect } from "vitest";
import { isGuestViewablePath } from "@/middleware";

describe("isGuestViewablePath", () => {
  it("returns true for /collection", () => {
    expect(isGuestViewablePath("/collection")).toBe(true);
  });

  it("returns true for /collection/some-id", () => {
    expect(isGuestViewablePath("/collection/some-id")).toBe(true);
  });

  it("returns true for /collection/abc/def (nested)", () => {
    expect(isGuestViewablePath("/collection/abc/def")).toBe(true);
  });

  it("returns true for /news", () => {
    expect(isGuestViewablePath("/news")).toBe(true);
  });

  it("returns false for /", () => {
    expect(isGuestViewablePath("/")).toBe(false);
  });

  it("returns false for /advisor", () => {
    expect(isGuestViewablePath("/advisor")).toBe(false);
  });

  it("returns false for /api/items/abc", () => {
    expect(isGuestViewablePath("/api/items/abc")).toBe(false);
  });

  it("returns false for /collections (must not match prefix of /collection)", () => {
    expect(isGuestViewablePath("/collections")).toBe(false);
  });
});
