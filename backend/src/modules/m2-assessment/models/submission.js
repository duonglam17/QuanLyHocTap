class Submission {
  constructor({
    id,
    assignment_id,
    student_id,
    original_filename,
    file_uuid,
    file_path,
    file_size_bytes,
    mime_type,
    submitted_at,
    is_late,
    late_minutes,
    submission_count,
    status
  }) {
    this.id = Number(id);
    this.assignmentId = Number(assignment_id);
    this.studentId = Number(student_id);
    this.originalFilename = original_filename;
    this.fileUuid = file_uuid;
    this.filePath = file_path;
    this.fileSizeBytes = Number(file_size_bytes);
    this.mimeType = mime_type;
    this.submittedAt = submitted_at;
    this.isLate = Boolean(is_late);
    this.lateMinutes = Number(late_minutes);
    this.submissionCount = Number(submission_count);
    this.status = status;
  }

  toJSON() {
    return {
      id: this.id,
      assignment_id: this.assignmentId,
      student_id: this.studentId,
      original_filename: this.originalFilename,
      file_size_bytes: this.fileSizeBytes,
      mime_type: this.mimeType,
      submitted_at: this.submittedAt,
      is_late: this.isLate,
      late_minutes: this.lateMinutes,
      submission_count: this.submissionCount,
      status: this.status
    };
  }
}

module.exports = Submission;
