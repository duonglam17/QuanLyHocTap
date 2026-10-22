const { ConflictError } = require('../../../common/errors');
const { getPort: defaultGetPort } = require('../../../contracts');

let getPort = defaultGetPort;

function createCourseAccessPort(courseRepository) {
  return Object.freeze({
    async getCourse(courseId) {
      const course = await courseRepository.findById(courseId);
      if (!course) {
        return null;
      }
      return {
        id: Number(course.id),
        ownerId: Number(course.ownerId),
        title: course.title,
        status: course.status
      };
    },
    async isOwner(userId, courseId) {
      return courseRepository.isOwner(userId, courseId);
    },
    async isEnrolled(userId, courseId) {
      return courseRepository.isEnrolled(userId, courseId);
    },
    async assertCourseWritable(courseId) {
      const course = await courseRepository.findById(courseId);
      if (!course || course.status === 'ARCHIVED') {
        throw new ConflictError('Khóa học không tồn tại hoặc đã lưu trữ', null, 'COURSE_ARCHIVED');
      }
    },
    async getEnrolledStudentIds(courseId) {
      return courseRepository.getEnrolledStudentIds(courseId);
    },
    async listEnrolledStudents(courseId, options) {
      return courseRepository.listEnrolledStudents(courseId, options);
    },
    async getUsersBrief(userIds) {
      return courseRepository.getUsersBrief(userIds);
    },
    async getLessonSummary(lessonId) {
      return courseRepository.getLessonSummary(lessonId);
    }
  });
}

function getPortAtRequestTime(name, options) {
  return getPort(name, options);
}

function setCourseAccessPortResolver(portResolver) {
  if (typeof portResolver !== 'function') {
    throw new TypeError('Port resolver phải là hàm.');
  }
  getPort = portResolver;
}

module.exports = {
  createCourseAccessPort,
  getPortAtRequestTime,
  setCourseAccessPortResolver
};
