-- =====================================================================
--  FILE 3 of 4 : QUERIES + LIVE DEMO  (present this file top to bottom)
--  Run after 01_schema.sql and 02_seed_data.sql.
--
--  Tip: run one numbered block at a time in pgAdmin / psql and explain it.
--  Blocks that are meant to FAIL are wrapped in DO ... EXCEPTION so the
--  script keeps running and prints  "EXPECTED FAILURE: <reason>".
--
--  Section A  Basic queries   (JOIN, GROUP BY, HAVING, ORDER BY, subqueries)
--  Section B  CTEs            (WITH, multi-CTE, recursive, data-modifying)
--  Section C  Window functions
--  Section D  Views
--  Section E  Functions and procedures
--  Section F  Triggers        (live proof)
--  Section G  Transactions    (COMMIT, ROLLBACK, SAVEPOINT, locking)
--  Section H  Scheduled jobs  (escalation, auto-close)
--  Section I  Indexes         (EXPLAIN)
--  Section J  Roles and privileges
-- =====================================================================


-- #####################################################################
-- SECTION A : BASIC QUERIES
-- #####################################################################

-- A1. JOIN : every complaint with reporter, category, building and room
SELECT c.complaint_id, c.title, u.name AS reported_by, cat.category_name,
       b.building_name, r.room_number, c.priority, c.status
FROM complaints c
JOIN users u                  ON u.user_id     = c.reported_by
JOIN complaint_categories cat ON cat.category_id = c.category_id
JOIN buildings b              ON b.building_id = c.building_id
LEFT JOIN rooms r             ON r.room_id     = c.room_id       -- room is optional
ORDER BY c.complaint_id;

-- A2. GROUP BY + aggregates : complaints per category
SELECT cat.category_name,
       COUNT(*)                          AS total,
       COUNT(*) FILTER (WHERE c.status IN ('RESOLVED','CLOSED')) AS resolved,
       MIN(c.reported_at)::date          AS first_reported,
       MAX(c.reported_at)::date          AS last_reported
FROM complaints c
JOIN complaint_categories cat ON cat.category_id = c.category_id
GROUP BY cat.category_name
ORDER BY total DESC, cat.category_name;

-- A3. HAVING : categories with more than one complaint
SELECT cat.category_name, COUNT(*) AS total
FROM complaints c
JOIN complaint_categories cat ON cat.category_id = c.category_id
GROUP BY cat.category_name
HAVING COUNT(*) > 1
ORDER BY total DESC;

-- A4. LEFT JOIN + ORDER BY : complaints per building (buildings with zero also appear)
SELECT b.building_name, COUNT(c.complaint_id) AS complaints
FROM buildings b
LEFT JOIN complaints c ON c.building_id = b.building_id
GROUP BY b.building_name
ORDER BY complaints DESC, b.building_name;

-- A5. Subquery in HAVING : technicians who completed more tasks than the average technician
SELECT t.technician_id, u.name, COUNT(*) AS completed_tasks
FROM complaint_assignments a
JOIN technicians t ON t.technician_id = a.technician_id
JOIN users u       ON u.user_id = t.user_id
WHERE a.assignment_status = 'COMPLETED'
GROUP BY t.technician_id, u.name
HAVING COUNT(*) > (SELECT AVG(cnt) FROM (
                       SELECT COUNT(*) AS cnt
                       FROM complaint_assignments
                       WHERE assignment_status = 'COMPLETED'
                       GROUP BY technician_id) x);

-- A6. NOT EXISTS : open complaints nobody has been assigned to yet
SELECT c.complaint_id, c.title, c.priority, c.status
FROM complaints c
WHERE c.status IN ('SUBMITTED','UNDER_REVIEW','ON_HOLD')
  AND NOT EXISTS (SELECT 1 FROM complaint_assignments a WHERE a.complaint_id = c.complaint_id)
ORDER BY CASE c.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
         c.reported_at;

-- A7. IN + correlated subquery : users who reported more than one complaint
SELECT u.user_id, u.name, u.role,
       (SELECT COUNT(*) FROM complaints c WHERE c.reported_by = u.user_id) AS complaints_reported
FROM users u
WHERE u.user_id IN (SELECT reported_by FROM complaints GROUP BY reported_by HAVING COUNT(*) > 1);

