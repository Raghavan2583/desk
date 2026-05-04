-- Dependency depth and blast radius metrics per package.
-- max_depth and direct_dep_count come from the dependency edge table.
-- blast_radius_count comes from deps.dev global dependent count.
-- Packages absent from both source tables are handled by LEFT JOIN
-- + COALESCE in risk_score.py (depth_component = 0).

WITH dep_edges AS (
    SELECT
        package_name,
        MAX(depth_level)        AS max_depth,
        COUNTIF(is_direct)      AS direct_dep_count
    FROM {{ ref('stg_deps_dependencies') }}
    GROUP BY package_name
)

-- FULL OUTER JOIN ensures packages with no outgoing edges (e.g. certifi, six, idna)
-- still appear with their blast_radius_count from stg_deps_dependents.
-- A LEFT JOIN from dep_edges would silently zero-out their depth component.
SELECT
    COALESCE(e.package_name, d.package_name) AS package_name,
    e.max_depth,
    e.direct_dep_count,
    COALESCE(d.dependent_count, 0) AS blast_radius_count
FROM dep_edges e
FULL OUTER JOIN {{ ref('stg_deps_dependents') }} d
    ON e.package_name = d.package_name
