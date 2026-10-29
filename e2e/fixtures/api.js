export async function createCourse(session, values = {}) {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const randomKey = Math.random().toString(36).substring(2, 8).toUpperCase();
  const response = await session.api('/courses', {
    method: 'POST',
    body: {
      code: `E2E${unique}`.slice(0, 20),
      title: `Khóa học E2E ${unique}`,
      description: 'Dữ liệu được tạo tự động cho kiểm thử E2E.',
      semester: 'E2E-2026',
      enrollmentKey: `E${randomKey}`,
      ...values
    }
  });
  return response?.course || response?.data || response;
}

export async function publishCourse(session, courseId) {
  return session.api(`/courses/${courseId}/publish`, { method: 'PATCH' });
}

export async function enrollStudent(session, enrollmentKey) {
  return session.api('/courses/enroll', {
    method: 'POST',
    body: { enrollment_key: enrollmentKey }
  });
}
