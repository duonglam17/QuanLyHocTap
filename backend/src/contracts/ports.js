/**
 * @typedef {'DRAFT'|'PUBLISHED'|'ARCHIVED'} CourseStatus
 */

/**
 * @typedef {Object} Course
 * @property {number} id
 * @property {number} ownerId
 * @property {string} title
 * @property {CourseStatus} status
 */

/**
 * @typedef {Object} EnrolledStudent
 * @property {number} id
 * @property {string} username
 * @property {string} fullName
 */

/**
 * @typedef {Object} EnrolledStudentPage
 * @property {EnrolledStudent[]} items
 * @property {number} total
 */

/**
 * @typedef {Object} BriefUser
 * @property {number} id
 * @property {string} username
 * @property {string} fullName
 * @property {'ADMIN'|'GIANG_VIEN'|'SINH_VIEN'} role
 */

/**
 * @typedef {Object} LessonSummary
 * @property {number} id
 * @property {number} courseId
 */

/**
 * @typedef {Object} CourseAccessPort
 * @property {(courseId: number) => Promise<Course|null>} getCourse
 * @property {(userId: number, courseId: number) => Promise<boolean>} isOwner
 * @property {(userId: number, courseId: number) => Promise<boolean>} isEnrolled
 * @property {(courseId: number) => Promise<void>} assertCourseWritable
 * @property {(courseId: number) => Promise<number[]>} getEnrolledStudentIds
 * @property {(courseId: number, options?: {page?: number, limit?: number}) => Promise<EnrolledStudentPage>} listEnrolledStudents
 * @property {(userIds: number[]) => Promise<BriefUser[]>} getUsersBrief
 * @property {(lessonId: number) => Promise<LessonSummary|null>} getLessonSummary
 */

/**
 * @typedef {'SUBMITTED'|'AUTO_SUBMITTED'|null} AttemptStatus
 */

/**
 * @typedef {Object} QuizScore
 * @property {number} studentId
 * @property {number} quizId
 * @property {string} quizTitle
 * @property {10} maxScore
 * @property {number|null} score
 * @property {number} totalQuestions
 * @property {number} correctAnswersCount
 * @property {string} status
 * @property {boolean} [visibleToStudent]
 */

/**
 * @typedef {Object} QuizResultsPort
 * @property {(courseId: number|string, studentId: number|string) => Promise<QuizGrade[]>} getStudentQuizGrades
 * @property {(courseId: number|string, studentId: number|string) => Promise<QuizScore[]>} getQuizScoresForStudent
 */

/**
 * @typedef {Object} QuizScore
 * @property {number|string} quizId
 * @property {string} title
 * @property {number|null} score
 * @property {number} [maxScore]
 * @property {string|null} [feedback]
 * @property {string} [status]
 * @property {boolean} [visibleToStudent]
 */

/**
 * @typedef {'NEW_ASSIGNMENT'|'ASSIGNMENT_GRADED'|'ANNOUNCEMENT'|'SCHEDULE_CHANGED'} NotificationType
 */

/**
 * @typedef {Object} NotificationPayload
 * @property {NotificationType} type
 * @property {string} title
 * @property {string} message
 * @property {string} refType
 * @property {number|string} refId
 * @property {string} link
 */

/**
 * @typedef {Object} NotificationsPort
 * @property {(userId: number, payload: NotificationPayload) => Promise<void>} notifyUser
 * @property {(courseId: number, payload: NotificationPayload) => Promise<void>} notifyCourseStudents
 */

module.exports = {};
