SELECT
    package_name,
    dependency_name,
    dependency_version_constraint,
    depth_level,
    is_direct,
    CURRENT_TIMESTAMP() AS ingested_at
FROM {{ ref('stg_deps_dependencies') }}
