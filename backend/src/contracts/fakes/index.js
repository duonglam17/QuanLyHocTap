const { ConflictError } = require('../../common/errors');

function createCourseAccessFake(overrides = {}) {
  const courses = new Map(
    (overrides.courses || [{ id: 1, ownerId: 2, title: 'Fake course', status: 'PUBLISHED' }]).map(
      (course) => [course.id, course]
    )
  );
  const enrolledStudentIds = overrides.enrolledStudentIds || [3];
  const enrolledStudents = overrides.enrolledStudents || [
    { id: 3, username: 'student', fullName: 'Fake Student' }
  ];
  const users = overrides.users || [
    { id: 3, username: 'student', fullName: 'Fake Student', role: 'SINH_VIEN' }
  ];

  return {
    async getCourse(courseId) {
      return courses.get(courseId) || null;
    },
    async isOwner(userId, courseId) {
      return courses.get(courseId)?.ownerId === userId;
    },
    async isEnrolled(userId, courseId) {
      return courses.has(courseId) && enrolledStudentIds.includes(userId);
    },
    async assertCourseWritable(courseId) {
      const course = courses.get(courseId);
      if (!course || course.status === 'ARCHIVED') {
        throw new ConflictError('Khóa học không tồn tại hoặc đã lưu trữ', null, 'COURSE_ARCHIVED');
      }
    },
    async getEnrolledStudentIds(courseId) {
      return courses.has(courseId) ? [...enrolledStudentIds] : [];
    },
    async listEnrolledStudents(courseId, { page = 1, limit = 20 } = {}) {
      const students = courses.has(courseId) ? enrolledStudents : [];
      const start = (page - 1) * limit;
      return {
        items: students.slice(start, start + limit).map((student) => ({ ...student })),
        total: students.length
      };
    },
    async getUsersBrief(userIds) {
      const requestedIds = new Set(userIds);
      return users.filter((user) => requestedIds.has(user.id)).map((user) => ({ ...user }));
    },
    async getLessonSummary(lessonId) {
      if (overrides.lessonSummary === null) {
        return null;
      }
      return {
        id: lessonId,
        courseId: overrides.lessonSummary?.courseId ?? 1
      };
    }
  };
}

function createQuizResultsFake({ courseScores = {}, studentScores = {} } = {}) {
  const cloneScores = (scores) => scores.map((score) => ({ ...score }));
  return {
    async getQuizScoresForCourse(courseId, studentIds) {
      const requestedIds = new Set(studentIds);
      return cloneScores(courseScores[courseId] || []).filter((score) =>
        requestedIds.has(score.studentId)
      );
    },
    async getQuizScoresForStudent(courseId, studentId) {
      const scores = studentScores[`${courseId}:${studentId}`] || [];
      return cloneScores(scores);
    }
  };
}

function createNotificationsFake() {
  const sentNotifications = [];
  return {
    sentNotifications,
    async notifyUser(userId, payload) {
      sentNotifications.push({ userId, payload });
    },
    async notifyCourseStudents(courseId, payload) {
      sentNotifications.push({ courseId, payload });
    }
  };
}

module.exports = {
  createCourseAccessFake,
  createQuizResultsFake,
  createNotificationsFake
};
