const { AppError, ForbiddenError, ValidationError } = require('../../../common/errors');
const logger = require('../../../common/logger');
const { getPort } = require('../../../contracts');

const PAGE_SIZE = 20;

class ClassGradebookService {
  constructor({ gradebookRepository, getPortFn = getPort } = {}) {
    this.gradebookRepository = gradebookRepository;
    this.getPort = getPortFn;
  }

  async _getCourseAccess(courseId, instructorId) {
    const courseAccess = this.getPort('courseAccess', { optional: true });
    if (!courseAccess) {
      logger.warn('Port "courseAccess" chưa được đăng ký; không thể xác minh chủ khóa.');
      throw new AppError('Không thể xác minh quyền truy cập khóa học.', 'PORT_UNAVAILABLE', 503);
    }

    let isOwner = false;
    if (typeof courseAccess.isOwner === 'function') {
      isOwner = await courseAccess.isOwner(courseId, instructorId);
    } else if (typeof courseAccess.validateCourseOwner === 'function') {
      const result = await courseAccess.validateCourseOwner(courseId, instructorId);
      isOwner = result === true || result?.isOwner === true;
    }
    if (!isOwner) {
      throw new ForbiddenError('Chỉ chủ khóa học mới được xem hoặc xuất bảng điểm lớp.');
    }
    if (typeof courseAccess.listEnrolledStudents !== 'function') {
      logger.warn('Port "courseAccess.listEnrolledStudents" chưa sẵn sàng.');
      throw new AppError('Danh sách sinh viên khóa học hiện chưa khả dụng.', 'PORT_UNAVAILABLE', 503);
    }
    return courseAccess;
  }

  async _getQuizScores(courseId) {
    const quizResults = this.getPort('quizResults', { optional: true });
    if (!quizResults || typeof quizResults.getQuizScoresForCourse !== 'function') {
      logger.warn('Port "quizResults.getQuizScoresForCourse" chưa sẵn sàng.');
      throw new AppError('Điểm trắc nghiệm hiện chưa khả dụng.', 'PORT_UNAVAILABLE', 503);
    }
    const result = await quizResults.getQuizScoresForCourse(courseId);
    if (!Array.isArray(result)) {
      throw new TypeError('quizResults.getQuizScoresForCourse phải trả về một mảng.');
    }
    return result;
  }

  _normalizeRosterPage(result) {
    if (Array.isArray(result)) {
      return { students: result, total: result.length };
    }
    if (!result || !Array.isArray(result.students) || !Number.isInteger(result.total)) {
      throw new TypeError('courseAccess.listEnrolledStudents trả về dữ liệu trang không hợp lệ.');
    }
    return result;
  }

  async _loadPage({ courseId, courseAccess, assignments, quizScores, page }) {
    const roster = this._normalizeRosterPage(
      await courseAccess.listEnrolledStudents(courseId, { page, pageSize: PAGE_SIZE })
    );
    const scoreRows = await this.gradebookRepository.findAssignmentScoresForStudents(
      courseId,
      roster.students,
      assignments.map((assignment) => assignment.id)
    );
    const assignmentScores = new Map(
      scoreRows.map((row) => [
        `${row.student_id}:${row.assignment_id}`,
        row.score === null || row.score === undefined ? null : Number(row.score)
      ])
    );
    const quizScoresByStudent = new Map();
    for (const quizScore of quizScores) {
      const key = String(quizScore.studentId ?? quizScore.student_id);
      if (!quizScoresByStudent.has(key)) {
        quizScoresByStudent.set(key, new Map());
      }
      quizScoresByStudent
        .get(key)
        .set(
          String(quizScore.quizId ?? quizScore.quiz_id),
          quizScore.score === null || quizScore.score === undefined
            ? null
            : Number(quizScore.score)
        );
    }

    const students = roster.students.map((student) => {
      const assignmentGrades = {};
      for (const assignment of assignments) {
        assignmentGrades[assignment.id] =
          assignmentScores.get(`${student.id}:${assignment.id}`) ?? null;
      }

      const quizGrades = {};
      const studentQuizScores = quizScoresByStudent.get(String(student.id));
      for (const quiz of this._quizDefinitions(quizScores)) {
        quizGrades[quiz.id] = studentQuizScores?.get(String(quiz.id)) ?? null;
      }

      return {
        student_id: student.id,
        student_number: student.studentNumber ?? student.student_number ?? student.username ?? null,
        full_name: student.fullName ?? student.full_name ?? student.name ?? null,
        assignments: assignmentGrades,
        quizzes: quizGrades
      };
    });

    return { students, total: roster.total };
  }

  _quizDefinitions(quizScores) {
    const quizzes = new Map();
    for (const score of quizScores) {
      const id = score.quizId ?? score.quiz_id;
      if (id !== undefined && id !== null && !quizzes.has(String(id))) {
        quizzes.set(String(id), {
          id,
          title: score.title || `Quiz ${id}`
        });
      }
    }
    return [...quizzes.values()];
  }

  async _prepare({ courseId, instructorId }) {
    if (!courseId || !instructorId) {
      throw new ValidationError('Mã khóa học và danh tính giảng viên là bắt buộc.');
    }
    const courseAccess = await this._getCourseAccess(courseId, instructorId);
    const [assignments, quizScores] = await Promise.all([
      this.gradebookRepository.findCourseAssignments(courseId),
      this._getQuizScores(courseId)
    ]);
    return { courseAccess, assignments, quizScores };
  }

  async getCourseGradebook({ courseId, instructorId, page = 1 }) {
    const pageNumber = Number(page);
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new ValidationError('Số trang phải là số nguyên dương.');
    }
    const prepared = await this._prepare({ courseId, instructorId });
    const { students, total } = await this._loadPage({ ...prepared, courseId, page: pageNumber });
    return {
      data: students,
      assignments: prepared.assignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
        max_score: Number(assignment.max_score)
      })),
      quizzes: this._quizDefinitions(prepared.quizScores),
      pagination: {
        page: pageNumber,
        page_size: PAGE_SIZE,
        total,
        total_pages: Math.ceil(total / PAGE_SIZE)
      }
    };
  }

  async streamCourseGradebookCsv({ courseId, instructorId }) {
    const prepared = await this._prepare({ courseId, instructorId });
    const quizzes = this._quizDefinitions(prepared.quizScores);
    const headers = [
      'student_number',
      'full_name',
      ...prepared.assignments.map((assignment) => assignment.title),
      ...quizzes.map((quiz) => quiz.title)
    ];
    const service = this;
    async function* rows() {
      yield headers;
      let page = 1;
      let total = 0;
      do {
        const result = await service._loadPage({ ...prepared, courseId, page });
        total = result.total;
        for (const student of result.students) {
          yield [
            student.student_number,
            student.full_name,
            ...prepared.assignments.map((assignment) => student.assignments[assignment.id]),
            ...quizzes.map((quiz) => student.quizzes[quiz.id])
          ];
        }
        page += 1;
      } while ((page - 1) * PAGE_SIZE < total);
    }

    return rows();
  }
}

module.exports = ClassGradebookService;
