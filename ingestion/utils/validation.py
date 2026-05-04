"""
ingestion/utils/validation.py
Schema validation for all DESK ingestion API responses (D015).

Each ingestion script defines its own MINIMAL_SCHEMA constant and calls
validate_response() after fetching, before parsing any fields.
On failure: logs the exact field path and re-raises to fail the GitHub Actions step.
"""
import logging

import jsonschema

logger = logging.getLogger(__name__)


def validate_response(response: dict, schema: dict, source: str) -> None:
    try:
        jsonschema.validate(instance=response, schema=schema)
    except jsonschema.ValidationError as exc:
        logger.error(
            "SCHEMA_CHANGE_DETECTED source=%s field=%s message=%s",
            source,
            list(exc.path),
            exc.message,
        )
        raise