-- A8. Low-stock inventory (CASE expression)
SELECT item_code, item_name, quantity_available,
       CASE WHEN quantity_available <= 5  THEN 'REORDER NOW'
            WHEN quantity_available <= 20 THEN 'LOW'
            ELSE 'OK' END AS stock_level
FROM inventory_items
ORDER BY quantity_available;

-- A9. Set operation (UNION) : everyone who is involved in a complaint, with the role they played
SELECT u.name, 'REPORTER' AS involvement FROM users u JOIN complaints c ON c.reported_by = u.user_id
UNION
SELECT u.name, 'TECHNICIAN' FROM users u JOIN technicians t ON t.user_id = u.user_id
                                         JOIN complaint_assignments a ON a.technician_id = t.technician_id
ORDER BY involvement, name;


-- #####################################################################
-- SECTION B : COMMON TABLE EXPRESSIONS (CTE)
-- #####################################################################

-- B1. CTE : average resolution time per category vs. its SLA
WITH resolved AS (
    SELECT c.category_id,
           EXTRACT(EPOCH FROM (c.resolved_at - c.reported_at)) / 3600 AS hours_taken
    FROM complaints c
    WHERE c.resolved_at IS NOT NULL
)
SELECT cat.category_name,
       cat.expected_resolution_hours                    AS sla_hours,
       COUNT(*)                                         AS resolved_count,
       ROUND(AVG(r.hours_taken)::numeric, 1)            AS avg_hours_taken,
       CASE WHEN AVG(r.hours_taken) <= cat.expected_resolution_hours
            THEN 'WITHIN SLA' ELSE 'SLA BREACHED' END   AS sla_status
FROM resolved r
JOIN complaint_categories cat ON cat.category_id = r.category_id
GROUP BY cat.category_name, cat.expected_resolution_hours
ORDER BY avg_hours_taken DESC;

