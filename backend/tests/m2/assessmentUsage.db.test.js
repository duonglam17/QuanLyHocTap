const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const test = require('node:test');

const config = require('../../src/common/config');
const { createRegistry } = require('../../src/contracts');
const m2 = require('../../src/modules/m2-assessment');

test('M2 init registers the assessmentUsage Port', () => {
  const registry = createRegistry();
  m2.init({ db: { query() {} }, contracts: registry });

  const assessmentUsage = registry.getPort('assessmentUsage');
  assert.equal(typeof assessmentUsage.hasCourseData, 'function');
  assert.equal(typeof assessmentUsage.hasUserData, 'function');
});

test('assessmentUsage Port checks course and user data against MySQL', async (t) => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
      connectTimeout: 2000
    });
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      t.skip(`MySQL test database is unavailable: ${error.code}`);
      return;
    }
    throw error;
  }

  try {
    await connection.query(
      'CREATE TEMPORARY TABLE `assignments` (`id` BIGINT PRIMARY KEY, `course_id` BIGINT NOT NULL, `created_by` BIGINT NULL)'
    );
    await connection.query(
      'CREATE TEMPORARY TABLE `submissions` (`id` BIGINT PRIMARY KEY, `assignment_id` BIGINT NOT NULL, `student_id` BIGINT NOT NULL)'
    );
    await connection.query(
      'CREATE TEMPORARY TABLE `grades` (`id` BIGINT PRIMARY KEY, `submission_id` BIGINT NOT NULL, `graded_by` BIGINT NOT NULL)'
    );

    let usageQueryCount = 0;
    const registry = createRegistry();
    m2.init({
      db: {
        query(sql, params) {
          usageQueryCount += 1;
          return connection.query(sql, params);
        }
      },
      contracts: registry
    });
    const assessmentUsage = registry.getPort('assessmentUsage');
    const assertSingleQueryResult = async (check, expected) => {
      const previousCount = usageQueryCount;
      assert.equal(await check(), expected);
      assert.equal(usageQueryCount, previousCount + 1);
    };

    await assertSingleQueryResult(() => assessmentUsage.hasCourseData(100), false);
    await assertSingleQueryResult(() => assessmentUsage.hasUserData(7), false);

    await connection.query(
      'INSERT INTO `assignments` (`id`, `course_id`, `created_by`) VALUES (1, 100, 7)'
    );
    await assertSingleQueryResult(() => assessmentUsage.hasCourseData(100), true);
    await assertSingleQueryResult(() => assessmentUsage.hasUserData(7), true);
    await assertSingleQueryResult(() => assessmentUsage.hasUserData(8), false);

    await connection.query(
      'INSERT INTO `submissions` (`id`, `assignment_id`, `student_id`) VALUES (2, 1, 8)'
    );
    await assertSingleQueryResult(() => assessmentUsage.hasUserData(8), true);

    await connection.query(
      'INSERT INTO `grades` (`id`, `submission_id`, `graded_by`) VALUES (3, 2, 9)'
    );
    await assertSingleQueryResult(() => assessmentUsage.hasUserData(9), true);
  } finally {
    await connection.end();
  }
});
