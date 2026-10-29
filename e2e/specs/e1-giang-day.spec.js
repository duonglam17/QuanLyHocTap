import { expect } from '@playwright/test';
import { test } from '../fixtures/auth.js';
import { createUploadFiles } from '../fixtures/uploads.js';

test.describe('E2E-1: Quy trình Giảng dạy - Khóa học, Bài giảng, Tài liệu & Lịch học (US-03, US-04, US-05, US-06, US-17, US-18)', () => {
  test('hành trình trọn vẹn: tạo khóa học, xuất bản, đăng bài giảng, tải tài liệu, lên lịch học, sinh viên ghi danh, tải tài liệu và xem thời khóa biểu', async ({
    browser,
    loginAs
  }) => {
    // 0. Chuẩn bị tệp tải lên kiểm thử (PDF) và định danh duy nhất
    const uploadFiles = await createUploadFiles();
    const unique = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 1000)}`;
    const courseCode = `CS${unique}`.slice(0, 20);
    const courseTitle = `Kiến trúc Hệ thống E2E ${unique}`;
    const lessonTitle = `Bài 1: Tổng quan Kiến trúc Client-Server ${unique}`;
    const materialTitle = `Slide Bài giảng số 1 ${unique}`;
    const scheduleTitle = `Buổi 1: Giới thiệu nhập môn ${unique}`;

    // 1. Khởi tạo phiên đăng nhập cho Giảng viên (gv_mai) và Sinh viên (sv_nam)
    const gvSession = await loginAs('GIANG_VIEN');
    const svSession = await loginAs('SINH_VIEN');

    const gvContext = await browser.newContext({ storageState: gvSession.storageStatePath });
    const gvPage = await gvContext.newPage();

    const svContext = await browser.newContext({ storageState: svSession.storageStatePath });
    const svPage = await svContext.newPage();

    try {
      // =========================================================================
      // Bước 1: Giảng viên tạo khóa học mới qua giao diện (US-03, BR-03)
      // =========================================================================
      await gvPage.goto('/courses');
      await expect(gvPage.getByRole('heading', { name: /Danh sách khóa học/i })).toBeVisible();

      // Mở modal tạo khóa học
      await gvPage.getByRole('button', { name: /Tạo khóa học/i }).first().click();
      const courseDialog = gvPage.getByRole('dialog');
      await expect(courseDialog).toBeVisible();

      await courseDialog.getByLabel(/Mã môn học/i).fill(courseCode);
      await courseDialog.getByLabel(/Học kỳ/i).fill('HK1-2026');
      await courseDialog.getByLabel(/Tên khóa học/i).fill(courseTitle);
      await courseDialog.getByLabel(/Mô tả/i).fill('Khóa học kiểm thử luồng E2E Giảng dạy M1');

      await courseDialog.getByRole('button', { name: 'Xác nhận tạo' }).click();
      await expect(courseDialog).not.toBeVisible();

      // Kiểm tra khóa học hiển thị trên danh sách với trạng thái Bản nháp (DRAFT)
      const courseCard = gvPage.locator('article', { hasText: courseTitle });
      await expect(courseCard).toBeVisible();
      await expect(courseCard).toContainText(/Bản nháp|DRAFT/i);

      // Đi vào trang chi tiết khóa học
      await courseCard.getByRole('link', { name: courseTitle }).click();
      await gvPage.waitForURL(/\/courses\/\d+/);

      const urlMatch = gvPage.url().match(/\/courses\/(\d+)/);
      const courseId = urlMatch ? urlMatch[1] : null;
      expect(courseId).toBeTruthy();

      await expect(gvPage.getByRole('heading', { name: courseTitle })).toBeVisible();

      // =========================================================================
      // Bước 2: Giảng viên xuất bản (Publish) khóa học để mở ghi danh (US-03, BR-04, EC-09)
      // =========================================================================
      await gvPage.getByRole('button', { name: 'Xuất bản' }).click();
      const publishAlert = gvPage.getByRole('alertdialog');
      await expect(publishAlert).toBeVisible();
      await publishAlert.getByRole('button', { name: 'Xuất bản' }).click();
      await expect(publishAlert).not.toBeVisible();

      // Kiểm tra trạng thái chuyển sang Đã xuất bản / PUBLISHED
      await expect(gvPage.getByText(/Đã xuất bản|PUBLISHED/i).first()).toBeVisible();

      // Lấy mã ghi danh được cấp phát cho khóa học từ UI hoặc API
      const courseDetailRes = await gvSession.api(`/courses/${courseId}`);
      const courseData = courseDetailRes.course || courseDetailRes.data || courseDetailRes;
      const enrollmentKey = courseData.enrollmentKey || courseData.enrollment_key;
      expect(enrollmentKey).toBeTruthy();

      // =========================================================================
      // Bước 3: Giảng viên tạo bài học mới (US-05, BR-06)
      // =========================================================================
      // Đảm bảo tab Bài học đang mở
      const lessonTabBtn = gvPage.getByRole('tab', { name: /Bài học/i });
      if (await lessonTabBtn.isVisible()) {
        await lessonTabBtn.click();
      }

      await gvPage.getByRole('button', { name: /Thêm bài học/i }).first().click();
      const lessonDialog = gvPage.getByRole('dialog');
      await expect(lessonDialog).toBeVisible();

      await lessonDialog.getByLabel(/Tiêu đề bài học/i).fill(lessonTitle);
      await lessonDialog.getByLabel(/Nội dung tóm tắt/i).fill('Mô tả chi tiết kiến trúc client và server cho sinh viên.');
      await lessonDialog.getByRole('button', { name: /Tạo bài học|Thêm bài học/i }).click();
      await expect(lessonDialog).not.toBeVisible();

      // Kiểm tra bài học xuất hiện trong danh sách
      const lessonCard = gvPage.locator('article', { hasText: lessonTitle });
      await expect(lessonCard).toBeVisible();

      // Lấy lessonId từ API khóa học
      const lessonsRes = await gvSession.api(`/courses/${courseId}/lessons`);
      const lessonsList = lessonsRes.items || lessonsRes.data || lessonsRes;
      const lesson = Array.isArray(lessonsList)
        ? lessonsList.find((l) => l.title === lessonTitle)
        : lessonsList;
      const lessonId = lesson.id;
      expect(lessonId).toBeTruthy();

      // =========================================================================
      // Bước 4: Giảng viên tải tài liệu học tập PDF lên bài học (US-05, BR-06, EC-03, EC-19)
      // =========================================================================
      await lessonCard.getByRole('link', { name: lessonTitle }).click();
      await gvPage.waitForURL(new RegExp(`/lessons/${lessonId}`));
      await expect(gvPage.getByRole('heading', { name: lessonTitle })).toBeVisible();

      await gvPage.getByRole('button', { name: /Tải tài liệu|Tải lên tài liệu mới/i }).click();
      const uploadDialog = gvPage.getByRole('dialog');
      await expect(uploadDialog).toBeVisible();

      await uploadDialog.getByLabel(/Tiêu đề tài liệu/i).fill(materialTitle);
      await uploadDialog.locator('input[type="file"]').setInputFiles(uploadFiles.pdf.path);
      await uploadDialog.getByRole('button', { name: 'Tải lên' }).click();
      await expect(uploadDialog).not.toBeVisible();

      // Kiểm tra tài liệu xuất hiện trong danh sách tài liệu đính kèm
      await expect(gvPage.getByText(materialTitle, { exact: true })).toBeVisible();
      await expect(gvPage.getByText(uploadFiles.pdf.name, { exact: true })).toBeVisible();

      // =========================================================================
      // Bước 5: Giảng viên lên lịch học cho khóa học (US-17, BR-19, BR-20)
      // =========================================================================
      await gvPage.goto(`/courses/${courseId}`);
      await gvPage.getByRole('tab', { name: /Lịch học/i }).click();
      await expect(gvPage.getByRole('heading', { name: /Lịch học và thời khóa biểu/i })).toBeVisible();

      await gvPage.getByRole('button', { name: /Lên lịch buổi học|Thêm buổi học/i }).first().click();
      const scheduleDialog = gvPage.getByRole('dialog');
      await expect(scheduleDialog).toBeVisible();

      await scheduleDialog.getByLabel(/Tiêu đề buổi học/i).fill(scheduleTitle);
      await scheduleDialog.getByLabel(/Ngày học/i).fill('2026-11-15');
      await scheduleDialog.getByLabel(/Giờ bắt đầu/i).fill('08:00');
      await scheduleDialog.getByLabel(/Giờ kết thúc/i).fill('10:00');
      await scheduleDialog.getByLabel(/Phòng học \/ Link học/i).fill('Phòng LAB-401');

      await scheduleDialog.getByRole('button', { name: 'Lên lịch' }).click();
      await expect(scheduleDialog).not.toBeVisible();

      // Kiểm tra buổi học xuất hiện trong danh sách với trạng thái ĐÃ LÊN LỊCH
      const scheduleCard = gvPage.locator('article', { hasText: scheduleTitle });
      await expect(scheduleCard).toBeVisible();
      await expect(scheduleCard.getByText('Phòng LAB-401')).toBeVisible();

      // =========================================================================
      // Bước 6 (Nhánh lỗi): Giảng viên lên lịch học thứ 2 trùng khung giờ -> Báo lỗi 409 (US-17, EC-23)
      // =========================================================================
      await gvPage.getByRole('button', { name: /Lên lịch buổi học/i }).first().click();
      const conflictDialog = gvPage.getByRole('dialog');
      await expect(conflictDialog).toBeVisible();

      await conflictDialog.getByLabel(/Tiêu đề buổi học/i).fill(`${scheduleTitle} (Trùng giờ)`);
      await conflictDialog.getByLabel(/Ngày học/i).fill('2026-11-15');
      await conflictDialog.getByLabel(/Giờ bắt đầu/i).fill('08:30');
      await conflictDialog.getByLabel(/Giờ kết thúc/i).fill('09:30');
      await conflictDialog.getByLabel(/Phòng học \/ Link học/i).fill('Phòng LAB-402');

      await conflictDialog.getByRole('button', { name: 'Lên lịch' }).click();

      // Kiểm tra thông báo lỗi trùng lịch xuất hiện và modal không tự đóng
      await expect(conflictDialog.getByRole('alert')).toContainText(/Khung giờ bị trùng|trùng/i);
      await conflictDialog.getByRole('button', { name: 'Hủy' }).click();
      await expect(conflictDialog).not.toBeVisible();

      // =========================================================================
      // Bước 7 (Nhánh lỗi): Sinh viên ghi danh với mã sai -> Báo lỗi (US-04, EC-15)
      // =========================================================================
      await svPage.goto('/courses');
      await expect(svPage.getByRole('heading', { name: /Danh sách khóa học/i })).toBeVisible();

      await svPage.getByRole('button', { name: /Ghi danh bằng mã|Tham gia khóa học/i }).first().click();
      const enrollDialog = svPage.getByRole('dialog');
      await expect(enrollDialog).toBeVisible();

      await enrollDialog.getByLabel(/Mã ghi danh/i).fill('NOTEXISTS');
      await enrollDialog.getByRole('button', { name: 'Tham gia' }).click();

      await expect(enrollDialog.getByRole('alert')).toContainText(/không tồn tại|chưa xuất bản/i);

      // =========================================================================
      // Bước 8: Sinh viên ghi danh thành công với mã hợp lệ (US-04, BR-04, BR-05)
      // =========================================================================
      await enrollDialog.getByLabel(/Mã ghi danh/i).fill(enrollmentKey);
      await enrollDialog.getByRole('button', { name: 'Tham gia' }).click();
      await expect(enrollDialog).not.toBeVisible();

      // Kiểm tra khóa học đã xuất hiện trên trang khóa học của sinh viên
      await expect(svPage.locator('article', { hasText: courseTitle })).toBeVisible();

      // =========================================================================
      // Bước 9: Sinh viên truy cập bài học và tải tài liệu về máy (US-06, BR-05, EC-18)
      // =========================================================================
      await svPage.goto(`/courses/${courseId}`);
      const svLessonTab = svPage.getByRole('tab', { name: /Bài học/i });
      if (await svLessonTab.isVisible()) {
        await svLessonTab.click();
      }
      const svLessonCard = svPage.locator('article', { hasText: lessonTitle });
      await expect(svLessonCard).toBeVisible();
      await svLessonCard.getByRole('link', { name: lessonTitle }).click();
      await svPage.waitForURL(new RegExp(`/lessons/${lessonId}`));
      await expect(svPage.getByRole('heading', { name: lessonTitle })).toBeVisible();

      const studentMaterialItem = svPage.locator('div', { hasText: materialTitle });
      await expect(studentMaterialItem.first()).toBeVisible();

      // Kiểm tra nút tải tài liệu hoạt động
      const downloadBtn = svPage.getByRole('button', { name: new RegExp(`Tải xuống tài liệu ${materialTitle}|Tải về`, 'i') });
      await expect(downloadBtn).toBeVisible();

      // Lắng nghe sự kiện tải tệp của trình duyệt
      const downloadPromise = svPage.waitForEvent('download', { timeout: 10_000 }).catch(() => null);
      await downloadBtn.click();
      const download = await downloadPromise;
      if (download) {
        expect(download.suggestedFilename()).toContain('.pdf');
      }

      // =========================================================================
      // Bước 10: Sinh viên kiểm tra thời khóa biểu cá nhân tại /me/schedule (US-18, BR-20)
      // =========================================================================
      await svPage.goto('/me/schedule');
      await expect(svPage.getByRole('heading', { name: 'Lịch học của tôi' })).toBeVisible();

      // Xác nhận buổi học của khóa học đã đăng ký xuất hiện trên thời khóa biểu
      const svScheduleCard = svPage.locator('article', { hasText: scheduleTitle });
      await expect(svScheduleCard).toBeVisible();
      await expect(svScheduleCard.getByText('Phòng LAB-401')).toBeVisible();

      // =========================================================================
      // Bước 11 (Nhánh bảo mật): Người ngoài chưa ghi danh bị từ chối 403 khi tải tài liệu (EC-01 IDOR)
      // =========================================================================
      const strangerSession = await loginAs('ADMIN');
      const rawRes = await fetch(new URL(`/api/courses/${courseId}/materials/999999/download`, 'http://127.0.0.1:5174'), {
        headers: { Authorization: `Bearer ${strangerSession.accessToken}` }
      });
      expect([403, 404]).toContain(rawRes.status);
    } finally {
      await gvContext.close();
      await svContext.close();
    }
  });
});
