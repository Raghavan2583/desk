WITH deduped AS (
    SELECT
        package_name,
        dependent_count,
        ROW_NUMBER() OVER (
            PARTITION BY package_name
            ORDER BY ingested_at DESC
        ) AS rn
    FROM {{ source('desk_raw', 'raw_deps_dependents') }}
)

SELECT
    package_name,
    dependent_count
FROM deduped
WHERE rn = 1
