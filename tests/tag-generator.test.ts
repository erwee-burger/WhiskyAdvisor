import { describe, expect, it } from "vitest";

import { TagGenerator } from "@/lib/tag-generator";
import { getAllCaskTags, getCaskStyleTags } from "@/lib/tags";

describe("TagGenerator", () => {
  it("is deterministic for the same facts input", () => {
    const facts = {
      whiskyType: "single malt",
      peatLevel: "peated",
      caskInfluences: ["tequila"],
      isNaturalColor: true
    };

    expect(TagGenerator.generate({ facts, abv: 46 })).toEqual(
      TagGenerator.generate({ facts, abv: 46 })
    );
  });

  it("emits unusual cask tags through pattern rules", () => {
    const tags = TagGenerator.generate({
      facts: { caskInfluences: ["tequila", "oloroso sherry"] },
      abv: 46
    });

    expect(tags).toContain("tequila-cask");
    expect(tags).toContain("oloroso");
    expect(tags).toContain("sherry-cask");
  });

  it("breaks complex sherry-cask facts into cleaner structural tags", () => {
    const tags = TagGenerator.generate({
      facts: { caskInfluences: ["first-fill oloroso sherry hogshead"] },
      abv: 56.2
    });

    expect(tags).toContain("first-fill");
    expect(tags).toContain("oloroso");
    expect(tags).toContain("sherry-cask");
    expect(tags).toContain("hogshead");
    expect(tags).not.toContain("first-fill-oloroso-sherry-hogshead-cask");
  });

  it("rejects flavor descriptor tokens in structural tags", () => {
    const tags = TagGenerator.generate({
      facts: { caskType: "vanilla", releaseSeries: "smoke" },
      abv: 46
    });

    expect(tags).not.toContain("vanilla");
    expect(tags).not.toContain("smoke");
  });

  it("emits cask-strength when abv is high", () => {
    const tags = TagGenerator.generate({ facts: {}, abv: 57.2 });
    expect(tags).toContain("cask-strength");
  });

  it("omits peat tag when unknown", () => {
    const tags = TagGenerator.generate({ facts: {}, abv: 46 });
    expect(tags).not.toContain("peated");
    expect(tags).not.toContain("heavily-peated");
    expect(tags).not.toContain("unpeated");
  });
});

describe("cask tag helpers", () => {
  it("returns unusual cask tags for display but not as recognized cask styles", () => {
    const tags = ["tequila-cask", "bourbon-cask", "mizunara"];
    expect(getAllCaskTags(tags)).toEqual(["tequila-cask", "bourbon-cask", "mizunara"]);
    expect(getCaskStyleTags(tags)).toEqual(["bourbon-cask"]);
  });
});
