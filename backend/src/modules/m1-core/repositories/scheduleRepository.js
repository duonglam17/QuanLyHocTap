const db = require('../../../common/db');

function normalizeSchedule(schedule) {
  if (!schedule) {
    return null;
  }
  return {
    ...schedule,
    id: Number(schedule.id),
    courseId: Number(schedule.courseId)
  };
}

const scheduleColumns = `
  id, course_id AS courseId, title,
  DATE_FORMAT(date, '%Y-%m-%d') AS date,
  TIME_FORMAT(start_time, '%H:%i:%s') AS startTime,
  TIME_FORMAT(end_time, '%H:%i:%s') AS endTime,
  room_or_link AS roomOrLink, status,
  created_at AS createdAt, updated_at AS updatedAt
`;

class ScheduleRepository {
  constructor(dbClient = db) {
    this.db = dbClient;
  }

  async lockCourse(courseId, connection) {
    const [rows] = await connection.query(
      `SELECT id, instructor_id AS ownerId, status
       FROM courses
       WHERE id = ? AND deleted_at IS NULL
       FOR UPDATE`,
      [courseId]
    );
    if (!rows[0]) {
      return null;
    }
    return {
      id: Number(rows[0].id),
      ownerId: Number(rows[0].ownerId),
      status: rows[0].status
    };
  }

  async findById(scheduleId, connection = null) {
    const client = connection || this.db;
    const [rows] = await client.query(
      `SELECT ${scheduleColumns}
       FROM schedules
       WHERE id = ?
       LIMIT 1`,
      [scheduleId]
    );
    return normalizeSchedule(rows[0]);
  }

  async findConflict(courseId, date, startTime, endTime, { excludeId = null } = {}, connection) {
    const client = connection || this.db;
    const excludedClause = excludeId === null ? '' : 'AND id <> ?';
    const parameters = [courseId, date, endTime, startTime];
    if (excludeId !== null) {
      parameters.push(excludeId);
    }
    const [rows] = await client.query(
      `SELECT id
       FROM schedules
       WHERE course_id = ?
         AND date = ?
         AND status <> 'CANCELLED'
         AND start_time < ?
         AND end_time > ?
         ${excludedClause}
       LIMIT 1`,
      parameters
    );
    return rows.length > 0;
  }

  async create(courseId, schedule, connection) {
    await connection.query(
      `INSERT INTO schedules
         (course_id, title, date, start_time, end_time, room_or_link, status)
       VALUES (?, ?, ?, ?, ?, ?, 'SCHEDULED')`,
      [
        courseId,
        schedule.title,
        schedule.date,
        schedule.startTime,
        schedule.endTime,
        schedule.roomOrLink
      ]
    );
    const [rows] = await connection.query(
      `SELECT ${scheduleColumns}
       FROM schedules
       WHERE id = LAST_INSERT_ID()
       LIMIT 1`
    );
    return normalizeSchedule(rows[0]);
  }

  async update(scheduleId, courseId, schedule, connection) {
    await connection.query(
      `UPDATE schedules
       SET title = ?, date = ?, start_time = ?, end_time = ?,
           room_or_link = ?, status = ?
       WHERE id = ? AND course_id = ?`,
      [
        schedule.title,
        schedule.date,
        schedule.startTime,
        schedule.endTime,
        schedule.roomOrLink,
        schedule.status,
        scheduleId,
        courseId
      ]
    );
    return this.findById(scheduleId, connection);
  }

  async setStatus(scheduleId, courseId, status, connection) {
    await connection.query(
      `UPDATE schedules
       SET status = ?
       WHERE id = ? AND course_id = ?`,
      [status, scheduleId, courseId]
    );
    return this.findById(scheduleId, connection);
  }

  async listByCourse(courseId) {
    const [rows] = await this.db.query(
      `SELECT ${scheduleColumns}
       FROM schedules
       WHERE course_id = ? AND status <> 'CANCELLED'
       ORDER BY date ASC, start_time ASC, id ASC`,
      [courseId]
    );
    return rows.map(normalizeSchedule);
  }

  async listForStudent(userId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const [[countRows], [rows]] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) AS total
         FROM schedules s
         JOIN enrollments e ON e.course_id = s.course_id
         JOIN courses c ON c.id = s.course_id
         WHERE e.student_id = ?
           AND c.deleted_at IS NULL
           AND s.status <> 'CANCELLED'`,
        [userId]
      ),
      this.db.query(
        `SELECT s.id, s.course_id AS courseId, c.code AS courseCode,
                c.title AS courseTitle, s.title,
                DATE_FORMAT(s.date, '%Y-%m-%d') AS date,
                TIME_FORMAT(s.start_time, '%H:%i:%s') AS startTime,
                TIME_FORMAT(s.end_time, '%H:%i:%s') AS endTime,
                s.room_or_link AS roomOrLink, s.status,
                s.created_at AS createdAt, s.updated_at AS updatedAt
         FROM schedules s
         JOIN enrollments e ON e.course_id = s.course_id
         JOIN courses c ON c.id = s.course_id
         WHERE e.student_id = ?
           AND c.deleted_at IS NULL
           AND s.status <> 'CANCELLED'
         ORDER BY s.date ASC, s.start_time ASC, s.course_id ASC, s.id ASC
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      )
    ]);
    return {
      items: rows.map(normalizeSchedule),
      total: Number(countRows[0]?.total || 0)
    };
  }
}

module.exports = ScheduleRepository;
