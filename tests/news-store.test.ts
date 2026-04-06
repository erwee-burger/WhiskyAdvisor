import { describe, it, expect } from "vitest";
import { scoreToPalateStars } from "@/lib/news-store";

describe("scoreToPalateStars", () => {
  it("returns 0 for score below 60", () => {
    expect(scoreToPalateStars(55)).toBe(0);
  });

  it("returns 1 for score 60-70", () => {
    expect(scoreToPalateStars(65)).toBe(1);
  });

  it("returns 2 for score 71-85", () => {
    expect(scoreToPalateStars(80)).toBe(2);
  });

  it("returns 3 for score 86+", () => {
    expect(scoreToPalateStars(90)).toBe(3);
  });

  it("returns 3 for score exactly 86", () => {
    expect(scoreToPalateStars(86)).toBe(3);
  });
});
