# PostgreSQL responsibilities — students implement these manually

This file is a checklist, not executable SQL. No database code has been generated. Preserve the supplied 14-entity design.

## 1. Database creation

- Plan a local PostgreSQL environment and perform CREATE DATABASE yourselves.
- Choose development/test databases, configuration handling and access permissions.
- Populate the currently empty future-connection environment placeholder only after the connection code is implemented. Keep credentials out of source control.

## 2. All 14 tables

Use `src/types/models.ts` as the application field contract:

1. Department
2. User
3. Building
4. Room
5. ComplaintCategory
6. Complaint
7. ComplaintStatusHistory
8. MaintenanceTeam
9. Technician
10. ComplaintAssignment
11. WorkLog
12. InventoryItem
13. ComplaintMaterial
14. Feedback

Choose SQL names, types, timestamp semantics, generated ID strategy and deletion policies yourselves. Application JSON uses snake_case fields and numeric identifiers. Return timestamps as ISO strings, nullable fields as null, and costs as numbers with a deliberate decimal-conversion policy.

## 3. Constraints

Write PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL and CHECK constraints manually. Include:

- Department → User, Building → Room, reporter/category/building/optional room → Complaint.
- Complaint/changed-by User → ComplaintStatusHistory.
- Manager User → MaintenanceTeam; User and MaintenanceTeam → Technician.
- Complaint/Technician/assigning User → ComplaintAssignment.
- Assignment/Technician → WorkLog.
- Complaint/InventoryItem/Technician → ComplaintMaterial.
- Complaint/reporting User/Technician → Feedback.
- One Technician profile per User; at most one Feedback per Complaint.
- Appropriate uniqueness for email, department/building/item codes, employee code, and room number within a building.
- Rating from 1 to 5, positive work hours and quantity used, nonnegative stock/cost/experience, valid priority/status values.
- Ensure a selected room belongs to the selected building and an assignment's logs belong to its technician.
- Enforce one current active assignment per complaint while retaining reassignment history.
- Restrict or deliberately handle referenced records when deleting; do not silently cascade away audit evidence.

## 4. DML

Implement and explain INSERT, UPDATE, DELETE and SELECT. Provide your own demonstration data and ensure generated IDs preserve references. Parameterize all queries.

## 5. Queries for evaluation

Manually develop examples of JOIN, GROUP BY, HAVING, ORDER BY, aggregate functions and subqueries. Useful targets:

- Complaints with reporter, category, building, optional room and current technician.
- Technicians joined to teams and managers.
- Materials joined to inventory with quantities and costs.
- Complaints and average resolution hours by category/building/department.
- Technician workload and completed-job counts.
- Open critical issues, overdue complaints and low-stock items.
- Technicians with no open assignment and complaints without feedback.

## 6. Advanced database concepts

Students must implement all of the following:

1. Trigger for complaint status history.
2. Trigger/transaction for inventory reduction.
3. Stored function/procedure for technician assignment.
4. Active complaint dashboard view.
5. Indexes based on query predicates, joins and measured plans.
6. Transactions for material allocation.

Do not implement history or stock reduction twice. If a database trigger owns a side effect, remove that side effect from the corresponding service/repository write while retaining application-level validation and API behavior.

## 7. Exact application handoff points

| File / area                                           | Work reserved for students                                                                                        |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/repositories/postgres/*`                         | Implement the contracts using PostgreSQL; files currently contain TODO comments only                              |
| `src/repositories/index.ts`                           | Inject your implemented repositories in place of mocks                                                            |
| `src/repositories/interfaces/Repository.ts`           | Preserve typed CRUD contracts and primary ID mapping                                                              |
| `src/repositories/interfaces/ComplaintRepository.ts`  | Implement reporter lookup and complaint status updates if using this specialized contract                         |
| `ComplaintService.createComplaint()` / `transition()` | Make complaint writes and history atomic; select a single owner of history creation                               |
| `AssignmentService.assignTechnician()`                | Transaction for canceling previous assignment, creating a new one, updating complaint and technician availability |
| `AssignmentService.completeAssignment()`              | Atomic completion, resolution timestamp, history and availability updates                                         |
| `InventoryService.recordMaterialUsage()`              | Lock stock, validate sufficient quantity, record price snapshot, deduct stock and persist usage atomically        |
| `FeedbackService.submitFeedback()`                    | Persist with a complaint-unique constraint and authoritative ownership checks                                     |
| `AdminService`                                        | Enforce unique/reference rules with real constraints, and map conflict errors                                     |
| `ReferenceService`                                    | Replace mock-derived metrics with queries/views as appropriate without changing the API contract                  |
| `src/lib/mutation-lock.ts`                            | Replace single-process serialization with database concurrency control                                            |
| `src/lib/auth.ts`                                     | Connect real credential verification, password hashing, secure durable sessions and account provisioning          |
| `.env.example`                                        | Configure your future connection without committing real credentials                                              |

A set of repository implementations alone does not make a multi-write operation transactional. Add an explicit unit-of-work/transaction boundary so related repositories share one database transaction.

## 8. Suggested order

1. Finalize table definitions and constraints as a team.
2. Build and test your DDL manually.
3. Enter demonstration records through your own DML.
4. Implement read repositories and confirm the dashboards.
5. Add parameterized CRUD writes.
6. Add assignment/material transactions and rollback tests.
7. Add status trigger, assignment routine, dashboard view and indexes.
8. Confirm normal, invalid, concurrent and rollback cases.
9. Explain each concept using your authored SQL during evaluation.

## 9. Completion checks

- No frontend changes should be needed when API shapes remain the same.
- Refresh/restart must preserve data after real database integration.
- Validate authorization independently of UI visibility.
- Test concurrent stock use and duplicate feedback submissions.
- Keep feedback at one per complaint and preserve assignment/status history.
- Remove demo role selection before enabling real users.
