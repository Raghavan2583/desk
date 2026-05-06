WITH deduped AS (
    SELECT
        package_name,
        version,
        dependency_name,
        dependency_version_constraint,
        depth_level,
        raw_payload,
        ROW_NUMBER() OVER (
            PARTITION BY package_name, dependency_name, depth_level
            ORDER BY ingested_at DESC
        ) AS rn
    FROM {{ source('desk_raw', 'raw_deps_edges') }}
)

SELECT
    package_name,
    version,
    dependency_name,
    dependency_version_constraint,
    depth_level,
    (depth_level = 1) AS is_direct,
    REGEXP_CONTAINS(
        COALESCE(JSON_VALUE(raw_payload, '$.spec'), ''),
        r';\s*extra\s*=='
    ) AS is_optional
FROM deduped
WHERE rn = 1
