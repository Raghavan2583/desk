"""
scripts/schema_health_check.py
Proactive API schema health check — runs weekly, independent of the data pipeline.

Makes one lightweight test call to each upstream API and validates that the fields
we depend on are still present. Exits non-zero on any failure, which fails the
GitHub Actions step and triggers an email alert to the repo owner.

This complements D015 (reactive schema validation inside each ingestion script)
with a proactive check that runs on a schedule, not just when data flows.
"""
import json
import sys
import urllib.request

FAILURES: list[str] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    status = "OK " if ok else "FAIL"
    msg = f"[{status}] {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    if not ok:
        FAILURES.append(name)


# ── PyPI JSON API ─────────────────────────────────────────────────────────── #
try:
    with urllib.request.urlopen(
        "https://pypi.org/pypi/requests/json", timeout=10
    ) as r:
        d = json.loads(r.read())
    info = d.get("info", {})
    check("PyPI /pypi/{name}/json → info.name",    bool(info.get("name")))
    check("PyPI /pypi/{name}/json → info.version", bool(info.get("version")))
except Exception as exc:
    check("PyPI API reachable", False, str(exc))

# ── OSV querybatch ────────────────────────────────────────────────────────── #
try:
    body = json.dumps(
        {"queries": [{"package": {"name": "requests", "ecosystem": "PyPI"}}]}
    ).encode()
    req = urllib.request.Request(
        "https://api.osv.dev/v1/querybatch",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        d = json.loads(r.read())
    check("OSV /v1/querybatch → results array", isinstance(d.get("results"), list))
except Exception as exc:
    check("OSV querybatch reachable", False, str(exc))

# ── OSV individual vuln detail ────────────────────────────────────────────── #
try:
    with urllib.request.urlopen(
        "https://api.osv.dev/v1/vulns/GHSA-652x-xj99-gmcc", timeout=10
    ) as r:
        d = json.loads(r.read())
    check("OSV /v1/vulns/{id} → id",              bool(d.get("id")))
    check("OSV /v1/vulns/{id} → database_specific.severity",
          isinstance(d.get("database_specific"), dict)
          and "severity" in d["database_specific"])
except Exception as exc:
    check("OSV /v1/vulns/{id} reachable", False, str(exc))

# ── deps.dev package list ─────────────────────────────────────────────────── #
try:
    with urllib.request.urlopen(
        "https://api.deps.dev/v3alpha/systems/PYPI/packages/requests", timeout=10
    ) as r:
        d = json.loads(r.read())
    check("deps.dev /packages/{name} → packageKey", bool(d.get("packageKey")))
    check("deps.dev /packages/{name} → versions array", isinstance(d.get("versions"), list))
    has_default = any(v.get("isDefault") for v in d.get("versions", []))
    check("deps.dev /packages/{name} → at least one isDefault version", has_default)
except Exception as exc:
    check("deps.dev API reachable", False, str(exc))

# ── hugovk top-pypi-packages ─────────────────────────────────────────────── #
try:
    with urllib.request.urlopen(
        "https://hugovk.github.io/top-pypi-packages/top-pypi-packages-30-days.min.json",
        timeout=10,
    ) as r:
        d = json.loads(r.read())
    rows = d.get("rows", [])
    check("hugovk top-pypi-packages → rows array",        len(rows) > 0)
    check("hugovk top-pypi-packages → rows[0].project",   bool(rows[0].get("project") if rows else None))
except Exception as exc:
    check("hugovk API reachable", False, str(exc))

# ── Result ────────────────────────────────────────────────────────────────── #
print()
if FAILURES:
    print(f"SCHEMA HEALTH CHECK FAILED — {len(FAILURES)} issue(s):")
    for f in FAILURES:
        print(f"  • {f}")
    sys.exit(1)
else:
    print("All API schemas healthy.")