-- B2. Multiple CTEs : technician scorecard
WITH tasks AS (
    SELECT technician_id,
           COUNT(*) FILTER (WHERE assignment_status = 'COMPLETED')                         AS completed,
           COUNT(*) FILTER (WHERE assignment_status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS')) AS active
    FROM complaint_assignments GROUP BY technician_id
),
hours AS (
    SELECT technician_id, SUM(hours_worked) AS total_hours FROM work_logs GROUP BY technician_id
),
ratings AS (
    SELECT technician_id, ROUND(AVG(rating), 2) AS avg_rating, COUNT(*) AS reviews
    FROM feedback GROUP BY technician_id
)
SELECT u.name, t.specialization,
       COALESCE(tasks.completed, 0) AS completed,
       COALESCE(tasks.active, 0)    AS active,
       COALESCE(hours.total_hours, 0) AS hours_worked,
       ratings.avg_rating, COALESCE(ratings.reviews, 0) AS reviews
FROM technicians t
JOIN users u ON u.user_id = t.user_id
LEFT JOIN tasks   ON tasks.technician_id   = t.technician_id
LEFT JOIN hours   ON hours.technician_id   = t.technician_id
LEFT JOIN ratings ON ratings.technician_id = t.technician_id
ORDER BY ratings.avg_rating DESC NULLS LAST, completed DESC;

-- B3. RECURSIVE CTE : monthly trend for the last 6 months (months with 0 complaints still show)
WITH RECURSIVE months(month_start) AS (
    SELECT date_trunc('month', CURRENT_DATE - interval '5 months')::date
    UNION ALL
    SELECT (month_start + interval '1 month')::date
    FROM months
    WHERE month_start < date_trunc('month', CURRENT_DATE)::date
)
SELECT to_char(m.month_start, 'Mon YYYY') AS month,
       COUNT(c.complaint_id)              AS complaints_reported
FROM months m
LEFT JOIN complaints c ON date_trunc('month', c.reported_at)::date = m.month_start
GROUP BY m.month_start
ORDER BY m.month_start;

-- B4. CTE + JOIN : full cost report of the closed complaints (materials + labour)
WITH material AS (
    SELECT complaint_id, SUM(total_cost) AS material_cost FROM complaint_materials GROUP BY complaint_id
),
labour AS (
    SELECT a.complaint_id, SUM(w.hours_worked) AS hours
    FROM work_logs w JOIN complaint_assignments a ON a.assignment_id = w.assignment_id
    GROUP BY a.complaint_id
)
SELECT c.complaint_id, c.title,
       COALESCE(m.material_cost, 0) AS material_cost,
       COALESCE(l.hours, 0)         AS labour_hours
FROM complaints c
LEFT JOIN material m ON m.complaint_id = c.complaint_id
LEFT JOIN labour   l ON l.complaint_id = c.complaint_id
WHERE c.status = 'CLOSED'
ORDER BY material_cost DESC;

-- B5. DATA-MODIFYING CTE : used inside fn_escalate_overdue_complaints() and fn_auto_close_resolved()
--     (UPDATE ... RETURNING inside WITH, then count the rows) - see file 1, section 3.5 / 3.6


-- #####################################################################
-- SECTION C : WINDOW FUNCTIONS
-- #####################################################################

-- C1. RANK technicians by average rating
SELECT u.name, ROUND(AVG(f.rating), 2) AS avg_rating,
       RANK() OVER (ORDER BY AVG(f.rating) DESC) AS rating_rank
FROM feedback f
JOIN technicians t ON t.technician_id = f.technician_id
JOIN users u       ON u.user_id = t.user_id
GROUP BY u.name;

-- C2. Newest complaint of every building (ROW_NUMBER + PARTITION BY)
SELECT building_name, title, reported_at
FROM (
    SELECT b.building_name, c.title, c.reported_at,
           ROW_NUMBER() OVER (PARTITION BY b.building_id ORDER BY c.reported_at DESC) AS rn
    FROM complaints c JOIN buildings b ON b.building_id = c.building_id
) x
WHERE rn = 1;

-- C3. Time a complaint spent in every status (LEAD over the audit history)
--     (durations are tiny here because the seed script ran in one second; in real use they are hours/days)
SELECT complaint_id, old_status, new_status, changed_at,
       LEAD(changed_at) OVER (PARTITION BY complaint_id ORDER BY history_id) - changed_at AS time_in_this_status
FROM complaint_status_history
WHERE complaint_id IN (1, 2)
ORDER BY complaint_id, history_id;

-- C4. Running total of complaints reported per day
SELECT reported_at::date AS day,
       COUNT(*)          AS reported,
       SUM(COUNT(*)) OVER (ORDER BY reported_at::date) AS running_total
FROM complaints
GROUP BY reported_at::date
ORDER BY day;


-- #####################################################################
-- SECTION D : VIEWS
-- #####################################################################
SELECT * FROM v_active_complaint_dashboard ORDER BY escalation_status DESC, hours_overdue DESC;   -- D1
SELECT * FROM v_technician_performance      ORDER BY technician_id;                                -- D2
SELECT * FROM v_complaint_cost_summary      WHERE material_cost > 0 ORDER BY material_cost DESC;   -- D3
SELECT * FROM v_building_complaint_summary  ORDER BY total_complaints DESC;                        -- D4

-- D5. MATERIALIZED VIEW = stored snapshot: refresh it, then read it
REFRESH MATERIALIZED VIEW mv_category_monthly_stats;
SELECT * FROM mv_category_monthly_stats ORDER BY month, category_name;


-- #####################################################################
-- SECTION E : FUNCTIONS AND PROCEDURES
-- #####################################################################

-- E1. function : workload + material cost
SELECT t.technician_id, u.name, fn_technician_workload(t.technician_id) AS active_tasks
FROM technicians t JOIN users u ON u.user_id = t.user_id ORDER BY active_tasks DESC;

SELECT complaint_id, fn_complaint_material_cost(complaint_id) AS material_cost
FROM complaints WHERE complaint_id IN (2, 3);

-- E2. smart assignment of a brand-new complaint (a manager assigns complaint 5 = Carpentry)
SELECT assign_technician_to_complaint(5, 2) AS assigned_technician_id;     -- expect TECH-004 (id 4)
SELECT complaint_id, status FROM complaints WHERE complaint_id = 5;          -- status is now ASSIGNED

-- E3. procedures : record material usage, then give feedback
CALL sp_record_material_usage(3, 5, 8, 10);                 -- 10 m CAT6 cable on complaint 3 (technician 8)
SELECT item_name, quantity_available FROM inventory_items WHERE item_code = 'NET-CAT6-M';   -- 290 left


-- #####################################################################
-- SECTION F : TRIGGERS - LIVE PROOF
-- #####################################################################

-- F1. Status history is written automatically
SELECT h.history_id, h.old_status, h.new_status, u.name AS changed_by, h.changed_at
FROM complaint_status_history h JOIN users u ON u.user_id = h.changed_by
WHERE h.complaint_id = 1 ORDER BY h.history_id;

-- F2. A new complaint gets its priority and deadline from the category
INSERT INTO complaints (reported_by, category_id, building_id, room_id, title, description)
VALUES (12, 6, 1, 2, 'Ceiling plaster falling in Room 302', 'Pieces of plaster fell near the first row.');
SELECT complaint_id, priority, status, reported_at, expected_resolution_at
FROM complaints ORDER BY complaint_id DESC LIMIT 1;        -- CRITICAL, deadline = reported_at + 8 hours

-- F3. Illegal status jump is blocked   (SUBMITTED -> CLOSED)
DO $$
BEGIN
    UPDATE complaints SET status = 'CLOSED' WHERE complaint_id = 7;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM;
END $$;

-- F4. Room must belong to the chosen building
DO $$
BEGIN
    INSERT INTO complaints (reported_by, category_id, building_id, room_id, title, description)
    VALUES (12, 1, 2, 2, 'Wrong room', 'Room 2 is in building 1, not building 2');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM;
END $$;

-- F5. Inactive users cannot report
DO $$
BEGIN
    INSERT INTO complaints (reported_by, category_id, building_id, title, description)
    VALUES (18, 1, 1, 'From inactive user', 'Should be rejected');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM;
END $$;

-- F6. Inventory can never go negative
DO $$
BEGIN
    CALL sp_record_material_usage(3, 6, 8, 99);             -- only a few projector lamps in stock
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM;
END $$;
SELECT item_name, quantity_available FROM inventory_items WHERE item_code = 'AV-PROJ-LAMP';   -- unchanged

-- F7. Feedback only after resolution, only by the reporter
DO $$
BEGIN
    INSERT INTO feedback (complaint_id, user_id, technician_id, rating) VALUES (3, 16, 8, 5);   -- complaint 3 still open
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM;
END $$;

DO $$
BEGIN
    INSERT INTO feedback (complaint_id, user_id, technician_id, rating) VALUES (1, 13, 1, 5);   -- wrong user
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM;
END $$;

-- F8. Only one feedback per complaint (UNIQUE constraint)
DO $$
BEGIN
    CALL sp_submit_feedback(1, 12, 3, 'second review');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM;
END $$;

-- F9. Audit log cannot be edited
DO $$
BEGIN
    UPDATE complaint_status_history SET new_status = 'CLOSED' WHERE history_id = 1;
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM;
END $$;

-- F10. Only a technician can be a technician / only a manager can manage a team
DO $$
BEGIN
    INSERT INTO technicians (user_id, team_id, employee_code, specialization) VALUES (12, 1, 'TECH-999', 'Electrical');
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM;
END $$;

-- F11. Re-assignment keeps the history (old row becomes REASSIGNED, technician freed / busy)
SELECT assign_technician_to_complaint(4, 3);   -- complaint 4 (IT) again -> same IT technician, old row REASSIGNED
SELECT assignment_id, complaint_id, technician_id, assignment_status
FROM complaint_assignments WHERE complaint_id = 4 ORDER BY assignment_id;

-- F12. Re-open a resolved complaint (RESOLVED -> IN_PROGRESS clears resolved_at)
-- (complaint 1 is CLOSED, so use a fresh example:)
UPDATE complaint_assignments SET assignment_status = 'COMPLETED'
WHERE complaint_id = 3 AND assignment_status = 'IN_PROGRESS';                    -- technician finishes complaint 3
SELECT complaint_id, status, resolved_at IS NOT NULL AS has_resolved_at FROM complaints WHERE complaint_id = 3;   -- RESOLVED
UPDATE complaints SET status = 'IN_PROGRESS' WHERE complaint_id = 3;             -- user says "not fixed"
SELECT complaint_id, status, resolved_at IS NOT NULL AS has_resolved_at FROM complaints WHERE complaint_id = 3;   -- resolved_at is NULL again


-- #####################################################################
-- SECTION G : TRANSACTIONS
-- #####################################################################

-- G1. COMMIT : all steps succeed together and become permanent
BEGIN;
    CALL sp_record_material_usage(8, 2, 5, 1);                                                   -- 1 x MCB 16A on complaint 8
    SELECT item_name, quantity_available FROM inventory_items WHERE item_code = 'ELE-MCB-16A';   -- 19 inside the transaction
COMMIT;

-- G2. ROLLBACK : nothing is kept
BEGIN;
    CALL sp_record_material_usage(8, 1, 5, 5);
    SELECT item_name, quantity_available FROM inventory_items WHERE item_code = 'ELE-LED-18W';   -- reduced by 5
ROLLBACK;
SELECT item_name, quantity_available FROM inventory_items WHERE item_code = 'ELE-LED-18W';       -- back to the old value

-- G3. SAVEPOINT : undo only the failing part
BEGIN;
    CALL sp_record_material_usage(8, 7, 5, 2);                  -- OK : 2 hinge sets
    SAVEPOINT before_big_request;
    DO $$ BEGIN
        CALL sp_record_material_usage(8, 6, 5, 50);             -- fails: not enough projector lamps
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM; END $$;
    ROLLBACK TO SAVEPOINT before_big_request;
    CALL sp_record_material_usage(8, 8, 5, 1);                  -- OK : continue with a smaller request
COMMIT;
SELECT complaint_id, item_id, quantity_used, unit_cost, total_cost FROM complaint_materials WHERE complaint_id = 8;

-- G4. Concurrency (try in two query windows):
--   Window A:  BEGIN;  CALL sp_record_material_usage(8, 6, 5, 3);     -- locks the projector-lamp row
--   Window B:  BEGIN;  CALL sp_record_material_usage(3, 6, 8, 3);     -- WAITS for A (row lock inside the trigger)
--   Window A:  COMMIT;                                                -- B continues and sees the updated stock
-- Result: two technicians can never use the same last items twice.

-- G5. Isolation level example
BEGIN ISOLATION LEVEL REPEATABLE READ;
    SELECT COUNT(*) AS open_complaints FROM complaints WHERE status NOT IN ('RESOLVED','CLOSED','REJECTED');
    SELECT COUNT(*) AS open_complaints_again FROM complaints WHERE status NOT IN ('RESOLVED','CLOSED','REJECTED');
COMMIT;


-- #####################################################################
-- SECTION H : SCHEDULED JOBS  (escalation + auto close)
-- #####################################################################

-- H1. Before : which complaints are overdue?
SELECT complaint_id, title, priority, status, hours_overdue
FROM v_active_complaint_dashboard WHERE escalation_status = 'OVERDUE' ORDER BY hours_overdue DESC;

-- H2. Run the escalation job (priority goes up one level, new shorter deadline is set)
SELECT fn_escalate_overdue_complaints() AS complaints_escalated;

-- H3. After
SELECT complaint_id, title, priority, status, expected_resolution_at
FROM v_active_complaint_dashboard
ORDER BY CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, complaint_id;

-- H4. Auto-close job : resolved complaints older than N days become CLOSED
SELECT fn_auto_close_resolved(7) AS complaints_closed;


-- #####################################################################
-- SECTION I : INDEXES
-- #####################################################################

-- I1. Which index does a dashboard query use?
EXPLAIN SELECT complaint_id, title FROM complaints
WHERE status NOT IN ('RESOLVED','CLOSED','REJECTED') AND priority = 'CRITICAL';

-- I2. Lookup by e-mail (used at login) uses the UNIQUE index
EXPLAIN SELECT user_id, role FROM users WHERE email = 'aarav.sharma@campus.edu';

-- I3. List all indexes
SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename, indexname;


-- #####################################################################
-- SECTION J : ROLES AND PRIVILEGES
-- #####################################################################

-- J1. A student (app_user) can read and report, but cannot touch inventory
BEGIN;
    SET LOCAL ROLE app_user;
    SELECT COUNT(*) AS visible_complaints FROM complaints;
    DO $$ BEGIN
        UPDATE inventory_items SET quantity_available = 0;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM; END $$;
ROLLBACK;

-- J2. A technician can update only the status column of an assignment
BEGIN;
    SET LOCAL ROLE app_technician;
    DO $$ BEGIN
        UPDATE complaint_assignments SET technician_id = 1 WHERE assignment_id = 1;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'EXPECTED FAILURE: %', SQLERRM; END $$;
ROLLBACK;

-- J3. A manager can assign (triggers still work for every role because they are SECURITY DEFINER)
BEGIN;
    SET LOCAL ROLE app_manager;
    SELECT fn_technician_workload(1) AS ravi_workload;
ROLLBACK;

-- =====================================================================
--  END OF FILE 3
-- =====================================================================
