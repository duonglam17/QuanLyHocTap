function createCourseAccessFake(overrides = {}) {
  return {
    async validateEnrollment(courseId, studentId) {
      return { courseId, studentId, enrolled: true, ...overrides.enrollment };
    },
    async validateCourseOwner(courseId, instructorId) {
      return { courseId, instructorId, isOwner: true, ...overrides.courseOwner };
    },
    async getLessonSummary(lessonId) {
      if (overrides.lessonSummary === null) {
        return null;
      }
      return {
        id: lessonId,
        courseId: overrides.lessonSummary?.courseId ?? 1,
        title: overrides.lessonSummary?.title ?? 'Fake lesson',
        orderIndex: overrides.lessonSummary?.orderIndex ?? 1
      };
    },
    async listEnrolledStudents(courseId, { page = 1, pageSize = 20 } = {}) {
      const students = overrides.students || [
        { id: 1, studentNumber: 'SV001', fullName: 'Fake Student' }
      ];
      const start = (page - 1) * pageSize;
      return {
        students: students.slice(start, start + pageSize).map((student) => ({ ...student })),
        total: students.length,
        courseId
      };
    }
  };
}

function createQuizResultsFake(grades = []) {
  return {
    async getStudentQuizGrades() {
      return grades.map((grade) => ({ ...grade }));
    },
    async getQuizScoresForCourse() {
      return grades.map((grade) => ({ ...grade }));
    }
  };
}

function createNotificationsFake() {
  const sentNotifications = [];
  return {
    sentNotifications,
    async notifyCourseStudents(courseId, notification) {
      sentNotifications.push({ courseId, notification });
      return { courseId, notifiedCount: 0 };
    }
  };
}

module.exports = {
  createCourseAccessFake,
  createQuizResultsFake,
  createNotificationsFake
};
