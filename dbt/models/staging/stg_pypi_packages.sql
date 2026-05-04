WITH deduped AS (
    SELECT
        package_name,
        latest_version,
        summary,
        author,
        author_email,
        requires_python,
        monthly_downloads,
        github_repo_url,
        requires_dist,
        ROW_NUMBER() OVER (
            PARTITION BY package_name
            ORDER BY ingested_at DESC
        ) AS rn
    FROM {{ source('desk_raw', 'raw_pypi_packages') }}
)

SELECT
    package_name,
    latest_version,
    summary,
    author,
    author_email,
    requires_python,
    monthly_downloads,
    github_repo_url,
    requires_dist
FROM deduped
WHERE rn = 1
