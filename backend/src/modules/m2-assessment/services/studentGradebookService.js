const {
  ForbiddenError,
  NotFoundError,
  ValidationError
} = require('../../../common/errors');
const logger = require('../../../common/logger');
const { getPort } = require('../../../contracts');

class StudentGradebookService {
  constructor({ gradebookRepository, getPortFn = getPort } = {}) {
    this.gradebookRepository = gradebookRepository;
    this.getPort = getPortFn;
  }

  async getForStudent({ courseId, studentId }) {
    const numericCourseId = Number(courseId);
    const numericStudentId = Number(studentId);
    if (
      !Number.isSafeInteger(numericCourseId) ||
      numericCourseId <= 0 ||
      !Number.isSafeInteger(numericStudentId) ||
      numericStudentId <= 0
    ) {
      throw new ValidationError('Mã khóa học và danh tính sinh viên đã xác thực là bắt buộc.');
    }

    const courseAccess = this.getPort('courseAccess', { optional: true });
    if (
      !courseAccess ||
      typeof courseAccess.getCourse !== 'function' ||
      typeof courseAccess.isEnrolled !== 'function'
    ) {
      logger.warn('Port "courseAccess" chưa sẵn sàng để xác minh ghi danh bảng điểm cá nhân.');
      throw new ForbiddenError('Không thể xác minh quyền truy cập bảng điểm khóa học.');
    }

    const course = await courseAccess.getCourse(numericCourseId);
    if (!course) {
      throw new NotFoundError('Không tìm thấy khóa học yêu cầu.');
    }
    if (!(await courseAccess.isEnrolled(numericStudentId, numericCourseId))) {
      throw new ForbiddenError('Sinh viên chưa ghi danh vào khóa học này.');
    }

    const assignments = await this.gradebookRepository.findByCourseAndStudent(
      numericCourseId,
      numericStudentId
    );
    const quizResults = this.getPort('quizResults', { optional: true });
    let quizScores = [];
    if (quizResults && typeof quizResults.getQuizScoresForStudent === 'function') {
      const result = await quizResults.getQuizScoresForStudent(
        numericCourseId,
        numericStudentId
      );
      if (!Array.isArray(result)) {
        throw new TypeError('quizResults.getQuizScoresForStudent phải trả về một mảng.');
      }
      quizScores = result;
    } else {
      logger.warn(
        'Port "quizResults.getQuizScoresForStudent" chưa sẵn sàng; bảng điểm chỉ gồm bài tập.'
      );
    }

    const visibleAssignments = assignments.filter((item) => item.visibleToStudent !== false);
    const visibleQuizzes = quizScores
      .filter((item) => item.visibleToStudent === true)
      .map((item) => ({
        type: 'QUIZ',
        id: item.quizId,
        title: item.quizTitle,
        score: item.score === null || item.score === undefined ? null : Number(item.score),
        maxScore: item.maxScore,
        feedback: null,
        status: item.attemptStatus,
        submittedAt: item.submittedAt,
        visibleToStudent: true
      }));

    return this.gradebookRepository.createGradebook({
      courseId: numericCourseId,
      studentId: numericStudentId,
      assignments: visibleAssignments,
      quizzes: visibleQuizzes
    });
  }
}

module.exports = StudentGradebookService;
