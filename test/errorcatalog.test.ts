import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { catalogErrors } from "../src/errorcatalog.js";

/**
 * All tests are pure local text analysis over inline source
 * strings: no filesystem, no network. Each scanning rule from
 * the spec is pinned by its own case.
 */

const one = (content: string) => [{ path: "a.ts", content }];

describe("catalogErrors — literal messages", () => {
  it("catalogues a double-quoted literal", () => {
    const out = catalogErrors(one('throw new Error("disk full");'));
    assert.equal(out.errors.length, 1);
    assert.deepEqual(out.errors[0], {
      path: "a.ts",
      line: 1,
      error_type: "Error",
      message: "disk full",
      dynamic: false,
      documented: null,
    });
    assert.equal(out.counts.literal, 1);
    assert.equal(out.counts.total, 1);
  });

  it("catalogues a single-quoted literal", () => {
    const out = catalogErrors(one("throw new TypeError('bad type');"));
    assert.equal(out.errors[0].error_type, "TypeError");
    assert.equal(out.errors[0].message, "bad type");
    assert.equal(out.errors[0].dynamic, false);
  });

  it("catalogues a backtick literal without interpolation", () => {
    const out = catalogErrors(one("throw new RangeError(`out of range`);"));
    assert.equal(out.errors[0].error_type, "RangeError");
    assert.equal(out.errors[0].message, "out of range");
    assert.equal(out.errors[0].dynamic, false);
  });

  it("keeps escape sequences exactly as written", () => {
    const out = catalogErrors(one('throw new Error("line\\nbreak \\"quoted\\"");'));
    assert.equal(out.errors[0].message, 'line\\nbreak \\"quoted\\"');
  });

  it("catalogues custom *Error names", () => {
    const out = catalogErrors(
      one('throw new FooError("custom failure");\nthrow new PaymentDeclinedError("declined");'),
    );
    assert.deepEqual(
      out.errors.map((e) => e.error_type),
      ["FooError", "PaymentDeclinedError"],
    );
    assert.equal(out.counts.literal, 2);
  });
});

describe("catalogErrors — dynamic and no-message entries", () => {
  it("marks a template containing ${} as dynamic", () => {
    const out = catalogErrors(one("throw new Error(`failed for ${id}`);"));
    assert.equal(out.errors[0].message, null);
    assert.equal(out.errors[0].dynamic, true);
    assert.equal(out.errors[0].documented, null);
    assert.equal(out.counts.dynamic, 1);
  });

  it("marks a non-literal first argument as dynamic", () => {
    const out = catalogErrors(
      one("throw new Error(message);\nthrow new Error(buildMessage());\nthrow new Error(prefix + suffix);"),
    );
    assert.equal(out.errors.length, 3);
    assert.ok(out.errors.every((e) => e.dynamic && e.message === null));
    assert.equal(out.counts.dynamic, 3);
  });

  it("marks a literal followed by concatenation as dynamic", () => {
    const out = catalogErrors(one('throw new Error("part " + suffix);'));
    assert.equal(out.errors[0].dynamic, true);
    assert.equal(out.errors[0].message, null);
  });

  it("records a no-argument throw as no_message with the note", () => {
    const out = catalogErrors(one("throw new Error();"));
    assert.equal(out.errors[0].message, null);
    assert.equal(out.errors[0].dynamic, false);
    assert.equal(out.errors[0].note, "no message argument");
    assert.equal(out.errors[0].documented, null);
    assert.equal(out.counts.no_message, 1);
    assert.equal(out.counts.literal, 0);
  });

  it("treats a literal that does not close on its line as dynamic (multiline)", () => {
    const out = catalogErrors(one('throw new Error("starts here\nand ends here");'));
    assert.equal(out.errors.length, 1);
    assert.equal(out.errors[0].dynamic, true);
    assert.equal(out.errors[0].message, null);
  });

  it("treats an argument starting on the next line as dynamic", () => {
    const out = catalogErrors(one('throw new Error(\n  "next line"\n);'));
    assert.equal(out.errors.length, 1);
    assert.equal(out.errors[0].dynamic, true);
  });
});

