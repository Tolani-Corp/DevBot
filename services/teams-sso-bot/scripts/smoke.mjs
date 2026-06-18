import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const serviceRoot = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "..",
);

const manifest = JSON.parse(
  fs.readFileSync(path.join(serviceRoot, "appPackage", "manifest.template.json"), "utf8"),
);

assert.equal(manifest.name.short, "DevBot");
assert.equal(manifest.manifestVersion, "1.27");
assert.equal(manifest.bots[0].commandLists[0].commands.length, 5);
assert.ok(manifest.validDomains.includes("${{BOT_DOMAIN}}"));
assert.equal(manifest.webApplicationInfo.resource, "api://botid-${{BOT_ID}}");

for (const file of ["auth-start.html", "auth-end.html"]) {
  const fullPath = path.join(serviceRoot, "public", file);
  assert.ok(fs.existsSync(fullPath), `${file} should exist`);
}

for (const file of ["color.png", "outline.png"]) {
  const fullPath = path.join(serviceRoot, "appPackage", file);
  assert.ok(fs.existsSync(fullPath), `${file} should exist`);
  assert.ok(fs.statSync(fullPath).size > 100, `${file} should not be empty`);
}

const compiledCommandsPath = path.join(serviceRoot, "lib", "src", "commands.js");
assert.ok(
  fs.existsSync(compiledCommandsPath),
  "Run npm --prefix services/teams-sso-bot run build before smoke.",
);

const { parseTeamsCommand } = await import(url.pathToFileURL(compiledCommandsPath));

assert.deepEqual(parseTeamsCommand("show"), { type: "show" });
assert.deepEqual(parseTeamsCommand("status"), { type: "status" });
assert.deepEqual(parseTeamsCommand("logout"), { type: "logout" });
assert.deepEqual(parseTeamsCommand("task fix tests repo:DevBot"), {
  type: "task",
  description: "fix tests",
  repository: "DevBot",
});

console.log("teams-sso-bot smoke checks passed");
