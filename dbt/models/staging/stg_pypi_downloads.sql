WITH deduped AS (
    SELECT
        package_name,
        monthly_downloads,
        ROW_NUMBER() OVER (
            PARTITION BY package_name
            ORDER BY ingested_at DESC
        ) AS rn
    FROM {{ source('desk_raw', 'raw_pypi_downloads') }}
)

SELECT
    package_name,
    monthly_downloads
FROM deduped
WHERE rn = 1