describe("catalogErrors — what is ignored and ordering", () => {
  it("ignores non-Error throws", () => {
    const out = catalogErrors(
      one('throw "bare string";\nthrow new Foo("not an error");\nthrow err;\nthrow new Error("real");'),
    );
    assert.equal(out.errors.length, 1);
    assert.equal(out.errors[0].message, "real");
    assert.equal(out.errors[0].line, 4);
  });

  it("orders entries by source input order, then line ascending", () => {
    const out = catalogErrors([
      { path: "second.ts", content: 'throw new Error("s1");\nthrow new Error("s2");' },
      { path: "first.ts", content: 'throw new Error("f1");' },
    ]);
    assert.deepEqual(
      out.errors.map((e) => `${e.path}:${e.line}:${e.message}`),
      ["second.ts:1:s1", "second.ts:2:s2", "first.ts:1:f1"],
    );
  });

  it("keeps duplicate throws as separate entries", () => {
    const out = catalogErrors(one('throw new Error("same");\nthrow new Error("same");'));
    assert.equal(out.errors.length, 2);
    assert.equal(out.counts.total, 2);
    assert.equal(out.counts.literal, 2);
  });

  it("tallies mixed counts", () => {
    const out = catalogErrors(
      one('throw new Error("lit");\nthrow new Error(msg);\nthrow new Error();'),
    );
    assert.deepEqual(out.counts, {
      total: 3,
      literal: 1,
      dynamic: 1,
      no_message: 1,
      documented: 0,
      undocumented: 0,
    });
  });
});

describe("catalogErrors — documented checks", () => {
  const sources = one(
    'throw new Error("disk full");\nthrow new Error("secret failure");\nthrow new Error(msg);\nthrow new Error();',
  );
  const docs = [{ path: "guide.md", content: "Troubleshooting: disk full means the volume is full." }];

  it("marks literal messages documented true/false from caller-supplied docs", () => {
    const out = catalogErrors(sources, docs);
    assert.equal(out.docs_provided, true);
    assert.equal(out.errors[0].documented, true);
    assert.equal(out.errors[1].documented, false);
    assert.equal(out.counts.documented, 1);
    assert.equal(out.counts.undocumented, 1);
  });

  it("keeps documented null for dynamic and no-message entries even with docs", () => {
    const out = catalogErrors(sources, docs);
    assert.equal(out.errors[2].documented, null);
    assert.equal(out.errors[3].documented, null);
  });

  it("reports docs_provided false and zero documented counts when docs are absent", () => {
    const out = catalogErrors(sources);
    assert.equal(out.docs_provided, false);
    assert.equal(out.counts.documented, 0);
    assert.equal(out.counts.undocumented, 0);
    assert.ok(out.errors.every((e) => e.documented === null));
  });
});

describe("catalogErrors — input validation", () => {
  it("rejects missing or empty sources", () => {
    assert.throws(() => catalogErrors(undefined), /sources is required/);
    assert.throws(() => catalogErrors([]), /sources is required/);
    assert.throws(() => catalogErrors("nope"), /sources is required/);
  });

  it("names the offending sources[i] path for missing fields", () => {
    assert.throws(() => catalogErrors([{ content: "x" }]), /sources\[0\]\.path is required/);
    assert.throws(() => catalogErrors([{ path: "a.ts" }]), /sources\[0\]\.content is required/);
    assert.throws(
      () => catalogErrors([{ path: "a.ts", content: "x" }, { path: "b.ts" }]),
      /sources\[1\]\.content is required/,
    );
  });

  it("names the offending docs[i] path for malformed docs", () => {
    assert.throws(
      () => catalogErrors(one('throw new Error("x");'), [{ path: "d.md" }]),
      /docs\[0\]\.content is required/,
    );
  });
});
