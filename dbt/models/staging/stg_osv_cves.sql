-- Dedup to latest record per CVE first, then filter out withdrawn.
-- This ensures a CVE that was later withdrawn is excluded even if
-- older non-withdrawn records exist in the raw table.

WITH latest AS (
    SELECT
        package_name,
        osv_id,
        severity,
        cvss_score,
        published_at,
        modified_at,
        is_withdrawn,
        aliases,
        affected_versions,
        fixed_in_version,
        ROW_NUMBER() OVER (
            PARTITION BY package_name, osv_id
            ORDER BY ingested_at DESC
        ) AS rn
    FROM {{ source('desk_raw', 'raw_osv_cves') }}
),

current_state AS (
    SELECT * FROM latest WHERE rn = 1
)

SELECT
    package_name,
    osv_id,
    severity,
    cvss_score,
    published_at,
    modified_at,
    aliases,
    affected_versions,
    fixed_in_version
FROM current_state
WHERE is_withdrawn = FALSE
