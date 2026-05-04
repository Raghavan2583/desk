-- One row per package. LEFT JOIN brings in maintainer data where a GitHub URL exists.
-- has_github_link drives the maintainer edge-case in the risk scoring formula
-- (ARCH.md Section 4: no GitHub URL → maintainer raw = 5.0).

SELECT
    p.package_name,
    p.latest_version,
    p.summary,
    p.author,
    p.author_email,
    p.requires_python,
    p.monthly_downloads,
    p.github_repo_url,
    p.requires_dist,
    (p.github_repo_url IS NOT NULL)  AS has_github_link,

    -- Maintainer fields — NULL when has_github_link = FALSE
    g.repo_owner,
    g.repo_name,
    g.last_commit_at,
    g.days_since_last_commit,
    g.commit_count_90d,
    g.open_issues_count,
    g.stars_count,
    g.contributors_count,
    g.is_archived,
    g.is_fork,
    g.activity_label

FROM {{ ref('stg_pypi_packages') }} p
LEFT JOIN {{ ref('stg_github_maintainers') }} g
    ON p.github_repo_url = g.github_repo_url
