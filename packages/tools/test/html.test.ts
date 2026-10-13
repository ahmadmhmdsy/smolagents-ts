import { describe, expect, it } from "vitest";
import { htmlToText } from "../src/html.js";

describe("htmlToText", () => {
  it("keeps a heading's level", () => {
    expect(htmlToText("<h2>Title</h2><p>Body</p>")).toBe("## Title\n\nBody");
  });

  it("turns a link into its target", () => {
    expect(htmlToText('<p>See <a href="https://example.test/a">the page</a>.</p>')).toBe(
      "See [the page](https://example.test/a).",
    );
  });

  it("keeps list items as a list", () => {
    expect(htmlToText("<ul><li>one</li><li>two</li></ul>")).toBe("- one\n- two");
  });

  it("decodes named and numeric entities", () => {
    expect(htmlToText("<p>Tom &amp; Jerry &#233; &#x41;</p>")).toBe("Tom & Jerry \u00e9 A");
  });

  it("drops the tags a reader never sees", () => {
    const page = "<p>kept</p><script>var x = 1;</script><style>p { color: red }</style>";
    expect(htmlToText(page)).toBe("kept");
  });

  it("collapses the whitespace the markup left behind", () => {
    expect(htmlToText("<div>  a\n\n\n  b  </div>")).toBe("a\n\nb");
  });
});
