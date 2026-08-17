interface RoeChecklistArgs {
  target?: unknown;
  mission_type?: unknown;
  ghost_mode?: unknown;
  has_authorization?: unknown;
  has_scope_document?: unknown;
  has_emergency_contact?: unknown;
  has_verified_authorization_signature?: unknown;
  has_named_operator?: unknown;
  has_test_identities?: unknown;
}

export async function handle(args: RoeChecklistArgs) {
  const target = String(args.target ?? "").trim();
  const missionType = String(args.mission_type ?? "web-app").trim();
  const ghostMode = String(args.ghost_mode ?? "passive").trim();
  const hasAuth = Boolean(args.has_authorization);
  const hasScope = Boolean(args.has_scope_document);
  const hasContact = Boolean(args.has_emergency_contact);
  const hasVerifiedSignature = Boolean(args.has_verified_authorization_signature);
  const hasNamedOperator = Boolean(args.has_named_operator);
  const hasTestIdentities = Boolean(args.has_test_identities);
  const activeTesting = ghostMode === "stealth" || ghostMode === "active";

  const checks = [
    {
      name: "Written Authorization",
      passed: hasAuth,
      required: true,
      detail: "A signed authorization artifact is required for every NATT package.",
    },
    {
      name: "Verified Authorization Signature",
      passed: hasVerifiedSignature,
      required: activeTesting,
      detail: "Stealth and active testing require a verified detached signature from a trusted authorizer key.",
    },
    {
      name: "Scope Document",
      passed: hasScope && target.length > 0,
      required: true,
      detail: "Scope must identify exact domains, IPs, CIDRs, ports, paths, exclusions, and testing windows.",
    },
    {
      name: "Named Operator",
      passed: hasNamedOperator,
      required: true,
      detail: "Anonymous or inferred operators are not permitted.",
    },
    {
      name: "Emergency Contact",
      passed: hasContact,
      required: missionType !== "osint",
      detail: "Technical and emergency stop contacts are required for technical testing.",
    },
    {
      name: "Synthetic Test Identities",
      passed: hasTestIdentities,
      required: missionType === "auth-testing" && activeTesting,
      detail: "Active authentication testing uses client-provisioned or synthetic identities only.",
    },
    {
      name: "Restricted Infrastructure",
      passed: !/(?:^|\.)(gov|mil)$/i.test(target),
      required: true,
      detail: "Restricted infrastructure requires a separately reviewed government authorization path.",
    },
    {
      name: "Mode Authorization",
      passed: !activeTesting || (hasAuth && hasVerifiedSignature),
      required: true,
      detail: "Higher-impact modes require both the signed document and cryptographic signature verification.",
    },
  ];

  const blocked = checks.filter((check) => check.required && !check.passed);
  const result = {
    approved: blocked.length === 0,
    target,
    missionType,
    ghostMode,
    checks,
    blockers: blocked.map((check) => check.name),
    summary:
      blocked.length === 0
        ? `ROE checklist passed for ${missionType}/${ghostMode} on ${target}`
        : `${blocked.length} blocking control(s): ${blocked.map((check) => check.name).join(", ")}`,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
