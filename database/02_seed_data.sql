-- =====================================================================
--  FILE 2 of 4 : SAMPLE DATA
--  Run after 01_schema.sql.  Safe to re-run (tables are emptied first).
--
--  Reference data is inserted directly.  Complaints are then pushed through
--  their real life-cycle (assign -> start -> materials -> complete -> close
--  -> feedback) using the functions / procedures / triggers from file 1,
--  so status history, stock levels and technician availability fill in by
--  themselves.
-- =====================================================================

TRUNCATE feedback, complaint_materials, inventory_items, work_logs, complaint_assignments,
         technicians, maintenance_teams, complaint_status_history, complaints,
         complaint_categories, rooms, buildings, users, departments
RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------
-- 1. DEPARTMENTS (5)
-- ---------------------------------------------------------------------
INSERT INTO departments (department_name, department_code, department_type) VALUES
 ('Computer Science and Engineering',  'CSE', 'ACADEMIC'),
 ('Electronics and Communication',     'ECE', 'ACADEMIC'),
 ('Mechanical Engineering',            'ME',  'ACADEMIC'),
 ('Estate and Maintenance',            'EST', 'ADMINISTRATIVE'),
 ('IT Services',                       'ITS', 'ADMINISTRATIVE');

-- ---------------------------------------------------------------------
-- 2. USERS (18)  ids: 1 admin | 2-3 managers | 4-11 technicians | 12-15 students
--                     16-17 faculty | 18 inactive student
-- ---------------------------------------------------------------------
INSERT INTO users (department_id, email, name, role, status) VALUES
 (4, 'meera.nair@campus.edu',     'Meera Nair',     'ADMIN',               'ACTIVE'),
 (4, 'suresh.kumar@campus.edu',   'Suresh Kumar',   'MAINTENANCE_MANAGER', 'ACTIVE'),
 (5, 'anita.desai@campus.edu',    'Anita Desai',    'MAINTENANCE_MANAGER', 'ACTIVE'),
 (4, 'ravi.shankar@campus.edu',   'Ravi Shankar',   'TECHNICIAN',          'ACTIVE'),
 (4, 'imran.khan@campus.edu',     'Imran Khan',     'TECHNICIAN',          'ACTIVE'),
 (5, 'lakshmi.rao@campus.edu',    'Lakshmi Rao',    'TECHNICIAN',          'ACTIVE'),
 (4, 'john.mathew@campus.edu',    'John Mathew',    'TECHNICIAN',          'ACTIVE'),
 (4, 'kiran.patil@campus.edu',    'Kiran Patil',    'TECHNICIAN',          'ACTIVE'),
 (4, 'farhan.ali@campus.edu',     'Farhan Ali',     'TECHNICIAN',          'ACTIVE'),
 (4, 'pooja.singh@campus.edu',    'Pooja Singh',    'TECHNICIAN',          'ACTIVE'),
 (5, 'vikram.rao@campus.edu',     'Vikram Rao',     'TECHNICIAN',          'ACTIVE'),
 (1, 'aarav.sharma@campus.edu',   'Aarav Sharma',   'STUDENT',             'ACTIVE'),
 (2, 'diya.menon@campus.edu',     'Diya Menon',     'STUDENT',             'ACTIVE'),
 (3, 'rohan.gupta@campus.edu',    'Rohan Gupta',    'STUDENT',             'ACTIVE'),
 (1, 'sneha.reddy@campus.edu',    'Sneha Reddy',    'STUDENT',             'ACTIVE'),
 (1, 'kavita.joshi@campus.edu',   'Dr. Kavita Joshi','FACULTY',            'ACTIVE'),
 (3, 'arun.verma@campus.edu',     'Prof. Arun Verma','FACULTY',            'ACTIVE'),
 (2, 'old.student@campus.edu',    'Neha Kapoor',    'STUDENT',             'INACTIVE');

-- ---------------------------------------------------------------------
-- 3. BUILDINGS (4) and ROOMS (8)
-- ---------------------------------------------------------------------
INSERT INTO buildings (building_name, building_code, building_type, number_of_floors) VALUES
 ('Academic Block A', 'ABA', 'ACADEMIC',       5),
 ('Central Library',  'LIB', 'LIBRARY',        3),
 ('Central Labs',     'LAB', 'LABORATORY',     4),
 ('Admin Block',      'ADM', 'ADMINISTRATIVE', 2);

