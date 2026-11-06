import { z } from 'zod';
import { priorities, roles, statuses } from '@/types/models';
const id = z.number().int().positive();
const name = z.string().trim().min(1).max(160);
const text = z.string().trim().min(1).max(4000);
export const complaintInput = z
  .object({
    title: name,
    description: text,
    category_id: id,
    building_id: id,
    room_id: id.nullable().optional(),
    priority: z.enum(priorities),
  })
  .strict();
export const complaintPatch = z
  .object({ priority: z.enum(priorities).optional(), status: z.enum(statuses).optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Supply priority or status');
export const assignmentInput = z.object({ complaint_id: id, technician_id: id }).strict();
export const assignmentPatch = z
  .object({ action: z.enum(['accept', 'start', 'hold', 'complete']) })
  .strict();
export const workLogInput = z
  .object({
    assignment_id: id,
    work_description: text,
    hours_worked: z.number().positive().max(24),
  })
  .strict();
export const materialInput = z
  .object({ complaint_id: id, item_id: id, quantity_used: z.number().positive().max(100000) })
  .strict();
export const feedbackInput = z
  .object({
    complaint_id: id,
    rating: z.number().int().min(1).max(5),
    comments: z.string().trim().max(2000),
  })
  .strict();
export const adminSchemas = {
  users: z
    .object({
      department_id: id,
      email: z.email().max(200),
      name,
      role: z.enum(roles),
      status: z.enum(['ACTIVE', 'INACTIVE']),
    })
    .strict(),
  departments: z
    .object({ department_name: name, department_code: name, department_type: name })
    .strict(),
  buildings: z
    .object({
      building_name: name,
      building_code: name,
      building_type: name,
      number_of_floors: z.number().int().min(0).max(200),
    })
    .strict(),
  rooms: z
    .object({
      building_id: id,
      room_number: name,
      floor_number: z.number().int().min(0).max(200),
      room_type: name,
    })
    .strict(),
  categories: z
    .object({
      category_name: name,
      default_priority: z.enum(priorities),
      expected_resolution_hours: z.number().positive().max(8760),
    })
    .strict(),
  teams: z
    .object({
      manager_id: id,
      team_name: name,
      specialization: name,
      status: z.enum(['ACTIVE', 'INACTIVE']),
    })
    .strict(),
};
