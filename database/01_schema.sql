-- =====================================================================
--  SMART CAMPUS MAINTENANCE & COMPLAINT MANAGEMENT SYSTEM  (PostgreSQL)
--  FILE 1 of 4 : SCHEMA  (DDL, indexes, functions, triggers, views, roles)
--
--  Run order : 01_schema.sql -> 02_seed_data.sql -> 03_queries_and_demo.sql
--              04_backend_queries.sql is the reference for the Next.js API.
--
--  psql -U postgres -c "CREATE DATABASE smart_campus_db;"
--  psql -U postgres -d smart_campus_db -f 01_schema.sql
--  (pgAdmin / VS Code: create the DB, connect to it, then run this file)
--
--  Safe to re-run: everything is dropped and rebuilt.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. RESET
-- ---------------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_category_monthly_stats;
DROP VIEW  IF EXISTS v_active_complaint_dashboard, v_technician_performance,
                     v_complaint_cost_summary, v_building_complaint_summary;
DROP TABLE IF EXISTS feedback, complaint_materials, inventory_items, work_logs,
                     complaint_assignments, technicians, maintenance_teams,
                     complaint_status_history, complaints, complaint_categories,
                     rooms, buildings, users, departments CASCADE;


-- =====================================================================
-- 1. DDL  -  14 TABLES
-- =====================================================================

-- 1.1 departments ------------------------------------------------------
CREATE TABLE departments (
    department_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_name  VARCHAR(100) NOT NULL UNIQUE,
    department_code  VARCHAR(20)  NOT NULL UNIQUE,
    department_type  VARCHAR(50)  NOT NULL
);

