#!/usr/bin/env python3
import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
SECRET_KEY_RE = re.compile(r"(secret|token|password|cookie|credential|share)", re.IGNORECASE)


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def fail(message: str):
    raise SystemExit(f"THAS LEDGER FAIL: {message}")


def walk_for_secret_keys(value, path="$"):
    if isinstance(value, dict):
        for key, child in value.items():
            if SECRET_KEY_RE.search(key):
                fail(f"secret-like key is prohibited at {path}.{key}")
            walk_for_secret_keys(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            walk_for_secret_keys(child, f"{path}[{index}]")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--schema", required=True, type=Path)
    parser.add_argument("--ledger", required=True, type=Path)
    args = parser.parse_args()

    schema = load_json(args.schema)
    ledger = load_json(args.ledger)

    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(ledger), key=lambda e: list(e.absolute_path))
    if errors:
        details = "; ".join(
            f"{'.'.join(map(str, error.absolute_path)) or '$'}: {error.message}"
            for error in errors
        )
        fail(details)

    walk_for_secret_keys(ledger)

    action = ledger["standard"]["executionAction"]
    if not SHA_RE.fullmatch(action["commitSha"]) or not SHA_RE.fullmatch(action["mergedAuthorityCommitSha"]):
        fail("execution action authority must use exact 40-hex commit SHAs")
    if action["commitSha"] == action["mergedAuthorityCommitSha"]:
        fail("execution commit and merged provenance commit must be recorded separately")

    services = ledger["services"]
    service_by_id = {}
    repositories = set()
    repository_ids = set()
    audiences = set()
    for service in services:
        service_id = service["serviceId"]
        if service_id in service_by_id:
            fail(f"duplicate serviceId {service_id}")
        if service["repository"] in repositories:
            fail(f"duplicate repository {service['repository']}")
        if service["repositoryId"] in repository_ids:
            fail(f"duplicate repositoryId {service['repositoryId']}")
        if service["oidcAudience"] in audiences:
            fail(f"duplicate oidcAudience {service['oidcAudience']}")
        service_by_id[service_id] = service
        repositories.add(service["repository"])
        repository_ids.add(service["repositoryId"])
        audiences.add(service["oidcAudience"])

    observed_pairs = set()
    evidence_ids = set()
    evidence_digests = set()

    for acceptance in ledger["acceptances"]:
        caller_id = acceptance["callerServiceId"]
        target_id = acceptance["targetServiceId"]
        if caller_id == target_id:
            fail(f"{acceptance['acceptanceId']} cannot call itself")
        if caller_id not in service_by_id or target_id not in service_by_id:
            fail(f"{acceptance['acceptanceId']} references an unknown service")

        caller = service_by_id[caller_id]
        target = service_by_id[target_id]

        if acceptance["callerMainSha"] != caller["acceptedMainSha"]:
            fail(f"{acceptance['acceptanceId']} caller SHA drifts from registered service SHA")
        if acceptance["targetMainSha"] != target["acceptedMainSha"]:
            fail(f"{acceptance['acceptanceId']} target SHA drifts from registered service SHA")
        if acceptance["targetDeployment"]["commitSha"] != target["acceptedMainSha"]:
            fail(f"{acceptance['acceptanceId']} deployment SHA does not bind to target main SHA")
        if acceptance["oidcAudience"] != target["oidcAudience"]:
            fail(f"{acceptance['acceptanceId']} OIDC audience does not belong to target service")

        runner = acceptance["runner"]
        if runner["repository"] != action["repository"] or runner["commitSha"] != action["commitSha"]:
            fail(f"{acceptance['acceptanceId']} runner drifts from canonical execution action")

        evidence = acceptance["evidence"]
        if evidence["repository"] != caller["repository"]:
            fail(f"{acceptance['acceptanceId']} evidence repository must be the caller repository")
        if evidence["artifactId"] in evidence_ids:
            fail(f"duplicate evidence artifactId {evidence['artifactId']}")
        if evidence["digest"] in evidence_digests:
            fail(f"duplicate evidence digest {evidence['digest']}")

        accepted_at = parse_time(acceptance["acceptedAt"])
        expires_at = parse_time(evidence["expiresAt"])
        if expires_at <= accepted_at:
            fail(f"{acceptance['acceptanceId']} evidence expires before acceptance")
        if (expires_at - accepted_at).days < 89:
            fail(f"{acceptance['acceptanceId']} evidence retention is less than 90-day policy window")

        parsed = urlsplit(acceptance["targetDeployment"]["url"])
        if parsed.scheme != "https" or parsed.query or parsed.fragment or not parsed.netloc:
            fail(f"{acceptance['acceptanceId']} deployment URL must be HTTPS and query/fragment free")

        observed_pairs.add((caller_id, target_id))
        evidence_ids.add(evidence["artifactId"])
        evidence_digests.add(evidence["digest"])

    expected_pairs = {
        (a["serviceId"], b["serviceId"])
        for a in services
        for b in services
        if a["serviceId"] != b["serviceId"]
    }
    if observed_pairs != expected_pairs:
        missing = sorted(expected_pairs - observed_pairs)
        extra = sorted(observed_pairs - expected_pairs)
        fail(f"bidirectional coverage mismatch; missing={missing} extra={extra}")

    print(
        "THAS LEDGER PASS: "
        f"{len(services)} services, {len(observed_pairs)} directed acceptances, "
        f"execution={action['commitSha']}, provenance={action['mergedAuthorityCommitSha']}"
    )


if __name__ == "__main__":
    main()
