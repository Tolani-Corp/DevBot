#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

parser = argparse.ArgumentParser()
parser.add_argument("--schema", required=True)
parser.add_argument("--document", required=True)
args = parser.parse_args()

schema = json.loads(Path(args.schema).read_text(encoding="utf-8"))
document = json.loads(Path(args.document).read_text(encoding="utf-8"))
validator = Draft202012Validator(schema, format_checker=FormatChecker())
errors = sorted(validator.iter_errors(document), key=lambda error: list(error.absolute_path))
if errors:
    for error in errors:
        path = ".".join(str(part) for part in error.absolute_path) or "<root>"
        print(f"THAS SCHEMA ERROR {path}: {error.message}")
    raise SystemExit(1)
print(f"THAS SCHEMA PASS: {args.document}")
