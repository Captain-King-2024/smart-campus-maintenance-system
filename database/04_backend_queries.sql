-- =====================================================================
--  FILE 4 of 4 : BACKEND QUERIES  (what the Next.js API routes run)
--  $1, $2 ... are query parameters (node-postgres style):
--        await pool.query(sqlText, [value1, value2]);
--  Parameters are never concatenated into the SQL text -> no SQL injection.
--  This file is a reference; it is not meant to be run as one script.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. EVERY WRITE REQUEST RUNS INSIDE ONE TRANSACTION AND TELLS THE DB WHO IS ACTING
--    (the audit-log trigger reads app.current_user_id)
--
--      BEGIN;
--      SELECT set_config('app.current_user_id', $1::text, true);   -- $1 = logged-in user id
--      ... the query / queries of the endpoint ...
--      COMMIT;                                                      -- or ROLLBACK on any error
-- ---------------------------------------------------------------------
SELECT set_config('app.current_user_id', $1::text, true);


-- =====================================================================
-- 1. AUTHENTICATION / SESSION                         POST /api/auth/login
-- =====================================================================
-- 1.1 find the user by e-mail (the password check happens in the auth layer, see note below)
SELECT user_id, department_id, email, name, role, status
FROM users
WHERE email = $1;

-- NOTE : the 14-table design has no password column. Two options:
--   (a) keep authentication outside the database (NextAuth / OAuth / mock users), or
--   (b) add a hashed password column (never store plain text):
--         CREATE EXTENSION IF NOT EXISTS pgcrypto;
--         ALTER TABLE users ADD COLUMN password_hash TEXT;
--         UPDATE users SET password_hash = crypt('ChangeMe123', gen_salt('bf'));   -- demo only
--       login check :  SELECT user_id, role FROM users
--                      WHERE email = $1 AND password_hash = crypt($2, password_hash) AND status = 'ACTIVE';


