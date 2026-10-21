class StudentGradebook {
  constructor({ courseId, studentId, assignments, quizzes }) {
    this.courseId = Number(courseId);
    this.studentId = Number(studentId);
    this.assignments = assignments;
    this.quizzes = quizzes;
  }

  toJSON() {
    return {
      course_id: this.courseId,
      assignments: this.assignments,
      quizzes: this.quizzes
    };
  }
}

module.exports = StudentGradebook;
