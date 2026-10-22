import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { mockupPreviewPlugin } from "./mockupPreviewPlugin.ts";

test("discovers nested TSX mockups while excluding private and hidden paths", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mockup-discovery-"));
  try {
    const files = [
      "Zebra.tsx",
      "nested/Alpha.tsx",
      "_Private.tsx",
      "_private/Child.tsx",
      "nested/_private/Child.tsx",
      "nested/_Private.tsx",
      ".hidden/Child.tsx",
      ".Hidden.tsx",
      "nested/.Hidden.tsx",
      "NotAMockup.ts",
    ];
    for (const file of files) {
      const destination = path.join(root, "src/components/mockups", file);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, "export default function Mockup() {}");
    }

    const plugin = mockupPreviewPlugin();
    // These hooks only need the resolved root; no running Vite server is required.
    assert.equal(typeof plugin.configResolved, "function");
    assert.equal(typeof plugin.buildStart, "function");
    await (plugin.configResolved as Function)({ root });
    await (plugin.buildStart as Function)();
    const generated = await readFile(
      path.join(root, "src/.generated/mockup-components.ts"),
      "utf8",
    );
    assert.match(generated, /\.\/components\/mockups\/Zebra\.tsx/);
    assert.match(generated, /\.\.\/components\/mockups\/nested\/Alpha\.tsx/);
    assert.doesNotMatch(generated, /Private|Child|Hidden|NotAMockup/);
    assert.equal((generated.match(/=> import\(/g) ?? []).length, 2);

    await rm(path.join(root, "src/components/mockups/Zebra.tsx"));
    await writeFile(
      path.join(root, "src/components/mockups/Added.tsx"),
      "export default function Added() {}",
    );
    await (plugin.buildStart as Function)();
    const refreshed = await readFile(
      path.join(root, "src/.generated/mockup-components.ts"),
      "utf8",
    );
    assert.match(refreshed, /Added\.tsx/);
    assert.doesNotMatch(refreshed, /Zebra\.tsx/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generates an empty module map when the mockups directory is missing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "mockup-empty-"));
  try {
    const plugin = mockupPreviewPlugin();
    await (plugin.configResolved as Function)({ root });
    await (plugin.buildStart as Function)();
    const generated = await readFile(
      path.join(root, "src/.generated/mockup-components.ts"),
      "utf8",
    );
    assert.match(generated, /export const modules: ModuleMap = \{\n\n\};/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
