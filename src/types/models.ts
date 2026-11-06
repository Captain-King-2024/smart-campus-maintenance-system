export const roles = ['STUDENT', 'FACULTY', 'TECHNICIAN', 'MAINTENANCE_MANAGER', 'ADMIN'] as const;
export type Role = (typeof roles)[number];
export const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type Priority = (typeof priorities)[number];
export const statuses = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
] as const;
export type ComplaintStatus = (typeof statuses)[number];
export interface Department {
  department_id: number;
  department_name: string;
  department_code: string;
  department_type: string;
}
export interface User {
  user_id: number;
  department_id: number;
  email: string;
  name: string;
  role: Role;
  status: 'ACTIVE' | 'INACTIVE';
}
export interface Building {
  building_id: number;
  building_name: string;
  building_code: string;
  building_type: string;
  number_of_floors: number;
}
export interface Room {
  room_id: number;
  building_id: number;
  room_number: string;
  floor_number: number;
  room_type: string;
}
export interface ComplaintCategory {
  category_id: number;
  category_name: string;
  default_priority: Priority;
  expected_resolution_hours: number;
}
export interface Complaint {
  complaint_id: number;
  reported_by: number;
  category_id: number;
  building_id: number;
  room_id: number | null;
  title: string;
  description: string;
  priority: Priority;
  status: ComplaintStatus;
  reported_at: string;
  expected_resolution_at: string;
  resolved_at: string | null;
}
export interface ComplaintStatusHistory {
  history_id: number;
  complaint_id: number;
  changed_by: number;
  old_status: ComplaintStatus | null;
  new_status: ComplaintStatus;
  changed_at: string;
}
export interface MaintenanceTeam {
  team_id: number;
  manager_id: number;
  team_name: string;
  specialization: string;
  status: 'ACTIVE' | 'INACTIVE';
}
export interface Technician {
  technician_id: number;
  user_id: number;
  team_id: number;
  employee_code: string;
  specialization: string;
  availability_status: 'AVAILABLE' | 'BUSY' | 'OFF_DUTY';
  experience_years: number;
}
export interface ComplaintAssignment {
  assignment_id: number;
  complaint_id: number;
  technician_id: number;
  assigned_by: number;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  assignment_status:
    | 'ASSIGNED'
    | 'ACCEPTED'
    | 'IN_PROGRESS'
    | 'ON_HOLD'
    | 'COMPLETED'
    | 'CANCELLED';
}
export interface WorkLog {
  work_log_id: number;
  assignment_id: number;
  technician_id: number;
  work_description: string;
  work_date: string;
  hours_worked: number;
}
export interface InventoryItem {
  item_id: number;
  item_code: string;
  item_name: string;
  quantity_available: number;
  unit_cost: number;
}
export interface ComplaintMaterial {
  complaint_material_id: number;
  complaint_id: number;
  item_id: number;
  technician_id: number;
  quantity_used: number;
  unit_cost: number;
  total_cost: number;
}
export interface Feedback {
  feedback_id: number;
  complaint_id: number;
  user_id: number;
  technician_id: number;
  rating: number;
  comments: string;
  submitted_at: string;
}
export interface EntityMap {
  departments: Department;
  users: User;
  buildings: Building;
  rooms: Room;
  categories: ComplaintCategory;
  complaints: Complaint;
  history: ComplaintStatusHistory;
  teams: MaintenanceTeam;
  technicians: Technician;
  assignments: ComplaintAssignment;
  'work-logs': WorkLog;
  inventory: InventoryItem;
  materials: ComplaintMaterial;
  feedback: Feedback;
}
export type Entity = keyof EntityMap;
export type Row = EntityMap[Entity];
