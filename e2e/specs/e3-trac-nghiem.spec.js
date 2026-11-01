import { expect } from '@playwright/test';
import { test } from '../fixtures/auth.js';
import {
  createCourse,
  enrollStudent,
  publishCourse
} from '../fixtures/api.js';

test.describe(
  'E2E-3: Tạo đề, làm bài và chấm điểm trắc nghiệm (US-10, US-11, US-12)',
  () => {
    test.describe.configure({ timeout: 60_000 });

    function localDateTime(date) {
      const vietnamTime = new Date(
        date.getTime() + 7 * 60 * 60 * 1000
      );

      return vietnamTime.toISOString().slice(0, 16);
    }

    function activeQuizValues(title) {
      const now = Date.now();

      return {
        title,
        description: 'Đề trắc nghiệm được tạo cho hành trình E2E-3.',
        duration_minutes: 30,
        open_time: localDateTime(new Date(now - 5 * 60_000)),
        close_time: localDateTime(new Date(now + 60 * 60_000)),
        show_score_immediately: true,
        questions: [
          {
            content: '2 + 2 bằng mấy?',
            options: [
              { content: '4', is_correct: true },
              { content: '3', is_correct: false },
              { content: '5', is_correct: false },
              { content: '6', is_correct: false }
            ]
          },
          {
            content: 'Thủ đô của Pháp là gì?',
            options: [
              { content: 'London', is_correct: false },
              { content: 'Paris', is_correct: true },
              { content: 'Berlin', is_correct: false },
              { content: 'Rome', is_correct: false }
            ]
          }
        ]
      };
    }

    function apiQuizValues(title) {
      const values = activeQuizValues(title);

      return {
        ...values,
        open_time: `${values.open_time.replace('T', ' ')}:00`,
        close_time: `${values.close_time.replace('T', ' ')}:00`
      };
    }

    async function createCourseForQuiz(
      teacherSession,
      studentSession,
      { enroll = true } = {}
    ) {
      const courseResponse = await createCourse(teacherSession, {
        title: `Khóa học E2E Trắc nghiệm ${Date.now()}`
      });

      const course =
        courseResponse.course ||
        courseResponse.data ||
        courseResponse;

      await publishCourse(teacherSession, course.id);

      if (enroll) {
        await enrollStudent(
          studentSession,
          course.enrollmentKey || course.enrollment_key
        );
      }

      return course;
    }

    test(
      'hành trình đầy đủ: tạo đề, khôi phục lượt thi, xử lý tab xung đột và xem điểm',
      async ({ browser, loginAs }) => {
        const teacherSession = await loginAs('GIANG_VIEN');
        const studentSession = await loginAs('SINH_VIEN');

        const course = await createCourseForQuiz(
          teacherSession,
          studentSession
        );

        const title = `Kiểm tra E2E ${Date.now()}`;

        let teacherContext;
        let studentContext;

        try {
          teacherContext = await browser.newContext({
            storageState: teacherSession.storageStatePath
          });

          studentContext = await browser.newContext({
            storageState: studentSession.storageStatePath
          });

          const teacherPage = await teacherContext.newPage();
          const studentPage = await studentContext.newPage();

          const quizValues = activeQuizValues(title);

          teacherPage.on('requestfailed', (request) => {
            console.error(
              '[E2E] Request thất bại:',
              request.method(),
              request.url(),
              request.failure()?.errorText
            );
          });

          teacherPage.on('pageerror', (error) => {
            console.error(
              '[E2E] Lỗi trang:',
              error.stack || error.message
            );
          });

          teacherPage.on('console', (message) => {
            if (message.type() === 'error') {
              console.error(
                '[E2E] Lỗi console:',
                message.text()
              );
            }
          });

          await teacherPage.goto(`/courses/${course.id}`);

          await teacherPage
            .getByRole('tab', { name: 'Trắc nghiệm' })
            .click();

          await expect(
            teacherPage.getByRole('heading', {
              name: 'Trắc nghiệm',
              exact: true
            })
          ).toBeVisible();

          await teacherPage
            .getByRole('button', { name: 'Tạo đề thi' })
            .click();

          const dialog = teacherPage.getByRole('dialog');

          await expect(dialog).toBeVisible();

          await dialog.getByLabel('Tiêu đề').fill(title);
          await dialog.getByLabel('Thời lượng (phút)').fill('30');
          await dialog.getByLabel('Mở đề').fill(quizValues.open_time);
          await dialog.getByLabel('Đóng đề').fill(quizValues.close_time);

          // Câu hỏi 1.
          await dialog
            .getByRole('button', { name: 'Thêm câu hỏi' })
            .click();

          const question1 = dialog.getByRole('group', {
            name: 'Câu 1'
          });

          await question1
            .locator('#quiz-question-0')
            .fill('2 + 2 bằng mấy?');

          await question1.locator('#quiz-option-0-0').fill('4');
          await question1.locator('#quiz-option-0-1').fill('3');

          await question1
            .getByRole('button', { name: 'Thêm lựa chọn' })
            .click();

          await question1
            .getByRole('button', { name: 'Thêm lựa chọn' })
            .click();

          await question1.locator('#quiz-option-0-2').fill('5');
          await question1.locator('#quiz-option-0-3').fill('6');

          // Câu hỏi 2.
          await dialog
            .getByRole('button', { name: 'Thêm câu hỏi' })
            .click();

          const question2 = dialog.getByRole('group', {
            name: 'Câu 2'
          });

          await question2
            .locator('#quiz-question-1')
            .fill('Thủ đô của Pháp là gì?');

          await question2.locator('#quiz-option-1-0').fill('London');
          await question2.locator('#quiz-option-1-1').fill('Paris');

          await question2
            .getByRole('button', { name: 'Thêm lựa chọn' })
            .click();

          await question2
            .getByRole('button', { name: 'Thêm lựa chọn' })
            .click();

          await question2.locator('#quiz-option-1-2').fill('Berlin');
          await question2.locator('#quiz-option-1-3').fill('Rome');

          await question2
            .locator('input[name="quiz-correct-1"]')
            .nth(1)
            .check();

          const createResponsePromise = teacherPage.waitForResponse(
            (response) =>
              response.request().method() === 'POST' &&
              new URL(response.url()).pathname.endsWith(
                `/courses/${course.id}/quizzes`
              ),
            { timeout: 10_000 }
          );

          await dialog
            .getByRole('button', { name: 'Lưu bản nháp' })
            .click();

          const createResponse = await createResponsePromise;

          console.log(
            '[E2E] Tạo đề trả về:',
            createResponse.status(),
            createResponse.url()
          );

          if (!createResponse.ok()) {
            console.error(
              '[E2E] Nội dung lỗi tạo đề:',
              await createResponse.text()
            );
          }

          expect(createResponse.status()).toBe(201);

          const quiz = await createResponse.json();

          expect(quiz.status).toBe('DRAFT');

          const quizId = quiz.id;

          await expect(dialog).not.toBeVisible();

          const quizRow = teacherPage
            .locator('li')
            .filter({ hasText: title });

          await expect(quizRow).toContainText('2 câu hỏi');

          await quizRow
            .getByRole('button', { name: 'Công bố' })
            .click();

          await expect(
            quizRow.getByRole('button', { name: 'Công bố' })
          ).toHaveCount(0);

          // Sinh viên tìm đề và bắt đầu làm bài.
          await studentPage.goto(`/courses/${course.id}`);

          await studentPage
            .getByRole('tab', { name: 'Trắc nghiệm' })
            .click();

          const studentQuizRow = studentPage
            .locator('li')
            .filter({ hasText: title });

          await expect(studentQuizRow).toBeVisible();

          const startResponsePromise = studentPage.waitForResponse(
            (response) =>
              response.request().method() === 'POST' &&
              new URL(response.url()).pathname.endsWith(
                `/quizzes/${quizId}/start`
              )
          );

          await studentQuizRow
            .getByRole('link', { name: 'Vào thi' })
            .click();

          const startResponse = await startResponsePromise;

          expect(startResponse.status()).toBe(200);

          const attemptPayload = await startResponse.json();

          expect(attemptPayload.questions).toHaveLength(2);

          expect(
            JSON.stringify(attemptPayload)
          ).not.toMatch(/is_correct|isCorrect/);

          await expect(
            studentPage.getByRole('heading', {
              name: 'Phòng thi'
            })
          ).toBeVisible();

          await studentPage.getByLabel('4').check();

          await expect(
            studentPage.getByText('Đã lưu')
          ).toBeVisible();

          // Tải lại trang và xác nhận đáp án được khôi phục.
          await studentPage.reload();

          await expect(
            studentPage.getByLabel('4')
          ).toBeChecked();

          // Mở tab thứ hai để kiểm tra xung đột phiên thi.
          const secondTab = await studentContext.newPage();

          await secondTab.goto(`/quizzes/${quizId}/take`);

          await expect(
            secondTab.getByRole('alertdialog')
          ).toContainText(
            'Bài thi đang mở ở nơi khác, chuyển sang tab này?'
          );

          await expect(
            secondTab.getByRole('group', {
              name: /2 \+ 2 bằng mấy/
            })
          ).toHaveCount(0);

          await secondTab
            .getByRole('button', {
              name: 'Chuyển sang tab này'
            })
            .click();

          await expect(
            secondTab.getByRole('group', {
              name: /2 \+ 2 bằng mấy/
            })
          ).toBeVisible();

          await expect(
            secondTab.getByLabel('4')
          ).toBeChecked();

          // Tab cũ phải mất quyền thao tác.
          await studentPage.getByLabel('3').check();

          await expect(
            studentPage.getByText(
              'Phiên làm bài này đã được thay thế.'
            )
          ).toBeVisible();

          await expect(
            studentPage.getByLabel('3')
          ).toBeDisabled();

          // Hoàn thành câu 2 và nộp bài ở tab đang sở hữu phiên.
          await secondTab.getByLabel('London').check();

          await expect(
            secondTab.getByText('Đã lưu')
          ).toBeVisible();

          await secondTab
            .getByRole('button', { name: 'Nộp bài' })
            .click();

          const submitDialog = secondTab.getByRole('alertdialog');

          await submitDialog
            .getByRole('button', { name: 'Nộp bài' })
            .click();

          await expect(
            secondTab.getByText('Điểm: 5')
          ).toBeVisible();

          await secondTab
            .getByRole('link', { name: 'Xem lại kết quả' })
            .click();

          await expect(
            secondTab.getByRole('heading', {
              name: 'Kết quả bài thi'
            })
          ).toBeVisible();

          await expect(
            secondTab.locator('dd').first()
          ).toHaveText('5');

          await expect(
            secondTab.locator('dd').nth(1)
          ).toHaveText('1 / 2');

          // Kiểm tra danh sách đề sau khi sinh viên đã nộp bài.
          const quizListResponses = [];

          const captureQuizListResponse = (response) => {
            const url = new URL(response.url());

            if (
              response.request().method() === 'GET' &&
              url.pathname === `/api/courses/${course.id}/quizzes`
            ) {
              quizListResponses.push({
                status: response.status(),
                url: response.url()
              });
            }
          };

          teacherPage.on('response', captureQuizListResponse);

          const courseReloadResponsePromise = teacherPage.waitForResponse(
            (response) =>
              response.request().method() === 'GET' &&
              new URL(response.url()).pathname ===
                `/api/courses/${course.id}`
          );

          await teacherPage.reload();

          const courseReloadResponse = await courseReloadResponsePromise;
          expect(courseReloadResponse.status()).toBe(200);
          await expect(
            teacherPage.getByRole('heading', {
              name: course.title,
              exact: true
            })
          ).toBeVisible();

          const quizListResponsePromise = teacherPage.waitForResponse(
            (response) =>
              response.request().method() === 'GET' &&
              new URL(response.url()).pathname ===
                `/api/courses/${course.id}/quizzes`
          );

          await teacherPage
            .getByRole('tab', { name: 'Trắc nghiệm' })
            .click();

          const quizListResponse = await quizListResponsePromise;
          expect(quizListResponse.status()).toBe(200);
          expect(quizListResponses).toContainEqual(
            expect.objectContaining({ status: 200 })
          );

          const lockedQuizRow = teacherPage
            .locator('li')
            .filter({ hasText: title });

          await expect(lockedQuizRow).toBeVisible();
          await expect(lockedQuizRow).toHaveCount(1);

          await expect(lockedQuizRow).toContainText(
            'Đề đã có lượt thi nên máy chủ khóa chỉnh sửa (EC-07).'
          );

          await expect(
            lockedQuizRow.getByRole('button', { name: 'Sửa' })
          ).toBeDisabled();

          // API phải từ chối sửa đề đã có lượt thi.
          await expect(
            teacherSession.api(`/quizzes/${quizId}`, {
              method: 'PATCH',
              body: {
                title: `${title} đã chỉnh sửa`
              }
            })
          ).rejects.toThrow(/\(409\)/);
        } finally {
          await Promise.allSettled([
            teacherContext?.close(),
            studentContext?.close()
          ]);
        }
      }
    );

    test(
      'từ chối sinh viên chưa ghi danh vào lượt thi',
      async ({ browser, loginAs }) => {
        const teacherSession = await loginAs('GIANG_VIEN');
        const studentSession = await loginAs('SINH_VIEN');

        const course = await createCourseForQuiz(
          teacherSession,
          studentSession,
          { enroll: false }
        );

        const title = `Đề kiểm tra quyền E2E ${Date.now()}`;

        const createdQuiz = await teacherSession.api(
          `/courses/${course.id}/quizzes`,
          {
            method: 'POST',
            body: apiQuizValues(title)
          }
        );

        const quiz =
          createdQuiz.quiz ||
          createdQuiz.data ||
          createdQuiz;

        await teacherSession.api(
          `/quizzes/${quiz.id}/publish`,
          { method: 'POST' }
        );

        const studentContext = await browser.newContext({
          storageState: studentSession.storageStatePath
        });

        try {
          const studentPage = await studentContext.newPage();

          const deniedStartPromise = studentPage.waitForResponse(
            (response) =>
              response.request().method() === 'POST' &&
              new URL(response.url()).pathname.endsWith(
                `/quizzes/${quiz.id}/start`
              )
          );

          await studentPage.goto(`/quizzes/${quiz.id}/take`);

          const deniedStart = await deniedStartPromise;

          expect(deniedStart.status()).toBe(403);

          await expect(
            studentPage.getByText(
              'Sinh viên chưa ghi danh khóa học.'
            )
          ).toBeVisible();

          await expect(
            studentPage.getByRole('group')
          ).toHaveCount(0);
        } finally {
          await studentContext.close();
        }
      }
    );
  }
);
