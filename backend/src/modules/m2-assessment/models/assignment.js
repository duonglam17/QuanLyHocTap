/**
 * LMS Mini - Module M2 Assessment
 * Assignment Model
 */

class Assignment {
  constructor({
    id,
    course_id,
    title,
    description,
    deadline,
    due_date,
    max_score = 10.00,
    allow_late = false,
    allow_late_submission = false,
    submission_status = null,
    status = 'OPEN',
    created_at,
    updated_at,
    deleted_at = null
  }) {
    this.id = id ? Number(id) : null;
    this.courseId = Number(course_id);
    this.title = title;
    this.description = description || '';
    this.dueDate = due_date || deadline;
    this.deadline = deadline || due_date;
    this.maxScore = Number(max_score);
    this.allowLateSubmission = Boolean(allow_late_submission || allow_late);
    this.submissionStatus = submission_status;
    this.status = status;
    this.createdAt = created_at;
    this.updatedAt = updated_at;
    this.deletedAt = deleted_at;
  }

  toJSON() {
    return {
      id: this.id,
      course_id: this.courseId,
      title: this.title,
      description: this.description,
      due_date: this.dueDate,
      deadline: this.deadline,
      max_score: this.maxScore,
      allow_late_submission: this.allowLateSubmission,
      submission_status: this.submissionStatus,
      status: this.status,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      deleted_at: this.deletedAt
    };
  }
}

module.exports = Assignment;
