import type { User } from '@/types/models';
import type { Repositories } from '@/repositories/interfaces/Repository';
import { allow, workers } from '@/lib/permissions';
import { check } from '@/lib/errors';
import { materialInput } from '@/lib/validation';
export class InventoryService {
  constructor(public r: Repositories) {}
  async list(user: User) {
    allow(user, workers);
    return this.r.inventory.findAll();
  }
  async recordMaterialUsage(user: User, input: unknown) {
    allow(user, ['TECHNICIAN']);
    const data = materialInput.parse(input);
    const t = (await this.r.technicians.findAll()).find((t) => t.user_id === user.user_id);
    check(t, 'Technician profile missing', 409);
    const a = (await this.r.assignments.findAll()).find(
      (a) =>
        a.complaint_id === data.complaint_id &&
        a.technician_id === t.technician_id &&
        a.assignment_status === 'IN_PROGRESS',
    );
    check(a, 'An active assignment is required', 409);
    const item = await this.r.inventory.findById(data.item_id);
    check(item, 'Unknown inventory item');
    check(item.quantity_available >= data.quantity_used, 'Insufficient inventory stock', 409);
    // DATABASE TODO: replace both writes with ONE PostgreSQL transaction and row lock.
    // Unit price comes from inventory, never from client input. Mock requests are serialized.
    await this.r.inventory.update(item.item_id, {
      quantity_available: item.quantity_available - data.quantity_used,
    });
    return this.r.materials.create({
      ...data,
      technician_id: t.technician_id,
      unit_cost: item.unit_cost,
      total_cost: Math.round(item.unit_cost * data.quantity_used * 100) / 100,
    });
  }
}
