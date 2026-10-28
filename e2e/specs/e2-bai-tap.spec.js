import { expect } from '@playwright/test';
import { test } from '../fixtures/auth.js';
import { createCourse, publishCourse, enrollStudent } from '../fixtures/api.js';
import { createUploadFiles } from '../fixtures/uploads.js';

test.describe('E2E-2: Quy trình quản lý bài tập, nộp bài, chấm bài và bảng điểm (US-07, US-08, US-09, US-13, US-14)', () => {
  test('vòng đời trọn vẹn: tạo bài tập, nộp bài, nộp đè, chấm điểm, xem bảng điểm cá nhân và lớp', async ({
    browser,
    loginAs
  }) => {
    // 0. Chuẩn bị tệp tải lên kiểm thử (PDF & ZIP)
    const uploadFiles = await createUploadFiles();

    // 1. Khởi tạo phiên đăng nhập cho Giảng viên (gv_mai) và Sinh viên (sv_nam)
    const gvSession = await loginAs('GIANG_VIEN');
    const svSession = await loginAs('SINH_VIEN');

    // 2. Tạo khóa học và ghi danh sinh viên qua API fixtures
    const courseResponse = await createCourse(gvSession, {
      title: 'Khóa học E2E Quản lý Bài tập'
    });
    const course = courseResponse.data || courseResponse;
    const courseId = course.id;
    await publishCourse(gvSession, courseId);
    await enrollStudent(svSession, course.enrollmentKey || course.enrollment_key);

    // Tạo Context và Page riêng cho Giảng viên
    const gvContext = await browser.newContext({ storageState: gvSession.storageStatePath });
    const gvPage = await gvContext.newPage();

    // Tạo Context và Page riêng cho Sinh viên
    const svContext = await browser.newContext({ storageState: svSession.storageStatePath });
    const svPage = await svContext.newPage();

    // =========================================================================
    // Bước 1: Giảng viên tạo bài tập có hạn nộp, cho phép nộp trễ (US-07)
    // =========================================================================
    await gvPage.goto(`/courses/${courseId}?tab=assignments`);
    await expect(gvPage.getByRole('heading', { name: 'Bài tập' })).toBeVisible();

    // Bấm nút "Tạo bài tập" (hoặc "Tạo bài tập đầu tiên" nếu danh sách trống)
    const openCreateBtn = gvPage.getByRole('button', { name: /Tạo bài tập/i }).first();
    await openCreateBtn.click();

    const dialog = gvPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/Tiêu đề/i).fill('Bài tập lớn E2E');
    await dialog.getByLabel(/Mô tả/i).fill('Mô tả bài tập lớn: Sinh viên hoàn thành báo cáo PDF.');
    await dialog.getByLabel(/Hạn nộp/i).fill('2099-12-31T23:59');
    await dialog.getByLabel(/Điểm tối đa/i).fill('10');

    const allowLateCheckbox = dialog.getByLabel(/Cho phép nộp trễ/i);
    if (!(await allowLateCheckbox.isChecked())) {
      await allowLateCheckbox.check();
    }

    await dialog.getByRole('button', { name: 'Giao bài tập' }).click();
    await expect(dialog).not.toBeVisible();

    // Kiểm tra bài tập vừa tạo xuất hiện trong danh sách kèm cấu hình cho phép nộp trễ
    const assignmentItem = gvPage.locator('li', { hasText: 'Bài tập lớn E2E' });
    await expect(assignmentItem).toBeVisible();
    await expect(assignmentItem).toContainText('Cho phép nộp trễ');
    await expect(assignmentItem).toContainText('10');

    // Lấy assignmentId từ API của khóa học
    const assignmentListRes = await gvSession.api(`/courses/${courseId}/assignments`);
    const assignmentData = assignmentListRes.data || assignmentListRes;
    const assignment = Array.isArray(assignmentData)
      ? assignmentData.find((item) => item.title === 'Bài tập lớn E2E')
      : assignmentData;
    const assignmentId = assignment.id;
    expect(assignmentId).toBeTruthy();

    // =========================================================================
    // Bước 2: Sinh viên nộp bài lần đầu đúng hạn, kiểm tra trạng thái và lịch sử (US-08)
    // =========================================================================
    await svPage.goto(`/assignments/${assignmentId}`);
    await expect(svPage.getByRole('heading', { name: 'Bài tập lớn E2E' })).toBeVisible();
    await expect(svPage.getByText(/Bài tập cho phép nộp trễ/i)).toBeVisible();

    // Tải tệp PDF lên lần đầu
    await svPage.locator('#assignment-file').setInputFiles(uploadFiles.pdf.path);
    await svPage.getByRole('button', { name: 'Nộp bài' }).click();

    // Xác minh trạng thái bài nộp
    await expect(svPage.getByText(/Đã nộp|SUBMITTED/i)).toBeVisible();
    await expect(svPage.getByText(`Tệp: ${uploadFiles.pdf.name}`)).toBeVisible();
    await expect(svPage.getByText('Số lần nộp: 1')).toBeVisible();

    // =========================================================================
    // Bước 3: Sinh viên nộp lại (ghi đè), kiểm tra số lần nộp tăng và tệp mới thay thế (US-08)
    // =========================================================================
    // Tải tệp ZIP mới để ghi đè bài nộp
    await svPage.locator('#assignment-file').setInputFiles(uploadFiles.zip.path);
    await svPage.getByRole('button', { name: 'Nộp lại bài' }).click();

    // Xác minh lịch sử cập nhật: số lần nộp là 2 và tệp mới đã thay thế tệp cũ
    await expect(svPage.getByText(`Tệp: ${uploadFiles.zip.name}`)).toBeVisible();
    await expect(svPage.getByText('Số lần nộp: 2')).toBeVisible();

    // =========================================================================
    // Bước 4: Giảng viên chấm điểm (thang 10, bước nhảy 0.25) và nhập nhận xét (US-09)
    // =========================================================================
    await gvPage.goto(`/courses/${courseId}/assignments/grading`);
    await expect(gvPage.getByRole('heading', { name: 'Chấm bài tập' })).toBeVisible();

    // Kiểm tra hàng nộp bài của sinh viên sv_nam
    await expect(gvPage.getByText('sv_nam')).toBeVisible();
    await expect(gvPage.getByText('Số lần nộp: 2')).toBeVisible();
    await expect(gvPage.getByRole('button', { name: 'Tải tệp bài nộp' })).toBeVisible();

    // Nhập điểm hợp lệ theo bước 0.25 và nhận xét có ký tự đặc biệt (đã sanitize)
    const scoreInput = gvPage.locator('#submission-score');
    await scoreInput.fill('8.75');
    const feedbackInput = gvPage.locator('#submission-feedback');
    await feedbackInput.fill('Bài làm tốt! <script>alert("xss")</script> Đạt yêu cầu xuất sắc.');

    await gvPage.getByRole('button', { name: 'Lưu điểm' }).click();

    // Kiểm tra trạng thái đã chuyển thành GRADED / Đã chấm
    await expect(gvPage.getByText(/Đã chấm|GRADED/i).first()).toBeVisible();

    // =========================================================================
    // Bước 5: Sinh viên xem điểm và nhận xét của mình trên bảng điểm cá nhân (US-13)
    // =========================================================================
    await svPage.goto(`/me/grades?courseId=${courseId}`);
    await expect(svPage.getByRole('heading', { name: 'Điểm của tôi' })).toBeVisible();
    await expect(svPage.getByRole('heading', { name: 'Điểm bài tập' })).toBeVisible();

    const gradeRow = svPage.locator('tr', { hasText: 'Bài tập lớn E2E' });
    await expect(gradeRow).toBeVisible();
    await expect(gradeRow).toContainText('8.75');
    await expect(gradeRow).toContainText('10');
    await expect(gradeRow).toContainText('Bài làm tốt!');
    // Đảm bảo mã độc script đã được sanitize sạch, không hiển thị thẻ thực thi
    await expect(gradeRow).not.toContainText('<script>');

    // =========================================================================
    // Bước 6: Giảng viên xem bảng điểm lớp và xuất CSV (US-14), kiểm tra tải tệp
    // =========================================================================
    await gvPage.goto(`/courses/${courseId}/grades`);
    await expect(gvPage.getByRole('heading', { name: 'Bảng điểm lớp' })).toBeVisible();

    const studentRow = gvPage.locator('tr', { hasText: 'sv_nam' });
    await expect(studentRow).toBeVisible();
    await expect(studentRow).toContainText('8.75');

    // Chờ sự kiện tải tệp CSV khi nhấn "Xuất CSV"
    const downloadPromise = gvPage.waitForEvent('download');
    await gvPage.getByRole('button', { name: 'Xuất CSV' }).click();
    const download = await downloadPromise;

    // Kiểm tra tên tệp tải về
    expect(download.suggestedFilename()).toMatch(/^BangDiem_.*\.csv$/);

    // Đọc luồng tệp tải về và xác minh nội dung
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const csvContent = Buffer.concat(chunks).toString('utf8');

    expect(csvContent).toContain('sv_nam');
    expect(csvContent).toContain('8.75');

    // Dọn dẹp tài nguyên context
    await gvContext.close();
    await svContext.close();
  });
});