-- =====================================================================
-- 2. LOOKUP DATA FOR FORMS                            GET /api/lookups/*
-- =====================================================================
-- 2.1 categories (with default priority and SLA hours)
SELECT category_id, category_name, default_priority, expected_resolution_hours
FROM complaint_categories
ORDER BY category_name;

-- 2.2 buildings
SELECT building_id, building_name, building_code, number_of_floors
FROM buildings
ORDER BY building_name;

-- 2.3 rooms of one building (dependent drop-down)
SELECT room_id, room_number, floor_number, room_type
FROM rooms
WHERE building_id = $1
ORDER BY floor_number, room_number;


-- =====================================================================
-- 3. STUDENT / FACULTY                                role = STUDENT | FACULTY
-- =====================================================================
-- 3.1 report a complaint                              POST /api/complaints
--     (priority NULL -> category default, deadline calculated by trigger)
INSERT INTO complaints (reported_by, category_id, building_id, room_id, title, description, priority)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING complaint_id, priority, status, reported_at, expected_resolution_at;

-- 3.2 my complaints                                   GET /api/complaints/mine
SELECT c.complaint_id, c.title, cat.category_name, b.building_name, r.room_number,
       c.priority, c.status, c.reported_at, c.expected_resolution_at, c.resolved_at
FROM complaints c
JOIN complaint_categories cat ON cat.category_id = c.category_id
JOIN buildings b              ON b.building_id   = c.building_id
LEFT JOIN rooms r             ON r.room_id       = c.room_id
WHERE c.reported_by = $1
  AND ($2::text IS NULL OR c.status = $2)            -- optional status filter
ORDER BY c.reported_at DESC
LIMIT $3 OFFSET $4;                                  -- pagination

-- 3.3 one complaint (only if it is mine)              GET /api/complaints/:id
SELECT c.*, cat.category_name, b.building_name, r.room_number,
       tu.name AS technician_name
FROM complaints c
JOIN complaint_categories cat ON cat.category_id = c.category_id
JOIN buildings b              ON b.building_id   = c.building_id
LEFT JOIN rooms r             ON r.room_id       = c.room_id
LEFT JOIN complaint_assignments a ON a.complaint_id = c.complaint_id
                                 AND a.assignment_status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS','COMPLETED')
LEFT JOIN technicians t       ON t.technician_id = a.technician_id
LEFT JOIN users tu            ON tu.user_id      = t.user_id
WHERE c.complaint_id = $1 AND c.reported_by = $2;

-- 3.4 status timeline of a complaint                  GET /api/complaints/:id/history
SELECT h.old_status, h.new_status, u.name AS changed_by, h.changed_at
FROM complaint_status_history h
JOIN users u ON u.user_id = h.changed_by
WHERE h.complaint_id = $1
ORDER BY h.history_id;

-- 3.5 give feedback after resolution                  POST /api/complaints/:id/feedback
CALL sp_submit_feedback($1, $2, $3, $4);             -- complaint_id, user_id, rating, comments


-- =====================================================================
-- 4. TECHNICIAN                                       role = TECHNICIAN
-- =====================================================================
-- 4.1 my active tasks                                 GET /api/technician/tasks
SELECT a.assignment_id, a.assignment_status, a.assigned_at,
       c.complaint_id, c.title, c.description, c.priority, c.status AS complaint_status,
       c.expected_resolution_at, b.building_name, r.room_number
FROM complaint_assignments a
JOIN technicians t ON t.technician_id = a.technician_id
JOIN complaints c  ON c.complaint_id  = a.complaint_id
JOIN buildings b   ON b.building_id   = c.building_id
LEFT JOIN rooms r  ON r.room_id       = c.room_id
WHERE t.user_id = $1
  AND a.assignment_status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS')
ORDER BY CASE c.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
         c.expected_resolution_at;

-- 4.2 accept / start / complete a task                PATCH /api/technician/tasks/:id
--     (triggers move the complaint to IN_PROGRESS / RESOLVED and free the technician)
UPDATE complaint_assignments a
SET assignment_status = $2                           -- 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED'
FROM technicians t
WHERE a.assignment_id = $1
  AND t.technician_id = a.technician_id
  AND t.user_id = $3                                 -- a technician can only touch his own tasks
RETURNING a.assignment_id, a.assignment_status, a.started_at, a.completed_at;

-- 4.3 add a work log                                  POST /api/technician/work-logs
INSERT INTO work_logs (assignment_id, technician_id, work_description, work_date, hours_worked)
SELECT a.assignment_id, a.technician_id, $2, COALESCE($3::date, CURRENT_DATE), $4
FROM complaint_assignments a
JOIN technicians t ON t.technician_id = a.technician_id
WHERE a.assignment_id = $1 AND t.user_id = $5
RETURNING work_log_id;

-- 4.4 work logs of one assignment
SELECT work_log_id, work_date, hours_worked, work_description
FROM work_logs
WHERE assignment_id = $1
ORDER BY work_date, work_log_id;

-- 4.5 inventory list for the "use material" form      GET /api/inventory
SELECT item_id, item_code, item_name, quantity_available, unit_cost
FROM inventory_items
ORDER BY item_name;

-- 4.6 use material (stock check + deduction + price snapshot happen in the DB)
--                                                     POST /api/technician/materials
CALL sp_record_material_usage($1, $2, $3, $4);       -- complaint_id, item_id, technician_id, quantity

-- 4.7 materials used on a complaint
SELECT m.complaint_material_id, i.item_name, m.quantity_used, m.unit_cost, m.total_cost, u.name AS used_by
FROM complaint_materials m
JOIN inventory_items i ON i.item_id = m.item_id
JOIN technicians t     ON t.technician_id = m.technician_id
JOIN users u           ON u.user_id = t.user_id
WHERE m.complaint_id = $1
ORDER BY m.complaint_material_id;


-- =====================================================================
-- 5. MAINTENANCE MANAGER                              role = MAINTENANCE_MANAGER
-- =====================================================================
-- 5.1 dashboard counters                              GET /api/manager/summary
SELECT COUNT(*) FILTER (WHERE status = 'SUBMITTED')                                       AS new_complaints,
       COUNT(*) FILTER (WHERE status IN ('ASSIGNED','IN_PROGRESS'))                       AS in_progress,
       COUNT(*) FILTER (WHERE status NOT IN ('RESOLVED','CLOSED','REJECTED')
                          AND expected_resolution_at < CURRENT_TIMESTAMP)                 AS overdue,
       COUNT(*) FILTER (WHERE priority = 'CRITICAL'
                          AND status NOT IN ('RESOLVED','CLOSED','REJECTED'))             AS critical_open,
       COUNT(*) FILTER (WHERE status IN ('RESOLVED','CLOSED'))                            AS resolved_total
FROM complaints;

-- 5.2 live complaint board with filters               GET /api/manager/complaints
SELECT *
FROM v_active_complaint_dashboard
WHERE ($1::text IS NULL OR status = $1)
  AND ($2::text IS NULL OR priority = $2)
  AND ($3::text IS NULL OR escalation_status = $3)
ORDER BY CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
         expected_resolution_at;

-- 5.3 review / reject / hold                          PATCH /api/manager/complaints/:id/status
UPDATE complaints
SET status = $2
WHERE complaint_id = $1
RETURNING complaint_id, status, resolved_at;

-- 5.4 smart auto-assignment                           POST /api/manager/complaints/:id/assign
SELECT assign_technician_to_complaint($1, $2) AS technician_id;      -- complaint_id, manager user_id

-- 5.5 manual assignment (manager picks a technician)
INSERT INTO complaint_assignments (complaint_id, technician_id, assigned_by)
VALUES ($1, $2, $3)
RETURNING assignment_id, assigned_at;

-- 5.6 technicians available for a category (drop-down for manual assignment)
SELECT technician_id, technician_name, availability_status, active_tasks, avg_rating
FROM v_technician_performance
WHERE specialization = (SELECT category_name FROM complaint_categories WHERE category_id = $1)
  AND availability_status IN ('AVAILABLE','BUSY')
ORDER BY active_tasks, technician_name;

-- 5.7 technician workload and performance             GET /api/manager/technicians
SELECT * FROM v_technician_performance ORDER BY team_name, technician_name;

-- 5.8 change technician availability
UPDATE technicians SET availability_status = $2 WHERE technician_id = $1 RETURNING technician_id, availability_status;

-- 5.9 assignment history of a complaint
SELECT a.assignment_id, tu.name AS technician, mu.name AS assigned_by,
       a.assigned_at, a.started_at, a.completed_at, a.assignment_status
FROM complaint_assignments a
JOIN technicians t ON t.technician_id = a.technician_id
JOIN users tu      ON tu.user_id = t.user_id
JOIN users mu      ON mu.user_id = a.assigned_by
WHERE a.complaint_id = $1
ORDER BY a.assignment_id;

-- 5.10 inventory alerts and restocking                GET/PATCH /api/manager/inventory
SELECT item_code, item_name, quantity_available
FROM inventory_items
WHERE quantity_available <= $1                       -- threshold, e.g. 10
ORDER BY quantity_available;

UPDATE inventory_items
SET quantity_available = quantity_available + $2     -- atomic, no read-modify-write race
WHERE item_id = $1
RETURNING item_id, quantity_available;


-- =====================================================================
-- 6. ADMIN                                            role = ADMIN
-- =====================================================================
-- 6.1 users list with search + role filter            GET /api/admin/users
SELECT u.user_id, u.name, u.email, u.role, u.status, d.department_name
FROM users u
LEFT JOIN departments d ON d.department_id = u.department_id
WHERE ($1::text IS NULL OR u.role = $1)
  AND ($2::text IS NULL OR u.name ILIKE '%' || $2 || '%' OR u.email ILIKE '%' || $2 || '%')
ORDER BY u.name
LIMIT $3 OFFSET $4;

-- 6.2 create / update / deactivate a user
INSERT INTO users (department_id, email, name, role, status)
VALUES ($1, $2, $3, $4, COALESCE($5, 'ACTIVE'))
RETURNING user_id;

UPDATE users
SET department_id = $2, name = $3, role = $4, status = $5
WHERE user_id = $1
RETURNING user_id, name, role, status;

UPDATE users SET status = 'INACTIVE' WHERE user_id = $1 RETURNING user_id, status;   -- soft delete

-- 6.3 register a technician
INSERT INTO technicians (user_id, team_id, employee_code, specialization, experience_years)
VALUES ($1, $2, $3, $4, $5)
RETURNING technician_id;

-- 6.4 buildings, rooms, categories, departments, teams, inventory (same pattern for each)
INSERT INTO buildings (building_name, building_code, building_type, number_of_floors)
VALUES ($1, $2, $3, $4) RETURNING building_id;

INSERT INTO rooms (building_id, room_number, floor_number, room_type)
VALUES ($1, $2, $3, $4) RETURNING room_id;

INSERT INTO complaint_categories (category_name, default_priority, expected_resolution_hours)
VALUES ($1, $2, $3) RETURNING category_id;

INSERT INTO departments (department_name, department_code, department_type)
VALUES ($1, $2, $3) RETURNING department_id;

INSERT INTO maintenance_teams (manager_id, team_name, specialization)
VALUES ($1, $2, $3) RETURNING team_id;

INSERT INTO inventory_items (item_code, item_name, quantity_available, unit_cost)
VALUES ($1, $2, $3, $4) RETURNING item_id;

UPDATE complaint_categories
SET default_priority = $2, expected_resolution_hours = $3
WHERE category_id = $1
RETURNING category_id;


-- =====================================================================
-- 7. REPORTS AND ANALYTICS                            GET /api/admin/reports/*
-- =====================================================================
-- 7.1 complaints by category
SELECT cat.category_name, COUNT(*) AS total
FROM complaints c JOIN complaint_categories cat ON cat.category_id = c.category_id
WHERE c.reported_at >= $1 AND c.reported_at < $2
GROUP BY cat.category_name
ORDER BY total DESC;

-- 7.2 complaints by building and status               (heat-map table)
SELECT b.building_name, c.status, COUNT(*) AS total
FROM complaints c JOIN buildings b ON b.building_id = c.building_id
GROUP BY b.building_name, c.status
ORDER BY b.building_name, c.status;

-- 7.3 average resolution time vs SLA (CTE)
WITH resolved AS (
    SELECT category_id, EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 3600 AS hours_taken
    FROM complaints WHERE resolved_at IS NOT NULL
)
SELECT cat.category_name, cat.expected_resolution_hours AS sla_hours,
       ROUND(AVG(r.hours_taken)::numeric, 1) AS avg_hours_taken,
       ROUND(100.0 * COUNT(*) FILTER (WHERE r.hours_taken <= cat.expected_resolution_hours) / COUNT(*), 1) AS sla_met_percent
FROM resolved r JOIN complaint_categories cat ON cat.category_id = r.category_id
GROUP BY cat.category_name, cat.expected_resolution_hours
ORDER BY sla_met_percent;

-- 7.4 monthly trend for the last N months (recursive CTE, months with 0 still appear)
WITH RECURSIVE months(month_start) AS (
    SELECT date_trunc('month', CURRENT_DATE - make_interval(months => $1 - 1))::date
    UNION ALL
    SELECT (month_start + interval '1 month')::date FROM months
    WHERE month_start < date_trunc('month', CURRENT_DATE)::date
)
SELECT to_char(m.month_start, 'Mon YYYY') AS month, COUNT(c.complaint_id) AS complaints
FROM months m
LEFT JOIN complaints c ON date_trunc('month', c.reported_at)::date = m.month_start
GROUP BY m.month_start
ORDER BY m.month_start;

-- 7.5 technician leaderboard (window function)
SELECT technician_name, completed_tasks, total_hours, avg_rating,
       RANK() OVER (ORDER BY avg_rating DESC NULLS LAST, completed_tasks DESC) AS position
FROM v_technician_performance
ORDER BY position;

-- 7.6 maintenance cost per building
SELECT b.building_name,
       COALESCE(SUM(cs.material_cost), 0) AS material_cost,
       COALESCE(SUM(cs.labor_hours), 0)   AS labour_hours
FROM buildings b
LEFT JOIN complaints c            ON c.building_id = b.building_id
LEFT JOIN v_complaint_cost_summary cs ON cs.complaint_id = c.complaint_id
GROUP BY b.building_name
ORDER BY material_cost DESC;

-- 7.7 pre-computed monthly statistics (materialized view)
SELECT * FROM mv_category_monthly_stats WHERE month >= $1 ORDER BY month, category_name;


-- =====================================================================
-- 8. SCHEDULED BACKEND JOBS  (cron route, e.g. every 15 minutes / nightly)
-- =====================================================================
SELECT fn_escalate_overdue_complaints() AS escalated;
SELECT fn_auto_close_resolved($1)       AS closed;           -- e.g. 7 days
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_monthly_stats;
