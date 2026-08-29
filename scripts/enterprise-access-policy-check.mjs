import fs from "node:fs";

const manifest = JSON.parse(fs.readFileSync("config/enterprise-service.json", "utf8"));
const errors = [];
const fail = (message) => errors.push(message);

if (manifest.serviceId !== "devbot") fail("serviceId must remain devbot");
if (manifest.productionAuthority !== false) fail("adoption does not grant production authority");
if (manifest.gatewayBypassProtection?.required !== true) fail("origin bypass protection is mandatory");
for (const iface of manifest.interfaces ?? []) {
  if (iface.internal?.access !== "open-controlled") fail(`${iface.kind}: internal access must be open-controlled`);
  if (iface.internal?.billing !== "exempt") fail(`${iface.kind}: internal access must be billing-exempt`);
  if (!iface.internal?.scope?.startsWith("devbot.")) fail(`${iface.kind}: exact DevBot scope required`);
  if (iface.external?.access !== "disabled") fail(`${iface.kind}: DevBot must remain external-disabled`);
}
if (manifest.targetDataAuthority?.structured !== "postgresql-18") fail("DevBot target structured authority must be PostgreSQL 18");
if (manifest.targetDataAuthority?.cache !== "redis-compatible-disposable-only") fail("DevBot cache must remain non-authoritative");

if (errors.length) {
  console.error("DevBot enterprise access policy failed:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log("DevBot enterprise access policy validated: internal-only, scoped, billing-exempt, default external deny.");
