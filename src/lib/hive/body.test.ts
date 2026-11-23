import { describe, expect, it } from "vitest";
import { normalizeHiveBody } from "./body";

describe("normalizeHiveBody", () => {
  it("turns bare image URLs on their own line into images", () => {
    expect(
      normalizeHiveBody("look\nhttps://x.com/a.JPG\n  https://files.peakd.com/file/abc  "),
    ).toBe("look\n![](https://x.com/a.JPG)\n![](https://files.peakd.com/file/abc)");
  });

  it("leaves inline links, existing markdown and non-images alone", () => {
    const body = "see https://x.com/a.png here\n![alt](https://x.com/b.png)\nhttps://x.com/page";
    expect(normalizeHiveBody(body)).toBe(body);
  });
});
