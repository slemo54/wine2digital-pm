import test from "node:test";
import assert from "node:assert/strict";
import { buildSimpleEmail } from "./templates";

test("buildSimpleEmail: basic email generation", () => {
  const result = buildSimpleEmail({
    title: "Test Title",
    lines: ["Line 1", "Line 2"],
  });

  assert.ok(result.text.includes("Test Title"));
  assert.ok(result.text.includes("Line 1"));
  assert.ok(result.text.includes("Line 2"));

  assert.ok(result.html.includes('<h1 style="font-size:18px;margin:0 0 12px 0;color:#111827;">Test Title</h1>'));
  assert.ok(result.html.includes('<p style="margin:0 0 8px 0;">Line 1</p>'));
  assert.ok(result.html.includes('<p style="margin:0 0 8px 0;">Line 2</p>'));
  assert.ok(!result.html.includes("<a href="));
});

test("buildSimpleEmail: with CTA button", () => {
  const result = buildSimpleEmail({
    title: "Action Required",
    lines: ["Click the button below"],
    ctaLabel: "Click Me",
    ctaUrl: "https://example.com",
  });

  assert.ok(result.text.includes("Click Me: https://example.com"));
  assert.ok(result.html.includes('href="https://example.com"'));
  assert.ok(result.html.includes(">Click Me</a>"));
});

test("buildSimpleEmail: html escaping", () => {
  const result = buildSimpleEmail({
    title: "Title & <script>",
    lines: ["Line with 'quotes' and \"double quotes\""],
    ctaLabel: "Label > Here",
    ctaUrl: "https://example.com?a=1&b=2",
  });

  // Title escaping
  assert.ok(result.html.includes("Title &amp; &lt;script&gt;"));
  assert.ok(!result.html.includes("Title & <script>"));

  // Lines escaping
  assert.ok(result.html.includes("Line with &#039;quotes&#039; and &quot;double quotes&quot;"));

  // CTA escaping
  assert.ok(result.html.includes("Label &gt; Here"));
  assert.ok(result.html.includes("https://example.com?a=1&amp;b=2"));
});

test("buildSimpleEmail: edge cases", () => {
  // Empty lines and title
  const result1 = buildSimpleEmail({
    title: "",
    lines: [],
  });
  assert.equal(result1.text, "");
  assert.ok(result1.html.includes('<h1 style="font-size:18px;margin:0 0 12px 0;color:#111827;"></h1>'));

  // Null/Undefined handling (though types don't allow it, runtime might)
  // @ts-ignore
  const result2 = buildSimpleEmail({
    title: null,
    lines: [null, "Valid"],
  });
  assert.equal(result2.text, "Valid");
  assert.ok(result2.html.includes('<p style="margin:0 0 8px 0;">Valid</p>'));
  assert.ok(!result2.html.includes('<p style="margin:0 0 8px 0;"></p>'));

  // Whitespace trimming
  const result3 = buildSimpleEmail({
    title: "  Trim Me  ",
    lines: ["  Line 1  "],
    ctaLabel: "  Button  ",
    ctaUrl: "  https://link.com  "
  });
  assert.ok(result3.text.startsWith("Trim Me"));
  assert.ok(result3.text.includes("Line 1"));
  assert.ok(result3.text.includes("Button: https://link.com"));
  assert.ok(result3.html.includes(">Trim Me</h1>"));
  assert.ok(result3.html.includes(">Line 1</p>"));
  assert.ok(result3.html.includes('href="https://link.com"'));
  assert.ok(result3.html.includes(">Button</a>"));
});

test("buildSimpleEmail: partial CTA details", () => {
  // Missing URL
  const result1 = buildSimpleEmail({
    title: "T",
    lines: ["L"],
    ctaLabel: "Label",
  });
  assert.ok(!result1.text.includes("Label"));
  assert.ok(!result1.html.includes("<a"));

  // Missing Label
  const result2 = buildSimpleEmail({
    title: "T",
    lines: ["L"],
    ctaUrl: "https://url.com",
  });
  assert.ok(!result2.text.includes("https://url.com"));
  assert.ok(!result2.html.includes("<a"));
});
