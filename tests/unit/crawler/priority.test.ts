import { describe, expect, it } from "vitest";

import { scoreUrlPriority } from "../../../src/index.js";

describe("scoreUrlPriority", () => {
  it("prioritizes high-value business pages over generic and blog pages", () => {
    const homepage = scoreUrlPriority("https://example.com/");
    const contact = scoreUrlPriority("https://example.com/contact");
    const generic = scoreUrlPriority("https://example.com/team");
    const blog = scoreUrlPriority("https://example.com/blog/post");

    expect(homepage).toBeGreaterThan(contact);
    expect(contact).toBeGreaterThan(generic);
    expect(generic).toBeGreaterThan(blog);
  });
});
