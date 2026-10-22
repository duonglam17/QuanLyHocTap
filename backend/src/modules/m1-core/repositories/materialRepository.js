const db = require('../../../common/db');

const materialColumns = `m.id, m.lesson_id AS lessonId, m.title,
  m.original_filename AS originalName, m.file_path AS storedName,
  m.file_size_bytes AS size, m.mime_type AS mime, m.uploaded_at AS uploadedAt`;

class MaterialRepository {
  constructor(dbClient = db) {
    this.db = dbClient;
  }

  async create(lessonId, material) {
    const [result] = await this.db.query(
      `INSERT INTO materials
         (lesson_id, title, original_filename, file_uuid, file_path, file_size_bytes, mime_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        lessonId,
        material.title,
        material.originalName,
        material.fileUuid,
        material.storedName,
        material.size,
        material.mime
      ]
    );
    return this.findById(result.insertId);
  }

  async findById(materialId) {
    const [rows] = await this.db.query(
      `SELECT ${materialColumns}
       FROM materials m
       WHERE m.id = ?
       LIMIT 1`,
      [materialId]
    );
    return rows[0]
      ? { ...rows[0], id: Number(rows[0].id), lessonId: Number(rows[0].lessonId) }
      : null;
  }

  async findForDownload(courseId, materialId) {
    const [rows] = await this.db.query(
      `SELECT ${materialColumns}, l.course_id AS courseId,
              c.instructor_id AS ownerId, c.status AS courseStatus
       FROM materials m
       JOIN lessons l ON l.id = m.lesson_id
       JOIN courses c ON c.id = l.course_id
       WHERE m.id = ? AND l.course_id = ?
       LIMIT 1`,
      [materialId, courseId]
    );
    return rows[0]
      ? {
          ...rows[0],
          id: Number(rows[0].id),
          lessonId: Number(rows[0].lessonId),
          courseId: Number(rows[0].courseId),
          ownerId: Number(rows[0].ownerId)
        }
      : null;
  }

  async listByLesson(lessonId) {
    const [rows] = await this.db.query(
      `SELECT ${materialColumns}
       FROM materials m
       WHERE m.lesson_id = ?
       ORDER BY m.uploaded_at, m.id`,
      [lessonId]
    );
    return rows.map((material) => ({
      ...material,
      id: Number(material.id),
      lessonId: Number(material.lessonId)
    }));
  }

  async listByLessonIds(lessonIds) {
    if (!Array.isArray(lessonIds) || lessonIds.length === 0) {
      return [];
    }
    const placeholders = lessonIds.map(() => '?').join(', ');
    const [rows] = await this.db.query(
      `SELECT ${materialColumns}
       FROM materials m
       WHERE m.lesson_id IN (${placeholders})
       ORDER BY m.lesson_id, m.uploaded_at, m.id`,
      lessonIds
    );
    return rows.map((material) => ({
      ...material,
      id: Number(material.id),
      lessonId: Number(material.lessonId)
    }));
  }
}

module.exports = MaterialRepository;
