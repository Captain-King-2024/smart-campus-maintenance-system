import type { Repositories } from '../interfaces/Repository';
import { DepartmentRepository } from './DepartmentRepository';
import { UserRepository } from './UserRepository';
import { BuildingRepository } from './BuildingRepository';
import { RoomRepository } from './RoomRepository';
import { CategoryRepository } from './CategoryRepository';
import { ComplaintRepository } from './ComplaintRepository';
import { StatusHistoryRepository } from './StatusHistoryRepository';
import { TeamRepository } from './TeamRepository';
import { TechnicianRepository } from './TechnicianRepository';
import { AssignmentRepository } from './AssignmentRepository';
import { WorkLogRepository } from './WorkLogRepository';
import { InventoryRepository } from './InventoryRepository';
import { MaterialRepository } from './MaterialRepository';
import { FeedbackRepository } from './FeedbackRepository';
export function makePostgresRepositories(): Repositories {
  return {
    databaseManagedEffects: true,
    departments: new DepartmentRepository(),
    users: new UserRepository(),
    buildings: new BuildingRepository(),
    rooms: new RoomRepository(),
    categories: new CategoryRepository(),
    complaints: new ComplaintRepository(),
    history: new StatusHistoryRepository(),
    teams: new TeamRepository(),
    technicians: new TechnicianRepository(),
    assignments: new AssignmentRepository(),
    'work-logs': new WorkLogRepository(),
    inventory: new InventoryRepository(),
    materials: new MaterialRepository(),
    feedback: new FeedbackRepository(),
  };
}
