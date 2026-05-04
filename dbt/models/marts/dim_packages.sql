-- first_seen_at and last_updated_at require MIN/MAX across all raw rows for a package.
-- stg_pypi_packages deduplicates to one row (latest), so timestamps are read
-- from the raw source directly here rather than adding a separate staging model.

WITH package_timestamps AS (
    SELECT
        package_name,
        MIN(ingested_at) AS first_seen_at,
        MAX(ingested_at) AS last_updated_at
    FROM {{ source('desk_raw', 'raw_pypi_packages') }}
    GROUP BY package_name
)

SELECT
    p.package_name,
    p.latest_version,
    p.summary,
    p.requires_python,
    p.monthly_downloads,
    p.github_repo_url,
    p.author,
    p.author_email,
    p.has_github_link,
    TRUE                  AS is_top_1000,
    t.first_seen_at,
    t.last_updated_at
FROM {{ ref('int_packages_resolved') }} p
LEFT JOIN package_timestamps t
    ON p.package_name = t.package_name
