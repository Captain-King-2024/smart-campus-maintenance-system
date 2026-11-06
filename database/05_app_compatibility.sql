-- Apply after 01_schema.sql and 02_seed_data.sql. Non-destructive, repeatable.
-- Original supplied SQL is kept unchanged; this migration aligns the app workflow.
BEGIN;
ALTER TABLE complaint_assignments DROP CONSTRAINT IF EXISTS chk_assign_status;
ALTER TABLE complaint_assignments ADD CONSTRAINT chk_assign_status
  CHECK (assignment_status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS','ON_HOLD','COMPLETED','CANCELLED','REASSIGNED'));
CREATE OR REPLACE FUNCTION fn_technician_workload(p_technician_id INT) RETURNS INT
LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::INT FROM complaint_assignments
  WHERE technician_id = p_technician_id
    AND assignment_status IN ('ASSIGNED','ACCEPTED','IN_PROGRESS','ON_HOLD');
$$;
CREATE OR REPLACE FUNCTION trg_assignment_after_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NEW.assignment_status = 'IN_PROGRESS' THEN
        UPDATE complaints SET status = 'IN_PROGRESS'
        WHERE complaint_id = NEW.complaint_id AND status IN ('ASSIGNED','ON_HOLD');

    ELSIF NEW.assignment_status = 'ON_HOLD' THEN
        UPDATE complaints SET status = 'ON_HOLD'
        WHERE complaint_id = NEW.complaint_id AND status = 'IN_PROGRESS';

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

-- The original role grant omits identity sequence privileges.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_admin;
COMMIT;