INSERT INTO rooms (building_id, room_number, floor_number, room_type) VALUES
 (1, '101',  1, 'Classroom'),
 (1, '302',  3, 'Classroom'),
 (1, '305',  3, 'Seminar Hall'),
 (2, '201',  2, 'Reading Hall'),
 (2, 'G01',  0, 'Reading Hall'),
 (3, 'L401', 4, 'Computer Lab'),
 (3, 'L102', 1, 'Electronics Lab'),
 (4, '201',  2, 'Office');

-- ---------------------------------------------------------------------
-- 4. COMPLAINT CATEGORIES (7)  - names match technician specializations
-- ---------------------------------------------------------------------
INSERT INTO complaint_categories (category_name, default_priority, expected_resolution_hours) VALUES
 ('Electrical',   'HIGH',     24),
 ('Plumbing',     'HIGH',     24),
 ('IT & Network', 'MEDIUM',   48),
 ('Carpentry',    'LOW',      72),
 ('Housekeeping', 'LOW',      48),
 ('Civil',        'CRITICAL',  8),
 ('AV Equipment', 'MEDIUM',   36);

-- ---------------------------------------------------------------------
-- 5. MAINTENANCE TEAMS (4) and TECHNICIANS (8)
-- ---------------------------------------------------------------------
INSERT INTO maintenance_teams (manager_id, team_name, specialization, status) VALUES
 (2, 'Electrical Team',              'Electrical',   'ACTIVE'),
 (2, 'Plumbing and Civil Team',      'Plumbing',     'ACTIVE'),
 (3, 'IT Support Team',              'IT & Network', 'ACTIVE'),
 (2, 'Carpentry and Housekeeping',   'Carpentry',    'ACTIVE');

INSERT INTO technicians (user_id, team_id, employee_code, specialization, availability_status, experience_years) VALUES
 (4,  1, 'TECH-001', 'Electrical',   'AVAILABLE', 8),
 (5,  2, 'TECH-002', 'Plumbing',     'AVAILABLE', 6),
 (6,  3, 'TECH-003', 'IT & Network', 'AVAILABLE', 4),
 (7,  4, 'TECH-004', 'Carpentry',    'AVAILABLE', 10),
 (8,  1, 'TECH-005', 'Electrical',   'AVAILABLE', 3),
 (9,  2, 'TECH-006', 'Civil',        'AVAILABLE', 7),
 (10, 4, 'TECH-007', 'Housekeeping', 'AVAILABLE', 2),
 (11, 3, 'TECH-008', 'AV Equipment', 'AVAILABLE', 5);

-- ---------------------------------------------------------------------
-- 6. INVENTORY (8)
-- ---------------------------------------------------------------------
INSERT INTO inventory_items (item_code, item_name, quantity_available, unit_cost) VALUES
 ('ELE-LED-18W',  'LED Tube Light 18W',      50,  180.00),
 ('ELE-MCB-16A',  'MCB 16A Switch',          20,  320.00),
 ('PLB-PVC-1IN',  'PVC Pipe 1 inch (metre)', 100,  95.00),
 ('PLB-TAP-STD',  'Water Tap Standard',      15,  450.00),
 ('NET-CAT6-M',   'CAT6 Cable (metre)',      300,  22.00),
 ('AV-PROJ-LAMP', 'Projector Lamp',          5,  6500.00),
 ('CAR-HINGE',    'Door Hinge Set',          30,  150.00),
 ('CLN-KIT',      'Cleaning Supply Kit',     40,  250.00);

