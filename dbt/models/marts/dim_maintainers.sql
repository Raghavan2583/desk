SELECT
    github_repo_url,
    repo_owner,
    repo_name,
    last_commit_at,
    days_since_last_commit,
    commit_count_90d,
    open_issues_count,
    stars_count,
    contributors_count,
    is_archived,
    is_fork,
    activity_label,
    CURRENT_TIMESTAMP() AS last_updated_at
FROM {{ ref('stg_github_maintainers') }}
