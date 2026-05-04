-- CVE counts per package grouped by severity label.
-- Only packages with at least one active CVE appear here.
-- Packages absent from this table have cve_component = 0 in risk scoring
-- (handled by LEFT JOIN + COALESCE in risk_score.py).

SELECT
    package_name,
    COUNTIF(severity = 'CRITICAL') AS critical_count,
    COUNTIF(severity = 'HIGH')     AS high_count,
    COUNTIF(severity = 'MEDIUM')   AS medium_count,
    COUNTIF(severity = 'LOW')      AS low_count,
    COUNT(*)                        AS total_cve_count
FROM {{ ref('stg_osv_cves') }}
GROUP BY package_name
