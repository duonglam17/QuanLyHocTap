class Grade {
  constructor({ id, submission_id, graded_by, score, feedback, graded_at, updated_at }) {
    this.id = Number(id);
    this.submissionId = Number(submission_id);
    this.gradedBy = Number(graded_by);
    this.score = Number(score);
    this.feedback = feedback || '';
    this.gradedAt = graded_at;
    this.updatedAt = updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      submission_id: this.submissionId,
      graded_by: this.gradedBy,
      score: this.score,
      feedback: this.feedback,
      graded_at: this.gradedAt,
      updated_at: this.updatedAt
    };
  }
}

module.exports = Grade;
