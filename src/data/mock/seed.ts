import type { EntityMap, Entity } from '@/types/models';
export type Store = { [K in Entity]: EntityMap[K][] };
export function seed(): Store {
  const now = Date.now();
  const ago = (h: number) => new Date(now - h * 3600000).toISOString();
  const users: EntityMap['users'][] = [
    {
      user_id: 1,
      department_id: 1,
      email: 'anku@campus.demo',
      name: 'Anku Sharma',
      role: 'STUDENT',
      status: 'ACTIVE',
    },
    {
      user_id: 2,
      department_id: 1,
      email: 'meera@campus.demo',
      name: 'Dr. Meera Rao',
      role: 'FACULTY',
      status: 'ACTIVE',
    },
    {
      user_id: 3,
      department_id: 2,
      email: 'ravi@campus.demo',
      name: 'Ravi Kumar',
      role: 'TECHNICIAN',
      status: 'ACTIVE',
    },
    {
      user_id: 4,
      department_id: 2,
      email: 'priya@campus.demo',
      name: 'Priya Nair',
      role: 'MAINTENANCE_MANAGER',
      status: 'ACTIVE',
    },
    {
      user_id: 5,
      department_id: 3,
      email: 'admin@campus.demo',
      name: 'Campus Admin',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    {
      user_id: 6,
      department_id: 2,
      email: 'asha@campus.demo',
      name: 'Asha Patel',
      role: 'TECHNICIAN',
      status: 'ACTIVE',
    },
    {
      user_id: 7,
      department_id: 2,
      email: 'imran@campus.demo',
      name: 'Imran Khan',
      role: 'TECHNICIAN',
      status: 'ACTIVE',
    },
  ];
  const categories: EntityMap['categories'][] = [
    'Electrical',
    'Plumbing',
    'Wi-Fi / Network',
    'Classroom Equipment',
    'Air Conditioning',
    'Cleaning',
  ].map((category_name, i) => ({
    category_id: i + 1,
    category_name,
    default_priority: i === 0 ? 'HIGH' : 'MEDIUM',
    expected_resolution_hours: i === 5 ? 8 : 24,
  }));
  const buildings: EntityMap['buildings'][] = [
    'Academic Block A',
    'Main Library',
    'Engineering Block',
    'Administration Block',
  ].map((building_name, i) => ({
    building_id: i + 1,
    building_name,
    building_code: ['ACA', 'LIB', 'ENG', 'ADM'][i],
    building_type: i === 1 ? 'LIBRARY' : 'ACADEMIC',
    number_of_floors: 4,
  }));
  const rooms: EntityMap['rooms'][] = buildings.flatMap((b) =>
    [1, 2, 3].map((n) => ({
      room_id: (b.building_id - 1) * 3 + n,
      building_id: b.building_id,
      room_number: `${n}0${b.building_id}`,
      floor_number: n,
      room_type: n === 3 ? 'LAB' : 'CLASSROOM',
    })),
  );
  const titles = [
    'Projector not turning on',
    'Wi-Fi unavailable in Lab 304',
    'Water leaking near Room 201',
    'Broken electrical socket',
    'AC not cooling',
    'Library reading area needs cleaning',
    'Flickering lights in corridor',
    'Network disconnects during lectures',
    'Leaking washroom tap',
    'Damaged projector cable',
    'AC filter replacement',
    'Dust accumulation in seminar hall',
  ];
  const ss: EntityMap['complaints']['status'][] = [
    'SUBMITTED',
    'UNDER_REVIEW',
    'ASSIGNED',
    'IN_PROGRESS',
    'ON_HOLD',
    'RESOLVED',
    'CLOSED',
    'REJECTED',
    'SUBMITTED',
    'RESOLVED',
    'ASSIGNED',
    'IN_PROGRESS',
  ];
  const complaints: EntityMap['complaints'][] = titles.map((title, i) => ({
    complaint_id: i + 1,
    reported_by: i % 3 === 1 ? 2 : 1,
    category_id: [4, 3, 2, 1, 5, 6][i % 6],
    building_id: (i % 4) + 1,
    room_id: (i % 4) * 3 + 1,
    title,
    description: `${title}. The issue is affecting normal campus activities. Please inspect the location and arrange the necessary maintenance.`,
    priority: i === 3 ? 'CRITICAL' : i % 3 === 0 ? 'HIGH' : 'MEDIUM',
    status: ss[i],
    reported_at: ago(72 - i * 4),
    expected_resolution_at: ago(48 - i * 4),
    resolved_at: ['RESOLVED', 'CLOSED'].includes(ss[i]) ? ago(12 + i) : null,
  }));
  const assignments: EntityMap['assignments'][] = complaints
    .filter((c) => ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'].includes(c.status))
    .map((c, i) => ({
      assignment_id: i + 1,
      complaint_id: c.complaint_id,
      technician_id: (i % 3) + 1,
      assigned_by: 4,
      assigned_at: ago(30),
      started_at: c.status === 'ASSIGNED' ? null : ago(26),
      completed_at: c.resolved_at,
      assignment_status:
        c.status === 'CLOSED' || c.status === 'RESOLVED'
          ? 'COMPLETED'
          : (c.status as 'ASSIGNED' | 'IN_PROGRESS' | 'ON_HOLD'),
    }));
  const history: EntityMap['history'][] = complaints.flatMap((c) => [
    {
      history_id: c.complaint_id * 10,
      complaint_id: c.complaint_id,
      changed_by: c.reported_by,
      old_status: null,
      new_status: 'SUBMITTED' as const,
      changed_at: c.reported_at,
    },
    ...(c.status === 'SUBMITTED'
      ? []
      : [
          {
            history_id: c.complaint_id * 10 + 1,
            complaint_id: c.complaint_id,
            changed_by: 4,
            old_status: 'SUBMITTED' as const,
            new_status: c.status,
            changed_at: ago(20),
          },
        ]),
  ]);
  return {
    departments: [
      {
        department_id: 1,
        department_name: 'Computer Science',
        department_code: 'CSE',
        department_type: 'ACADEMIC',
      },
      {
        department_id: 2,
        department_name: 'Campus Maintenance',
        department_code: 'MNT',
        department_type: 'OPERATIONS',
      },
      {
        department_id: 3,
        department_name: 'Administration',
        department_code: 'ADM',
        department_type: 'ADMINISTRATIVE',
      },
    ],
    users,
    buildings,
    rooms,
    categories,
    complaints,
    history,
    teams: [
      {
        team_id: 1,
        manager_id: 4,
        team_name: 'Infrastructure Care',
        specialization: 'Electrical and plumbing',
        status: 'ACTIVE',
      },
      {
        team_id: 2,
        manager_id: 4,
        team_name: 'Digital Campus',
        specialization: 'Network and equipment',
        status: 'ACTIVE',
      },
    ],
    technicians: [
      {
        technician_id: 1,
        user_id: 3,
        team_id: 1,
        employee_code: 'MNT-001',
        specialization: 'Electrical',
        availability_status: 'BUSY',
        experience_years: 5,
      },
      {
        technician_id: 2,
        user_id: 6,
        team_id: 2,
        employee_code: 'MNT-002',
        specialization: 'Network',
        availability_status: 'BUSY',
        experience_years: 3,
      },
      {
        technician_id: 3,
        user_id: 7,
        team_id: 1,
        employee_code: 'MNT-003',
        specialization: 'Plumbing / HVAC',
        availability_status: 'BUSY',
        experience_years: 7,
      },
    ],
    assignments,
    'work-logs': assignments
      .filter((a) => a.started_at)
      .map((a, i) => ({
        work_log_id: i + 1,
        assignment_id: a.assignment_id,
        technician_id: a.technician_id,
        work_description: 'Inspected the reported issue and identified the required repair.',
        work_date: ago(18),
        hours_worked: 1.5,
      })),
    inventory: [
      {
        item_id: 1,
        item_code: 'ELE-001',
        item_name: 'Electrical socket',
        quantity_available: 24,
        unit_cost: 180,
      },
      {
        item_id: 2,
        item_code: 'NET-001',
        item_name: 'Ethernet cable (metre)',
        quantity_available: 4,
        unit_cost: 35,
      },
      {
        item_id: 3,
        item_code: 'PLB-001',
        item_name: 'Tap washer',
        quantity_available: 30,
        unit_cost: 15,
      },
      {
        item_id: 4,
        item_code: 'AC-001',
        item_name: 'AC filter',
        quantity_available: 3,
        unit_cost: 650,
      },
      {
        item_id: 5,
        item_code: 'CLS-001',
        item_name: 'Projector cable',
        quantity_available: 12,
        unit_cost: 450,
      },
    ],
    materials: [],
    feedback: [],
  };
}
