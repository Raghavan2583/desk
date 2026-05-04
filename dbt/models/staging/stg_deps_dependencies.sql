WITH deduped AS (
    SELECT
        package_name,
        version,
        dependency_name,
        dependency_version_constraint,
        depth_level,
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
    (depth_level = 1) AS is_direct
FROM deduped
WHERE rn = 1
