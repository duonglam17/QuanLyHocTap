/**
 * @typedef {Object} EnrollmentValidation
 * @property {number|string} courseId
 * @property {number|string} studentId
 * @property {boolean} enrolled
 */

/**
 * @typedef {Object} CourseOwnerValidation
 * @property {number|string} courseId
 * @property {number|string} instructorId
 * @property {boolean} isOwner
 */

/**
 * @typedef {Object} LessonSummary
 * @property {number|string} id
 * @property {number|string} courseId
 * @property {string} title
 * @property {number} orderIndex
 */

/**
 * @typedef {Object} CourseAccessPort
 * @property {(courseId: number|string, studentId: number|string) => Promise<EnrollmentValidation>} validateEnrollment
 * @property {(courseId: number|string, instructorId: number|string) => Promise<CourseOwnerValidation>} validateCourseOwner
 * @property {(lessonId: number|string) => Promise<LessonSummary|null>} getLessonSummary
 */

/**
 * @typedef {Object} QuizGrade
 * @property {number|string} quizId
 * @property {string} title
 * @property {number|null} score
 * @property {number} totalQuestions
 * @property {number} correctAnswersCount
 * @property {string} status
 */

/**
 * @typedef {Object} QuizResultsPort
 * @property {(courseId: number|string, studentId: number|string) => Promise<QuizGrade[]>} getStudentQuizGrades
 */

/**
 * @typedef {Object} CourseNotification
 * @property {string} type
 * @property {string} title
 * @property {string} content
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} CourseNotificationResult
 * @property {number|string} courseId
 * @property {number} notifiedCount
 */

/**
 * @typedef {Object} NotificationsPort
 * @property {(courseId: number|string, notification: CourseNotification) => Promise<CourseNotificationResult>} notifyCourseStudents
 */

module.exports = {};