-- 1.2 users ------------------------------------------------------------
CREATE TABLE users (
    user_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    department_id  INT,
    email          VARCHAR(150) NOT NULL UNIQUE,
    name           VARCHAR(100) NOT NULL,
    role           VARCHAR(30)  NOT NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT chk_users_role   CHECK (role IN ('STUDENT','FACULTY','TECHNICIAN',
                                                'MAINTENANCE_MANAGER','ADMIN')),
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
    CONSTRAINT chk_users_email  CHECK (email LIKE '%_@_%._%'),
    CONSTRAINT fk_users_department FOREIGN KEY (department_id)
        REFERENCES departments(department_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 1.3 buildings --------------------------------------------------------
CREATE TABLE buildings (
    building_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    building_name     VARCHAR(100) NOT NULL,
    building_code     VARCHAR(20)  NOT NULL UNIQUE,
    building_type     VARCHAR(50),
    number_of_floors  INT NOT NULL,

    CONSTRAINT chk_buildings_floors CHECK (number_of_floors > 0)
);

-- 1.4 rooms ------------------------------------------------------------
CREATE TABLE rooms (
    room_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    building_id   INT NOT NULL,
    room_number   VARCHAR(20) NOT NULL,
    floor_number  INT NOT NULL,
    room_type     VARCHAR(50),

    CONSTRAINT chk_rooms_floor CHECK (floor_number >= 0),
    CONSTRAINT uq_rooms_location UNIQUE (building_id, floor_number, room_number),
    CONSTRAINT fk_rooms_building FOREIGN KEY (building_id)
        REFERENCES buildings(building_id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- 1.5 complaint_categories ---------------------------------------------
CREATE TABLE complaint_categories (
    category_id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_name              VARCHAR(100) NOT NULL UNIQUE,
    default_priority           VARCHAR(20)  NOT NULL,
    expected_resolution_hours  INT NOT NULL,

    CONSTRAINT chk_cat_priority CHECK (default_priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    CONSTRAINT chk_cat_hours    CHECK (expected_resolution_hours > 0)
);

-- 1.6 complaints -------------------------------------------------------
CREATE TABLE complaints (
    complaint_id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reported_by             INT NOT NULL,
    category_id             INT NOT NULL,
    building_id             INT NOT NULL,
    room_id                 INT,

    title                   VARCHAR(150) NOT NULL,
    description             TEXT NOT NULL,
    priority                VARCHAR(20)  NOT NULL,
    status                  VARCHAR(30)  NOT NULL DEFAULT 'SUBMITTED',
    reported_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expected_resolution_at  TIMESTAMP,
    resolved_at             TIMESTAMP,

    CONSTRAINT chk_complaints_priority CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    CONSTRAINT chk_complaints_status   CHECK (status IN ('SUBMITTED','UNDER_REVIEW','ASSIGNED',
                                               'IN_PROGRESS','ON_HOLD','RESOLVED','CLOSED','REJECTED')),
    CONSTRAINT chk_complaints_dates    CHECK (resolved_at IS NULL OR resolved_at >= reported_at),

    CONSTRAINT fk_complaints_reporter FOREIGN KEY (reported_by)
        REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_complaints_category FOREIGN KEY (category_id)
        REFERENCES complaint_categories(category_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_complaints_building FOREIGN KEY (building_id)
        REFERENCES buildings(building_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_complaints_room FOREIGN KEY (room_id)
        REFERENCES rooms(room_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 1.7 complaint_status_history -----------------------------------------
CREATE TABLE complaint_status_history (
    history_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    complaint_id  INT NOT NULL,
    changed_by    INT NOT NULL,
    old_status    VARCHAR(30),
    new_status    VARCHAR(30) NOT NULL,
    changed_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_history_new_status CHECK (new_status IN ('SUBMITTED','UNDER_REVIEW','ASSIGNED',
                                               'IN_PROGRESS','ON_HOLD','RESOLVED','CLOSED','REJECTED')),
    CONSTRAINT fk_history_complaint FOREIGN KEY (complaint_id)
        REFERENCES complaints(complaint_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_history_changed_by FOREIGN KEY (changed_by)
        REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 1.8 maintenance_teams ------------------------------------------------
CREATE TABLE maintenance_teams (
    team_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    manager_id      INT,
    team_name       VARCHAR(100) NOT NULL UNIQUE,
    specialization  VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT chk_teams_status CHECK (status IN ('ACTIVE','INACTIVE')),
    CONSTRAINT fk_teams_manager FOREIGN KEY (manager_id)
        REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- 1.9 technicians ------------------------------------------------------
CREATE TABLE technicians (
    technician_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             INT NOT NULL UNIQUE,
    team_id             INT NOT NULL,
    employee_code       VARCHAR(30) NOT NULL UNIQUE,
    specialization      VARCHAR(100),
    availability_status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE',
    experience_years    INT DEFAULT 0,

    CONSTRAINT chk_tech_availability CHECK (availability_status IN ('AVAILABLE','BUSY','OFF_DUTY','ON_LEAVE')),
    CONSTRAINT chk_tech_experience   CHECK (experience_years >= 0),
    CONSTRAINT fk_tech_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_tech_team FOREIGN KEY (team_id)
        REFERENCES maintenance_teams(team_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 1.10 complaint_assignments -------------------------------------------
CREATE TABLE complaint_assignments (
    assignment_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    complaint_id       INT NOT NULL,
    technician_id      INT NOT NULL,
    assigned_by        INT NOT NULL,
    assigned_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at         TIMESTAMP,
    completed_at       TIMESTAMP,
    assignment_status  VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED',

    CONSTRAINT chk_assign_status CHECK (assignment_status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS',
                                                              'COMPLETED','CANCELLED','REASSIGNED')),
    CONSTRAINT fk_assign_complaint FOREIGN KEY (complaint_id)
        REFERENCES complaints(complaint_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_assign_technician FOREIGN KEY (technician_id)
        REFERENCES technicians(technician_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_assign_assigned_by FOREIGN KEY (assigned_by)
        REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 1.11 work_logs -------------------------------------------------------
CREATE TABLE work_logs (
    work_log_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    assignment_id     INT NOT NULL,
    technician_id     INT NOT NULL,
    work_description  TEXT NOT NULL,
    work_date         DATE NOT NULL DEFAULT CURRENT_DATE,
    hours_worked      NUMERIC(5,2) NOT NULL,

    CONSTRAINT chk_worklog_hours CHECK (hours_worked >= 0),
    CONSTRAINT fk_worklog_assignment FOREIGN KEY (assignment_id)
        REFERENCES complaint_assignments(assignment_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_worklog_technician FOREIGN KEY (technician_id)
        REFERENCES technicians(technician_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 1.12 inventory_items -------------------------------------------------
CREATE TABLE inventory_items (
    item_id             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    item_code           VARCHAR(30)  NOT NULL UNIQUE,
    item_name           VARCHAR(100) NOT NULL,
    quantity_available  INT NOT NULL DEFAULT 0,
    unit_cost           NUMERIC(10,2) NOT NULL DEFAULT 0.00,

    CONSTRAINT chk_inventory_qty  CHECK (quantity_available >= 0),
    CONSTRAINT chk_inventory_cost CHECK (unit_cost >= 0)
);

-- 1.13 complaint_materials ---------------------------------------------
CREATE TABLE complaint_materials (
    complaint_material_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    complaint_id           INT NOT NULL,
    item_id                INT NOT NULL,
    technician_id          INT NOT NULL,
    quantity_used          INT NOT NULL,
    unit_cost              NUMERIC(10,2) NOT NULL,
    total_cost             NUMERIC(12,2) GENERATED ALWAYS AS (quantity_used * unit_cost) STORED,

    CONSTRAINT chk_materials_qty  CHECK (quantity_used > 0),
    CONSTRAINT chk_materials_cost CHECK (unit_cost >= 0),
    CONSTRAINT fk_materials_complaint FOREIGN KEY (complaint_id)
        REFERENCES complaints(complaint_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_materials_item FOREIGN KEY (item_id)
        REFERENCES inventory_items(item_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_materials_technician FOREIGN KEY (technician_id)
        REFERENCES technicians(technician_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 1.14 feedback --------------------------------------------------------
CREATE TABLE feedback (
    feedback_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    complaint_id   INT NOT NULL UNIQUE,                  -- at most one feedback per complaint
    user_id        INT NOT NULL,
    technician_id  INT NOT NULL,
    rating         INT NOT NULL,
    comments       TEXT,
    submitted_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_feedback_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT fk_feedback_complaint FOREIGN KEY (complaint_id)
        REFERENCES complaints(complaint_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_feedback_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_feedback_technician FOREIGN KEY (technician_id)
        REFERENCES technicians(technician_id) ON DELETE RESTRICT ON UPDATE CASCADE
);


-- =====================================================================
-- 2. INDEXES
-- =====================================================================
CREATE INDEX idx_complaints_status       ON complaints(status);
CREATE INDEX idx_complaints_priority     ON complaints(priority);
CREATE INDEX idx_complaints_category     ON complaints(category_id);
CREATE INDEX idx_complaints_building     ON complaints(building_id);
CREATE INDEX idx_complaints_reporter     ON complaints(reported_by);
CREATE INDEX idx_complaints_reported_at  ON complaints(reported_at);
-- partial index: only the "still open" complaints (the ones dashboards read)
CREATE INDEX idx_complaints_open_by_priority
    ON complaints(priority, expected_resolution_at)
    WHERE status NOT IN ('RESOLVED','CLOSED','REJECTED');

CREATE INDEX idx_assignments_technician  ON complaint_assignments(technician_id);
CREATE INDEX idx_assignments_complaint   ON complaint_assignments(complaint_id);
CREATE INDEX idx_technicians_team        ON technicians(team_id);
CREATE INDEX idx_history_complaint       ON complaint_status_history(complaint_id, changed_at);
CREATE INDEX idx_materials_complaint     ON complaint_materials(complaint_id);
CREATE INDEX idx_worklogs_assignment     ON work_logs(assignment_id);
CREATE INDEX idx_feedback_technician     ON feedback(technician_id);
-- users.email, inventory_items.item_code, buildings.building_code ... are already
-- indexed automatically by their UNIQUE constraints.


-- =====================================================================
-- 3. FUNCTIONS
-- =====================================================================

-- 3.1 who is performing the current action?  (the backend sets this per request)
--     SELECT set_config('app.current_user_id', '12', true);
CREATE OR REPLACE FUNCTION fn_current_actor() RETURNS INT
LANGUAGE sql STABLE AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::INT;
$$;

-- 3.2 number of active tasks of a technician
CREATE OR REPLACE FUNCTION fn_technician_workload(p_technician_id INT) RETURNS INT
LANGUAGE sql STABLE AS $$
    SELECT COUNT(*)::INT
    FROM complaint_assignments
    WHERE technician_id = p_technician_id
      AND assignment_status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS');
$$;

-- 3.3 total material cost of a complaint
CREATE OR REPLACE FUNCTION fn_complaint_material_cost(p_complaint_id INT) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(SUM(total_cost), 0) FROM complaint_materials WHERE complaint_id = p_complaint_id;
$$;

-- 3.4 smart technician assignment (category <-> specialization, lowest workload first)
CREATE OR REPLACE FUNCTION assign_technician_to_complaint(p_complaint_id INT, p_assigned_by INT)
RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    v_category  VARCHAR(100);
    v_tech_id   INT;
BEGIN
    SELECT cat.category_name INTO v_category
    FROM complaints c
    JOIN complaint_categories cat ON cat.category_id = c.category_id
    WHERE c.complaint_id = p_complaint_id
    FOR UPDATE OF c;                                    -- lock the complaint row

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint % does not exist', p_complaint_id;
    END IF;

    SELECT t.technician_id INTO v_tech_id
    FROM technicians t
    JOIN users u ON u.user_id = t.user_id
    WHERE t.specialization = v_category
      AND t.availability_status IN ('AVAILABLE','BUSY')
      AND u.status = 'ACTIVE'
    ORDER BY fn_technician_workload(t.technician_id), t.experience_years DESC, t.technician_id
    LIMIT 1;

    IF v_tech_id IS NULL THEN
        RAISE EXCEPTION 'No available technician with specialization "%"', v_category;
    END IF;

    INSERT INTO complaint_assignments (complaint_id, technician_id, assigned_by)
    VALUES (p_complaint_id, v_tech_id, p_assigned_by);

    RETURN v_tech_id;
END $$;

-- 3.5 "scheduled event" 1 : escalate overdue complaints (priority up, deadline re-set)
CREATE OR REPLACE FUNCTION fn_escalate_overdue_complaints() RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    v_count INT;
BEGIN
    WITH overdue AS (
        SELECT c.complaint_id, cat.expected_resolution_hours AS hrs
        FROM complaints c
        JOIN complaint_categories cat ON cat.category_id = c.category_id
        WHERE c.status IN ('SUBMITTED','UNDER_REVIEW','ASSIGNED','IN_PROGRESS')
          AND c.expected_resolution_at < CURRENT_TIMESTAMP
    ),
    bumped AS (
        UPDATE complaints c
        SET priority = CASE c.priority WHEN 'LOW' THEN 'MEDIUM'
                                       WHEN 'MEDIUM' THEN 'HIGH'
                                       ELSE 'CRITICAL' END,
            expected_resolution_at = CURRENT_TIMESTAMP + make_interval(hours => GREATEST(o.hrs / 2, 1))
        FROM overdue o
        WHERE c.complaint_id = o.complaint_id
        RETURNING c.complaint_id
    )
    SELECT COUNT(*) INTO v_count FROM bumped;
    RETURN v_count;
END $$;

-- 3.6 "scheduled event" 2 : auto-close complaints resolved more than N days ago
CREATE OR REPLACE FUNCTION fn_auto_close_resolved(p_days INT DEFAULT 7) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE
    v_count INT;
BEGIN
    WITH closed AS (
        UPDATE complaints
        SET status = 'CLOSED'
        WHERE status = 'RESOLVED'
          AND resolved_at < CURRENT_TIMESTAMP - make_interval(days => p_days)
        RETURNING complaint_id
    )
    SELECT COUNT(*) INTO v_count FROM closed;
    RETURN v_count;
END $$;

-- Scheduling (PostgreSQL has no EVENT scheduler like MySQL; use pg_cron or the backend):
--   CREATE EXTENSION pg_cron;
--   SELECT cron.schedule('escalate-overdue', '*/15 * * * *', 'SELECT fn_escalate_overdue_complaints()');
--   SELECT cron.schedule('auto-close',       '0 2 * * *',    'SELECT fn_auto_close_resolved(7)');
-- Without pg_cron: a Next.js cron route simply runs the same two SELECT statements.


-- =====================================================================
-- 4. STORED PROCEDURES  (called with CALL)
-- =====================================================================

-- 4.1 record material usage: validations + stock deduction (trigger 5.8) in ONE transaction
CREATE OR REPLACE PROCEDURE sp_record_material_usage(
    p_complaint_id INT, p_item_id INT, p_technician_id INT, p_quantity INT)
LANGUAGE plpgsql AS $$
DECLARE
    v_status VARCHAR(30);
BEGIN
    SELECT status INTO v_status FROM complaints WHERE complaint_id = p_complaint_id;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Complaint % does not exist', p_complaint_id;
    ELSIF v_status NOT IN ('ASSIGNED','IN_PROGRESS','ON_HOLD') THEN
        RAISE EXCEPTION 'Materials can only be added to active complaints (current status: %)', v_status;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM complaint_assignments
                   WHERE complaint_id = p_complaint_id AND technician_id = p_technician_id) THEN
        RAISE EXCEPTION 'Technician % is not assigned to complaint %', p_technician_id, p_complaint_id;
    END IF;

    -- unit_cost = NULL  ->  trigger copies the current price from inventory_items
    INSERT INTO complaint_materials (complaint_id, item_id, technician_id, quantity_used, unit_cost)
    VALUES (p_complaint_id, p_item_id, p_technician_id, p_quantity, NULL);
END $$;

-- 4.2 submit feedback: technician is taken from the completed assignment
CREATE OR REPLACE PROCEDURE sp_submit_feedback(
    p_complaint_id INT, p_user_id INT, p_rating INT, p_comments TEXT DEFAULT NULL)
LANGUAGE plpgsql AS $$
DECLARE
    v_tech_id INT;
BEGIN
    SELECT technician_id INTO v_tech_id
    FROM complaint_assignments
    WHERE complaint_id = p_complaint_id AND assignment_status = 'COMPLETED'
    ORDER BY completed_at DESC
    LIMIT 1;

    IF v_tech_id IS NULL THEN
        RAISE EXCEPTION 'Complaint % has no completed assignment yet', p_complaint_id;
    END IF;

    INSERT INTO feedback (complaint_id, user_id, technician_id, rating, comments)
    VALUES (p_complaint_id, p_user_id, v_tech_id, p_rating, p_comments);
END $$;


-- =====================================================================
-- 5. TRIGGERS
--    (trigger functions are SECURITY DEFINER so they work for every app role)
-- =====================================================================

-- 5.1 COMPLAINTS  BEFORE INSERT : defaults + validation ----------------
CREATE OR REPLACE FUNCTION trg_complaint_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_cat            complaint_categories%ROWTYPE;
    v_user_status    VARCHAR(20);
    v_room_building  INT;
BEGIN
    SELECT * INTO v_cat FROM complaint_categories WHERE category_id = NEW.category_id;

    SELECT status INTO v_user_status FROM users WHERE user_id = NEW.reported_by;
    IF v_user_status IS DISTINCT FROM 'ACTIVE' THEN
        RAISE EXCEPTION 'Only ACTIVE users can report complaints (user %)', NEW.reported_by;
    END IF;

    IF NEW.room_id IS NOT NULL THEN
        SELECT building_id INTO v_room_building FROM rooms WHERE room_id = NEW.room_id;
        IF v_room_building IS DISTINCT FROM NEW.building_id THEN
            RAISE EXCEPTION 'Room % does not belong to building %', NEW.room_id, NEW.building_id;
        END IF;
    END IF;

    IF NEW.status <> 'SUBMITTED' THEN
        RAISE EXCEPTION 'A new complaint must start with status SUBMITTED';
    END IF;

    NEW.priority := COALESCE(NEW.priority, v_cat.default_priority);
    NEW.expected_resolution_at := COALESCE(NEW.expected_resolution_at,
            NEW.reported_at + make_interval(hours => v_cat.expected_resolution_hours));
    RETURN NEW;
END $$;

CREATE TRIGGER trg_complaints_bi
BEFORE INSERT ON complaints
FOR EACH ROW EXECUTE FUNCTION trg_complaint_before_insert();

-- 5.2 COMPLAINTS  BEFORE UPDATE : legal status flow + resolved_at ------
CREATE OR REPLACE FUNCTION trg_complaint_before_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT (
            (OLD.status = 'SUBMITTED'    AND NEW.status IN ('UNDER_REVIEW','ASSIGNED','REJECTED')) OR
            (OLD.status = 'UNDER_REVIEW' AND NEW.status IN ('ASSIGNED','ON_HOLD','REJECTED'))       OR
            (OLD.status = 'ASSIGNED'     AND NEW.status IN ('IN_PROGRESS','ON_HOLD','UNDER_REVIEW')) OR
            (OLD.status = 'IN_PROGRESS'  AND NEW.status IN ('ON_HOLD','RESOLVED'))                  OR
            (OLD.status = 'ON_HOLD'      AND NEW.status IN ('UNDER_REVIEW','ASSIGNED','IN_PROGRESS')) OR
            (OLD.status = 'RESOLVED'     AND NEW.status IN ('CLOSED','IN_PROGRESS'))
        ) THEN
            RAISE EXCEPTION 'Illegal status change for complaint %: % -> %',
                            OLD.complaint_id, OLD.status, NEW.status;
        END IF;

        IF NEW.status = 'RESOLVED' THEN
            NEW.resolved_at := COALESCE(NEW.resolved_at, CURRENT_TIMESTAMP);
        ELSIF OLD.status = 'RESOLVED' AND NEW.status = 'IN_PROGRESS' THEN
            NEW.resolved_at := NULL;                    -- complaint re-opened
        END IF;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_complaints_bu
BEFORE UPDATE ON complaints
FOR EACH ROW EXECUTE FUNCTION trg_complaint_before_update();

-- 5.3 COMPLAINTS  AFTER INSERT / UPDATE OF status : audit trail --------
CREATE OR REPLACE FUNCTION trg_complaint_log_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO complaint_status_history (complaint_id, changed_by, old_status, new_status)
        VALUES (NEW.complaint_id, COALESCE(fn_current_actor(), NEW.reported_by), NULL, NEW.status);

    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO complaint_status_history (complaint_id, changed_by, old_status, new_status)
        VALUES (NEW.complaint_id,
                COALESCE(fn_current_actor(),
                         (SELECT user_id FROM users WHERE role = 'ADMIN' ORDER BY user_id LIMIT 1),
                         NEW.reported_by),
                OLD.status, NEW.status);
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_complaints_log
AFTER INSERT OR UPDATE OF status ON complaints
FOR EACH ROW EXECUTE FUNCTION trg_complaint_log_status();

-- 5.4 HISTORY is an audit log : rows can never be edited ---------------
CREATE OR REPLACE FUNCTION trg_history_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'complaint_status_history is an audit log and cannot be modified';
END $$;

CREATE TRIGGER trg_history_no_update
BEFORE UPDATE ON complaint_status_history
FOR EACH ROW EXECUTE FUNCTION trg_history_immutable();

-- 5.5 ROLE INTEGRITY : managers must be managers, technicians must be technicians
CREATE OR REPLACE FUNCTION trg_validate_team_manager() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.manager_id IS NOT NULL AND
       NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.manager_id
                   AND role IN ('MAINTENANCE_MANAGER','ADMIN')) THEN
        RAISE EXCEPTION 'User % is not a maintenance manager / admin', NEW.manager_id;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_teams_manager_role
BEFORE INSERT OR UPDATE OF manager_id ON maintenance_teams
FOR EACH ROW EXECUTE FUNCTION trg_validate_team_manager();

CREATE OR REPLACE FUNCTION trg_validate_technician_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.user_id AND role = 'TECHNICIAN') THEN
        RAISE EXCEPTION 'User % does not have the TECHNICIAN role', NEW.user_id;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_technicians_user_role
BEFORE INSERT OR UPDATE OF user_id ON technicians
FOR EACH ROW EXECUTE FUNCTION trg_validate_technician_user();

-- 5.6 ASSIGNMENTS  BEFORE INSERT : validation --------------------------
CREATE OR REPLACE FUNCTION trg_assignment_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_complaint_status VARCHAR(30);
    v_availability     VARCHAR(30);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = NEW.assigned_by
                   AND role IN ('MAINTENANCE_MANAGER','ADMIN')) THEN
        RAISE EXCEPTION 'Only a maintenance manager or admin can assign complaints';
    END IF;

    SELECT status INTO v_complaint_status FROM complaints WHERE complaint_id = NEW.complaint_id;
    IF v_complaint_status IN ('RESOLVED','CLOSED','REJECTED') THEN
        RAISE EXCEPTION 'Complaint % is already % and cannot be assigned', NEW.complaint_id, v_complaint_status;
    END IF;

    SELECT availability_status INTO v_availability FROM technicians WHERE technician_id = NEW.technician_id;
    IF v_availability IN ('OFF_DUTY','ON_LEAVE') THEN
        RAISE EXCEPTION 'Technician % is currently %', NEW.technician_id, v_availability;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_assignments_bi
BEFORE INSERT ON complaint_assignments
FOR EACH ROW EXECUTE FUNCTION trg_assignment_before_insert();

-- 5.7 ASSIGNMENTS : keep complaint + technician in sync -----------------
-- (a) after a new assignment: old active ones become REASSIGNED, complaint -> ASSIGNED, technician -> BUSY
CREATE OR REPLACE FUNCTION trg_assignment_after_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM set_config('app.current_user_id', NEW.assigned_by::text, true);   -- the assigner is the actor

    UPDATE complaint_assignments
    SET assignment_status = 'REASSIGNED'
    WHERE complaint_id = NEW.complaint_id
      AND assignment_id <> NEW.assignment_id
      AND assignment_status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS');

    UPDATE complaints
    SET status = 'ASSIGNED'
    WHERE complaint_id = NEW.complaint_id
      AND status IN ('SUBMITTED','UNDER_REVIEW','ON_HOLD');

    UPDATE technicians
    SET availability_status = 'BUSY'
    WHERE technician_id = NEW.technician_id AND availability_status = 'AVAILABLE';
    RETURN NULL;
END $$;

CREATE TRIGGER trg_assignments_ai
AFTER INSERT ON complaint_assignments
FOR EACH ROW EXECUTE FUNCTION trg_assignment_after_insert();

-- (b) BEFORE status change: stamp started_at / completed_at, block changes of finished rows
CREATE OR REPLACE FUNCTION trg_assignment_before_status() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.assignment_status IN ('COMPLETED','CANCELLED','REASSIGNED') THEN
        RAISE EXCEPTION 'Assignment % is already % and cannot change', OLD.assignment_id, OLD.assignment_status;
    END IF;
    IF NEW.assignment_status = 'IN_PROGRESS' AND NEW.started_at IS NULL THEN
        NEW.started_at := CURRENT_TIMESTAMP;
    ELSIF NEW.assignment_status = 'COMPLETED' THEN
        NEW.started_at   := COALESCE(NEW.started_at, CURRENT_TIMESTAMP);
        NEW.completed_at := COALESCE(NEW.completed_at, CURRENT_TIMESTAMP);
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_assignments_bu
BEFORE UPDATE OF assignment_status ON complaint_assignments
FOR EACH ROW WHEN (OLD.assignment_status IS DISTINCT FROM NEW.assignment_status)
EXECUTE FUNCTION trg_assignment_before_status();

-- (c) AFTER status change: move the complaint forward, free the technician
CREATE OR REPLACE FUNCTION trg_assignment_after_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.assignment_status = 'IN_PROGRESS' THEN
        UPDATE complaints SET status = 'IN_PROGRESS'
        WHERE complaint_id = NEW.complaint_id AND status IN ('ASSIGNED','ON_HOLD');

    ELSIF NEW.assignment_status = 'COMPLETED' THEN
        UPDATE complaints SET status = 'IN_PROGRESS'
        WHERE complaint_id = NEW.complaint_id AND status = 'ASSIGNED';
        UPDATE complaints SET status = 'RESOLVED'
        WHERE complaint_id = NEW.complaint_id AND status = 'IN_PROGRESS';
    END IF;

    IF NEW.assignment_status IN ('COMPLETED','CANCELLED','REASSIGNED') THEN
        UPDATE technicians t
        SET availability_status = 'AVAILABLE'
        WHERE t.technician_id = NEW.technician_id
          AND t.availability_status = 'BUSY'
          AND fn_technician_workload(t.technician_id) = 0;
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER trg_assignments_au
AFTER UPDATE OF assignment_status ON complaint_assignments
FOR EACH ROW WHEN (OLD.assignment_status IS DISTINCT FROM NEW.assignment_status)
EXECUTE FUNCTION trg_assignment_after_status();

-- 5.8 INVENTORY : check stock + deduct (row is locked, so two users cannot overdraw)
CREATE OR REPLACE FUNCTION trg_material_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_stock INT;
    v_cost  NUMERIC(10,2);
BEGIN
    SELECT quantity_available, unit_cost INTO v_stock, v_cost
    FROM inventory_items WHERE item_id = NEW.item_id
    FOR UPDATE;                                          -- row lock

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory item % does not exist', NEW.item_id;
    END IF;
    IF v_stock < NEW.quantity_used THEN
        RAISE EXCEPTION 'Insufficient stock for item %: requested %, available %',
                        NEW.item_id, NEW.quantity_used, v_stock;
    END IF;

    UPDATE inventory_items
    SET quantity_available = quantity_available - NEW.quantity_used
    WHERE item_id = NEW.item_id;

    NEW.unit_cost := COALESCE(NEW.unit_cost, v_cost);    -- price snapshot
    RETURN NEW;
END $$;

CREATE TRIGGER trg_materials_bi
BEFORE INSERT ON complaint_materials
FOR EACH ROW EXECUTE FUNCTION trg_material_before_insert();

-- give the stock back when a usage record is removed
CREATE OR REPLACE FUNCTION trg_material_before_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE inventory_items
    SET quantity_available = quantity_available + OLD.quantity_used
    WHERE item_id = OLD.item_id;
    RETURN OLD;
END $$;

CREATE TRIGGER trg_materials_bd
BEFORE DELETE ON complaint_materials
FOR EACH ROW EXECUTE FUNCTION trg_material_before_delete();

-- usage records are not edited: delete and re-insert so that stock stays correct
CREATE OR REPLACE FUNCTION trg_material_block_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Material usage cannot be edited; delete the record and add a new one';
END $$;

CREATE TRIGGER trg_materials_bu
BEFORE UPDATE OF item_id, quantity_used ON complaint_materials
FOR EACH ROW EXECUTE FUNCTION trg_material_block_update();

-- 5.9 FEEDBACK : only the reporter, only after resolution, only for the assigned technician
CREATE OR REPLACE FUNCTION trg_feedback_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_status    VARCHAR(30);
    v_reporter  INT;
BEGIN
    SELECT status, reported_by INTO v_status, v_reporter
    FROM complaints WHERE complaint_id = NEW.complaint_id;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Complaint % does not exist', NEW.complaint_id;
    END IF;
    IF v_status NOT IN ('RESOLVED','CLOSED') THEN
        RAISE EXCEPTION 'Feedback allowed only for RESOLVED/CLOSED complaints (current: %)', v_status;
    END IF;
    IF v_reporter <> NEW.user_id THEN
        RAISE EXCEPTION 'Only the user who reported the complaint can give feedback';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM complaint_assignments
                   WHERE complaint_id = NEW.complaint_id AND technician_id = NEW.technician_id) THEN
        RAISE EXCEPTION 'Technician % never worked on complaint %', NEW.technician_id, NEW.complaint_id;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_feedback_bi
BEFORE INSERT ON feedback
FOR EACH ROW EXECUTE FUNCTION trg_feedback_before_insert();


-- =====================================================================
-- 6. VIEWS
-- =====================================================================

-- 6.1 live dashboard of open complaints (manager screen)
CREATE OR REPLACE VIEW v_active_complaint_dashboard AS
SELECT  c.complaint_id,
        c.title,
        cat.category_name,
        b.building_name,
        r.room_number,
        c.priority,
        c.status,
        tu.name                    AS assigned_technician,
        c.reported_at,
        c.expected_resolution_at,
        CASE WHEN c.expected_resolution_at < CURRENT_TIMESTAMP
             THEN 'OVERDUE' ELSE 'ON_TRACK' END                         AS escalation_status,
        GREATEST(ROUND((EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - c.expected_resolution_at)) / 3600)::numeric, 1), 0)
                                   AS hours_overdue
FROM complaints c
JOIN complaint_categories cat ON cat.category_id = c.category_id
JOIN buildings b              ON b.building_id   = c.building_id
LEFT JOIN rooms r             ON r.room_id       = c.room_id
LEFT JOIN LATERAL (
        SELECT a.technician_id
        FROM complaint_assignments a
        WHERE a.complaint_id = c.complaint_id
          AND a.assignment_status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS')
        ORDER BY a.assigned_at DESC
        LIMIT 1
) act ON TRUE
LEFT JOIN technicians t ON t.technician_id = act.technician_id
LEFT JOIN users tu      ON tu.user_id      = t.user_id
WHERE c.status NOT IN ('RESOLVED','CLOSED','REJECTED');

-- 6.2 technician scorecard
CREATE OR REPLACE VIEW v_technician_performance AS
SELECT  t.technician_id,
        u.name                AS technician_name,
        t.employee_code,
        t.specialization,
        mt.team_name,
        t.availability_status,
        fn_technician_workload(t.technician_id)                                   AS active_tasks,
        (SELECT COUNT(*) FROM complaint_assignments a
          WHERE a.technician_id = t.technician_id
            AND a.assignment_status = 'COMPLETED')                                AS completed_tasks,
        (SELECT COALESCE(SUM(w.hours_worked), 0) FROM work_logs w
          WHERE w.technician_id = t.technician_id)                                AS total_hours,
        (SELECT ROUND(AVG(f.rating), 2) FROM feedback f
          WHERE f.technician_id = t.technician_id)                                AS avg_rating
FROM technicians t
JOIN users u              ON u.user_id = t.user_id
JOIN maintenance_teams mt ON mt.team_id = t.team_id;

-- 6.3 cost per complaint (materials + labour hours)
CREATE OR REPLACE VIEW v_complaint_cost_summary AS
SELECT  c.complaint_id,
        c.title,
        c.status,
        COALESCE(m.items_used, 0)    AS items_used,
        COALESCE(m.material_cost, 0) AS material_cost,
        COALESCE(wl.labor_hours, 0)  AS labor_hours
FROM complaints c
LEFT JOIN (SELECT complaint_id, SUM(quantity_used) AS items_used, SUM(total_cost) AS material_cost
           FROM complaint_materials GROUP BY complaint_id) m  ON m.complaint_id  = c.complaint_id
LEFT JOIN (SELECT a.complaint_id, SUM(w.hours_worked) AS labor_hours
           FROM work_logs w JOIN complaint_assignments a ON a.assignment_id = w.assignment_id
           GROUP BY a.complaint_id) wl                        ON wl.complaint_id = c.complaint_id;

-- 6.4 building-wise statistics
CREATE OR REPLACE VIEW v_building_complaint_summary AS
SELECT  b.building_id,
        b.building_name,
        COUNT(c.complaint_id)                                                    AS total_complaints,
        COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('RESOLVED','CLOSED','REJECTED')) AS open_complaints,
        COUNT(c.complaint_id) FILTER (WHERE c.status IN ('RESOLVED','CLOSED'))   AS resolved_complaints,
        ROUND(AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.reported_at)) / 3600)::numeric, 1) AS avg_resolution_hours
FROM buildings b
LEFT JOIN complaints c ON c.building_id = b.building_id
GROUP BY b.building_id, b.building_name;

-- 6.5 MATERIALIZED VIEW : pre-computed monthly analytics (refresh when needed)
CREATE MATERIALIZED VIEW mv_category_monthly_stats AS
SELECT  date_trunc('month', c.reported_at)::date  AS month,
        cat.category_name,
        COUNT(*)                                               AS total_complaints,
        COUNT(*) FILTER (WHERE c.status IN ('RESOLVED','CLOSED')) AS resolved_complaints,
        ROUND(AVG(EXTRACT(EPOCH FROM (c.resolved_at - c.reported_at)) / 3600)::numeric, 1) AS avg_resolution_hours
FROM complaints c
JOIN complaint_categories cat ON cat.category_id = c.category_id
GROUP BY 1, 2;

CREATE UNIQUE INDEX idx_mv_category_monthly ON mv_category_monthly_stats(month, category_name);
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_monthly_stats;


-- =====================================================================
-- 7. DATABASE ROLES & PRIVILEGES  (one group role per kind of app user)
-- =====================================================================
DO $$
DECLARE r TEXT;
BEGIN
    FOREACH r IN ARRAY ARRAY['app_admin','app_manager','app_technician','app_user'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN', r);
        END IF;
    END LOOP;
END $$;

-- admin : everything
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_admin;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO app_admin;

-- maintenance manager : read everything, manage complaints / assignments / teams / stock
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_manager;
GRANT SELECT ON mv_category_monthly_stats TO app_manager;
GRANT INSERT, UPDATE ON complaints, complaint_assignments, technicians, maintenance_teams, inventory_items TO app_manager;
GRANT EXECUTE ON FUNCTION assign_technician_to_complaint(INT, INT), fn_escalate_overdue_complaints(),
                          fn_auto_close_resolved(INT), fn_technician_workload(INT),
                          fn_complaint_material_cost(INT) TO app_manager;

-- technician : see work, update own assignment, write logs and materials
GRANT SELECT ON complaints, complaint_categories, buildings, rooms, complaint_assignments, technicians,
                work_logs, complaint_materials, inventory_items, complaint_status_history,
                v_active_complaint_dashboard TO app_technician;
GRANT UPDATE (assignment_status) ON complaint_assignments TO app_technician;
GRANT INSERT ON work_logs, complaint_materials TO app_technician;
GRANT EXECUTE ON PROCEDURE sp_record_material_usage(INT, INT, INT, INT) TO app_technician;

-- student / faculty : report complaints, follow them, give feedback
GRANT SELECT ON complaint_categories, buildings, rooms, complaints,
                complaint_status_history, feedback TO app_user;
GRANT INSERT ON complaints, feedback TO app_user;
GRANT EXECUTE ON PROCEDURE sp_submit_feedback(INT, INT, INT, TEXT) TO app_user;

-- =====================================================================
--  END OF FILE 1  ->  now run 02_seed_data.sql
-- =====================================================================
