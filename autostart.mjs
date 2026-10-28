// `hub autostart` starts the hub when you log in; `hub autostart off` takes that back.
//
// WSL only so far. A distro starts when Windows asks for it, so the entry is on the
// Windows side: a value under the user's Run key that runs a script through wsl.exe.
// That wsl.exe stays for as long as the hub does, which keeps the distro up with it.
//
// What to start is in the script, not in the value: this node, this copy of the hub
// and the HUB_* variables of the moment. Windows caps a Run value at 260 characters,
// and this way the paths are quoted once, for sh.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const RUN_KEY = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const sh = (s) => `'${String(s).replaceAll("'", "'\\''")}'`;

// Serves in the foreground with its output in the log, from a directory that is no
// repository: at login the hub has the projects it remembers and adds none.
export function launcher({ node, script, log, env }) {
  const vars = Object.entries(env).filter(([key]) => key.startsWith("HUB_")).map(([key, value]) => sh(`${key}=${value}`));
  return [
    "#!/bin/sh",
    "# Written by `hub autostart`; `hub autostart off` removes it.",
    "cd /",
    `exec env ${[...vars, sh(node), sh(script)].join(" ")} --fg >>${sh(log)} 2>&1`,
    "",
  ].join("\n");
}

// conhost --headless runs a console program without a window
export const runValue = (distro, file) => `conhost.exe --headless wsl.exe -d ${distro} --exec "${file}"`;

// false: reg.exe ran and refused (deleting a value that is not there, for one)
function reg(...args) {
  try {
    execFileSync("reg.exe", args, { stdio: "ignore" });
    return true;
  } catch (e) {
    if (e.status == null) throw new Error("cannot run reg.exe — is Windows interop off in this distro?");
    return false;
  }
}

// Returns what is now true, for the caller to print.
export function autostart(on, { script, dir, log }) {
  const distro = process.env.WSL_DISTRO_NAME;
  if (!distro) throw new Error("autostart is there for WSL only so far");
  const file = path.join(dir, "autostart.sh");
  if (!on) {
    reg("delete", RUN_KEY, "/v", "hub", "/f");
    rmSync(file, { force: true });
    return "no longer starts at login";
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, launcher({ node: process.execPath, script, log, env: process.env }), { mode: 0o755 });
  if (!reg("add", RUN_KEY, "/v", "hub", "/t", "REG_SZ", "/d", runValue(distro, file), "/f")) {
    throw new Error("reg.exe could not write the Run key");
  }
  return "starts when you log in to Windows; `hub autostart off` takes that back";
}
