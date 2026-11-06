import type { User } from '@/types/models';
import type { Repositories } from '@/repositories/interfaces/Repository';
import { feedbackInput } from '@/lib/validation';
import { allow } from '@/lib/permissions';
import { check } from '@/lib/errors';
export class FeedbackService {
  constructor(public r: Repositories) {}
  async submitFeedback(user: User, input: unknown) {
    allow(user, ['STUDENT', 'FACULTY']);
    const data = feedbackInput.parse(input);
    const c = await this.r.complaints.findById(data.complaint_id);
    check(c, 'Complaint not found', 404);
    check(c.reported_by === user.user_id, 'Only the reporter may provide feedback', 403);
    check(['RESOLVED', 'CLOSED'].includes(c.status), 'Feedback is available after resolution', 409);
    check(
      !(await this.r.feedback.findAll()).some((f) => f.complaint_id === c.complaint_id),
      'Feedback already submitted',
      409,
    );
    const a = (await this.r.assignments.findAll())
      .filter((a) => a.complaint_id === c.complaint_id && a.assignment_status === 'COMPLETED')
      .at(-1);
    check(a, 'Completed assignment missing', 409);
    return this.r.feedback.create({
      ...data,
      user_id: user.user_id,
      technician_id: a.technician_id,
      submitted_at: new Date().toISOString(),
    });
  }
}
