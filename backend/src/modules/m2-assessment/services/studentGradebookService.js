const { ForbiddenError, ValidationError } = require('../../../common/errors');
const logger = require('../../../common/logger');
const { getPort } = require('../../../contracts');

class StudentGradebookService {
  constructor({ gradebookRepository, getPortFn = getPort } = {}) {
    this.gradebookRepository = gradebookRepository;
    this.getPort = getPortFn;
  }

  async getForStudent({ courseId, studentId }) {
    if (!courseId || !studentId) {
      throw new ValidationError('Mã khóa học và danh tính sinh viên đã xác thực là bắt buộc.');
    }

    const courseAccess = this.getPort('courseAccess', { optional: true });
    if (!courseAccess || typeof courseAccess.validateEnrollment !== 'function') {
      logger.warn('Port "courseAccess" chưa sẵn sàng để xác minh ghi danh bảng điểm cá nhân.');
      throw new ForbiddenError('Không thể xác minh quyền truy cập bảng điểm khóa học.');
    }

    const enrollment = await courseAccess.validateEnrollment(courseId, studentId);
    if (enrollment !== true && enrollment?.enrolled !== true) {
      throw new ForbiddenError('Sinh viên chưa ghi danh vào khóa học này.');
    }

    const assignments = await this.gradebookRepository.findByCourseAndStudent(
      courseId,
      studentId
    );
    const quizResults = this.getPort('quizResults', { optional: true });
    let quizScores = [];
    if (quizResults && typeof quizResults.getQuizScoresForStudent === 'function') {
      const result = await quizResults.getQuizScoresForStudent(courseId, studentId);
      quizScores = Array.isArray(result) ? result : [];
    } else {
      logger.warn(
        'Port "quizResults.getQuizScoresForStudent" chưa sẵn sàng; bảng điểm chỉ gồm bài tập.'
      );
    }

    const visibleAssignments = assignments.filter((item) => item.visibleToStudent !== false);
    const visibleQuizzes = quizScores
      .filter(
        (item) =>
          item.visibleToStudent !== false && item.visible_to_student !== false
      )
      .map((item) => ({
        type: 'QUIZ',
        id: item.quizId ?? item.quiz_id ?? item.id,
        title: item.title,
        score: item.score === null || item.score === undefined ? null : Number(item.score),
        maxScore: item.maxScore ?? item.max_score ?? 10,
        feedback: item.feedback ?? null,
        status: item.status ?? null,
        visibleToStudent: true
      }));

    return this.gradebookRepository.createGradebook({
      courseId,
      studentId,
      assignments: visibleAssignments,
      quizzes: visibleQuizzes
    });
  }
}

module.exports = StudentGradebookService;
