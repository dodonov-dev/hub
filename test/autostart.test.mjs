import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { launcher, runValue } from "../autostart.mjs";

test("the login script starts the hub with its paths and HUB_* variables intact", (t) => {
  const dir = path.join(mkdtempSync(path.join(tmpdir(), "hub-autostart-test-")), "it's a dir");
  t.after(() => rmSync(path.dirname(dir), { recursive: true }));
  mkdirSync(dir);
  const script = path.join(dir, "hub.mjs");
  const log = path.join(dir, "hub.log");
  const file = path.join(dir, "autostart.sh");
  writeFileSync(script, `console.log(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), cmd: process.env.HUB_CMD, other: process.env.OTHER }));`);
  writeFileSync(log, "earlier\n");
  writeFileSync(file, launcher({ node: process.execPath, script, log, env: { HUB_CMD: "say 'hi' $HOME", OTHER: "left out", PATH: process.env.PATH } }), { mode: 0o755 });
  // run as the login entry does: by its path, with nothing of the hub in the environment
  const out = execFileSync(file, { cwd: dir, encoding: "utf8", env: { PATH: process.env.PATH, OTHER: "from login" } });
  assert.equal(out, "");
  const [earlier, line] = readFileSync(log, "utf8").trim().split("\n");
  assert.equal(earlier, "earlier");
  assert.deepEqual(JSON.parse(line), { args: ["--fg"], cwd: "/", cmd: "say 'hi' $HOME", other: "from login" });
});

test("the Run value stays within what Windows accepts", () => {
  const value = runValue("Ubuntu-24.04", "/home/someone/.config/hub/autostart.sh");
  assert.equal(value, 'conhost.exe --headless wsl.exe -d Ubuntu-24.04 --exec "/home/someone/.config/hub/autostart.sh"');
  assert.ok(value.length <= 260);
});
