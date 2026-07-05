WITH deduped AS (
    SELECT
        package_name,
        github_repo_url,
        repo_owner,
        repo_name,
        last_commit_at,
        commit_count_90d,
        open_issues_count,
        stars_count,
        forks_count,
        contributors_count,
        is_archived,
        is_fork,
        primary_language,
        license_spdx,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY github_repo_url
            ORDER BY ingested_at DESC
        ) AS rn
    FROM {{ source('desk_raw', 'raw_github_maintainers') }}
),

with_days AS (
    SELECT
        *,
        DATEDIFF('day', last_commit_at::DATE, CURRENT_DATE) AS days_since_last_commit
    FROM deduped
    WHERE rn = 1
)

SELECT
    package_name,
    github_repo_url,
    repo_owner,
    repo_name,
    last_commit_at,
    days_since_last_commit,
    commit_count_90d,
    open_issues_count,
    stars_count,
    forks_count,
    contributors_count,
    is_archived,
    is_fork,
    primary_language,
    license_spdx,
    created_at,
    CASE
        WHEN is_archived = TRUE                   THEN 'ARCHIVED'   -- GitHub-confirmed, not inferred
        WHEN days_since_last_commit <= 30         THEN 'ACTIVE'
        WHEN days_since_last_commit <= 90         THEN 'SLOW'
        WHEN days_since_last_commit <= 365        THEN 'STALE'
        ELSE                                           'DORMANT'    -- 365+ days or NULL commit date - inferred, not confirmed abandoned
    END AS activity_label
FROM with_days
