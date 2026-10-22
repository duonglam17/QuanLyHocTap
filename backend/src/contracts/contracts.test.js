const assert = require('node:assert/strict');
const test = require('node:test');

const { createAssessmentUsageFake, createQuizUsageFake } = require('./fakes');

for (const [name, createFake] of [
  ['assessmentUsage', createAssessmentUsageFake],
  ['quizUsage', createQuizUsageFake]
]) {
  test(`${name} fake implements both usage checks with false defaults`, async () => {
    const fake = createFake();

    assert.equal(await fake.hasCourseData(12), false);
    assert.equal(await fake.hasUserData(34), false);
  });

  test(`${name} fake can represent existing course and user data`, async () => {
    const fake = createFake({ courseHasData: true, userHasData: true });

    assert.equal(await fake.hasCourseData(12), true);
    assert.equal(await fake.hasUserData(34), true);
  });
}