-- ---------------------------------------------------------------------
-- 7. COMPLAINTS (13)  - always inserted as SUBMITTED, priority / deadline
--    are filled by the BEFORE INSERT trigger (priority NULL = category default)
-- ---------------------------------------------------------------------
INSERT INTO complaints (reported_by, category_id, building_id, room_id, title, description, priority, reported_at) VALUES
 (12, 1, 1, 2,    'Tube lights flickering in Room 302',        'Two tube lights keep flickering during lectures.',          NULL,       now() - interval '6 days'),
 (13, 2, 3, 7,    'Water leakage near Electronics Lab',        'Water is dripping from the ceiling onto lab benches.',      'CRITICAL', now() - interval '5 days'),
 (16, 7, 1, 3,    'Projector turns off randomly in Seminar Hall','Projector shuts down after about 10 minutes of use.',     NULL,       now() - interval '4 days'),
 (14, 3, 3, 6,    'Wi-Fi not working in Computer Lab',         'No network connectivity on the 4th floor lab since morning.',NULL,      now() - interval '3 days'),
 (15, 4, 1, 1,    'Broken bench in Classroom 101',             'Two benches in the front row are broken.',                  NULL,       now() - interval '1 day'),
 (17, 5, 2, 4,    'Reading hall needs deep cleaning',          'Floor and tables have not been cleaned for a week.',        NULL,       now() - interval '2 days'),
 (12, 6, 1, NULL, 'Crack in corridor wall near stairs',        'A visible crack has appeared in the 2nd floor corridor wall.','CRITICAL',now() - interval '10 hours'),
 (13, 1, 4, 8,    'Power socket not working in Office 201',    'All sockets on the east wall have no power.',               NULL,       now() - interval '30 hours'),
 (14, 2, 2, NULL, 'Washbasin tap leaking near library entrance','Tap drips continuously and wastes water.',                    NULL,       now() - interval '2 days'),
 (16, 3, 4, 8,    'Slow internet in admin office',             'Speed drops below 1 Mbps during working hours.',            NULL,       now() - interval '12 hours'),
 (15, 7, 3, 6,    'Computer lab projector not displaying',     'Projector powers on but shows no picture.',                 NULL,       now() - interval '4 days'),
 (12, 1, 2, 4,    'Fan regulator broken in reading hall',      'Regulator knob is loose and fans run at full speed.',       NULL,       now() - interval '20 hours'),
 (13, 5, 1, 1,    'Request to repaint classroom',              'Cosmetic request: repaint walls of Classroom 101.',         'LOW',      now() - interval '1 day');

-- ---------------------------------------------------------------------
-- 8. LIFE-CYCLE  (manager = user 2 / 3 acts first, technicians act later)
-- ---------------------------------------------------------------------
-- 8.1 manager assigns technicians  (smart assignment picks by category + workload)
SET app.current_user_id = '2';
SELECT assign_technician_to_complaint(1, 2);    -- Electrical  -> TECH-001 (most experienced)
SELECT assign_technician_to_complaint(8, 2);    -- Electrical  -> TECH-005 (TECH-001 is busy now)
SELECT assign_technician_to_complaint(2, 2);    -- Plumbing    -> TECH-002
SELECT assign_technician_to_complaint(9, 2);    -- Plumbing    -> TECH-002 (only plumber)
SELECT assign_technician_to_complaint(3, 2);    -- AV          -> TECH-008
SELECT assign_technician_to_complaint(11, 2);   -- AV          -> TECH-008
SET app.current_user_id = '3';
SELECT assign_technician_to_complaint(4, 3);    -- IT          -> TECH-003

-- manager review actions
SET app.current_user_id = '2';
UPDATE complaints SET status = 'UNDER_REVIEW' WHERE complaint_id IN (6, 12);
UPDATE complaints SET status = 'ON_HOLD'      WHERE complaint_id = 12;      -- waiting for a spare part
UPDATE complaints SET status = 'REJECTED'     WHERE complaint_id = 13;      -- cosmetic request

-- 8.2 technicians start work  (each update is done "as" that technician, so the audit log names them)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT a.assignment_id, t.user_id
             FROM complaint_assignments a JOIN technicians t ON t.technician_id = a.technician_id
             WHERE a.complaint_id IN (1, 2, 3, 9, 11) AND a.assignment_status = 'ASSIGNED'
    LOOP
        PERFORM set_config('app.current_user_id', r.user_id::text, true);
        UPDATE complaint_assignments SET assignment_status = 'IN_PROGRESS' WHERE assignment_id = r.assignment_id;
    END LOOP;
END $$;

-- 8.3 work logs
INSERT INTO work_logs (assignment_id, technician_id, work_description, work_date, hours_worked)
SELECT a.assignment_id, a.technician_id, w.descr, CURRENT_DATE - w.days_ago, w.hrs
FROM complaint_assignments a
JOIN (VALUES
        (1,  'Inspected fittings and replaced faulty tube lights', 5, 1.50),
        (2,  'Located leak in overhead pipe and sealed the joint', 4, 3.00),
        (2,  'Replaced damaged pipe section and tested pressure',  4, 2.50),
        (3,  'Opened projector, cleaned vents, tested thermal cut-off', 3, 2.00),
        (9,  'Replaced worn tap cartridge',                        1, 1.00),
        (11, 'Replaced projector lamp and recalibrated',           3, 1.75)
     ) AS w(cid, descr, days_ago, hrs) ON w.cid = a.complaint_id;

-- 8.4 materials used (procedure: validation + stock deduction in one transaction)
CALL sp_record_material_usage(1,  1, 1, 2);      -- 2 x LED tube
CALL sp_record_material_usage(2,  3, 2, 6);      -- 6 m PVC pipe
CALL sp_record_material_usage(2,  4, 2, 1);      -- 1 tap
CALL sp_record_material_usage(3,  6, 8, 1);      -- projector lamp (still being fixed)
CALL sp_record_material_usage(9,  4, 2, 1);      -- 1 tap
CALL sp_record_material_usage(11, 6, 8, 1);      -- projector lamp

-- 8.5 technicians finish  -> complaint becomes RESOLVED automatically
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT a.assignment_id, t.user_id
             FROM complaint_assignments a JOIN technicians t ON t.technician_id = a.technician_id
             WHERE a.complaint_id IN (1, 2, 9, 11) AND a.assignment_status = 'IN_PROGRESS'
    LOOP
        PERFORM set_config('app.current_user_id', r.user_id::text, true);
        UPDATE complaint_assignments SET assignment_status = 'COMPLETED' WHERE assignment_id = r.assignment_id;
    END LOOP;
END $$;

-- 8.6 manager closes the resolved complaints
SET app.current_user_id = '2';
UPDATE complaints SET status = 'CLOSED' WHERE complaint_id IN (1, 2, 9, 11);

-- 8.7 make the timestamps of finished work realistic (some within SLA, some breached)
UPDATE complaints SET resolved_at = reported_at + interval '20 hours' WHERE complaint_id = 1;    -- within 24h
UPDATE complaints SET resolved_at = reported_at + interval '30 hours' WHERE complaint_id = 2;    -- breached 24h
UPDATE complaints SET resolved_at = reported_at + interval '10 hours' WHERE complaint_id = 9;    -- within 24h
UPDATE complaints SET resolved_at = reported_at + interval '40 hours' WHERE complaint_id = 11;   -- breached 36h

UPDATE complaint_assignments a
SET assigned_at  = c.reported_at + interval '1 hour',
    started_at   = c.reported_at + interval '2 hours',
    completed_at = c.resolved_at - interval '30 minutes'
FROM complaints c
WHERE c.complaint_id = a.complaint_id AND c.status = 'CLOSED';

-- 8.8 feedback from the people who reported (technician is taken from the assignment)
CALL sp_submit_feedback(1,  12, 5, 'Fixed quickly and neatly.');
CALL sp_submit_feedback(2,  13, 4, 'Good work, but it took longer than expected.');
CALL sp_submit_feedback(9,  14, 4, 'Leak stopped. Thank you.');
CALL sp_submit_feedback(11, 15, 5, 'Projector works perfectly now.');

RESET app.current_user_id;
REFRESH MATERIALIZED VIEW mv_category_monthly_stats;

-- ---------------------------------------------------------------------
-- 9. QUICK CHECK  (row counts + complaint states)
-- ---------------------------------------------------------------------
SELECT 'departments' AS table_name, COUNT(*) AS rows FROM departments
UNION ALL SELECT 'users',                    COUNT(*) FROM users
UNION ALL SELECT 'buildings',                COUNT(*) FROM buildings
UNION ALL SELECT 'rooms',                    COUNT(*) FROM rooms
UNION ALL SELECT 'complaint_categories',     COUNT(*) FROM complaint_categories
UNION ALL SELECT 'complaints',               COUNT(*) FROM complaints
UNION ALL SELECT 'complaint_status_history', COUNT(*) FROM complaint_status_history
UNION ALL SELECT 'maintenance_teams',        COUNT(*) FROM maintenance_teams
UNION ALL SELECT 'technicians',              COUNT(*) FROM technicians
UNION ALL SELECT 'complaint_assignments',    COUNT(*) FROM complaint_assignments
UNION ALL SELECT 'work_logs',                COUNT(*) FROM work_logs
UNION ALL SELECT 'inventory_items',          COUNT(*) FROM inventory_items
UNION ALL SELECT 'complaint_materials',      COUNT(*) FROM complaint_materials
UNION ALL SELECT 'feedback',                 COUNT(*) FROM feedback;

SELECT status, COUNT(*) AS complaints FROM complaints GROUP BY status ORDER BY status;
