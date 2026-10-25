import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import { ApiError } from '@/shared/api/ApiError.js';
import * as courseApi from '../api/courses.js';
import { CoursesPage } from './CoursesPage.jsx';

vi.mock('../api/courses.js');

function renderCoursesPage({
  user = { id: 2, role: 'GIANG_VIEN', fullName: 'Cô Mai' }
} = {}) {
  return render(
    <AuthContext.Provider value={{ user, status: 'authenticated', login: vi.fn(), logout: vi.fn() }}>
      <MemoryRouter initialEntries={['/courses']}>
        <Routes>
          <Route element={<CoursesPage />} path="/courses" />
          <Route element={<p>Chi tiết khóa học</p>} path="/courses/:courseId" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('CoursesPage (US-03, US-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state with skeleton cards', () => {
    courseApi.listCourses.mockReturnValue(new Promise(() => {}));
    const { container } = renderCoursesPage();

    expect(screen.getByText('Danh sách khóa học')).toBeInTheDocument();
    // Skeleton elements exist
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders error state when fetching courses fails and allows retry', async () => {
    courseApi.listCourses.mockRejectedValueOnce(new Error('Máy chủ gặp sự cố kết nối'));
    renderCoursesPage();

    expect(await screen.findByText('Máy chủ gặp sự cố kết nối')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Thử lại' });
    expect(retryButton).toBeInTheDocument();

    courseApi.listCourses.mockResolvedValueOnce({ items: [] });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(courseApi.listCourses).toHaveBeenCalledTimes(2);
    });
  });

  it('renders empty state for instructor with Create Course button', async () => {
    courseApi.listCourses.mockResolvedValue({ items: [] });
    renderCoursesPage({ user: { id: 2, role: 'GIANG_VIEN' } });

    expect(await screen.findByText('Chưa có khóa học nào')).toBeInTheDocument();
    expect(screen.getByText('Bắt đầu tạo khóa học mới để chia sẻ bài giảng và quản lý sinh viên.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạo khóa học mới' })).toBeInTheDocument();
  });

  it('renders empty state for student with Join Course button', async () => {
    courseApi.listCourses.mockResolvedValue({ items: [] });
    renderCoursesPage({ user: { id: 5, role: 'SINH_VIEN' } });

    expect(await screen.findByText('Chưa ghi danh khóa học nào')).toBeInTheDocument();
    expect(screen.getByText('Hãy nhập mã ghi danh do giảng viên cung cấp để tham gia lớp học.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tham gia khóa học' })).toBeInTheDocument();
  });

  it('renders list of courses with StatusBadge and allows copying enrollment key', async () => {
    const mockCourses = [
      {
        id: 101,
        code: 'INT3101',
        title: 'Lập trình Web nâng cao',
        semester: 'HK1-2026',
        description: 'Môn học chuyên sâu về Fullstack',
        ownerId: 2,
        status: 'PUBLISHED',
        enrollment_key: 'WEB2026'
      },
      {
        id: 102,
        code: 'CS102',
        title: 'Cấu trúc dữ liệu',
        semester: 'HK1-2026',
        description: 'Nhập môn giải thuật',
        ownerId: 2,
        status: 'DRAFT',
        enrollment_key: 'CS102KEY'
      }
    ];
    courseApi.listCourses.mockResolvedValue({ items: mockCourses });

    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });

    renderCoursesPage({ user: { id: 2, role: 'GIANG_VIEN' } });

    expect(await screen.findByText('Lập trình Web nâng cao')).toBeInTheDocument();
    expect(screen.getByText('Cấu trúc dữ liệu')).toBeInTheDocument();
    expect(screen.getByText('Đang mở')).toBeInTheDocument(); // StatusBadge PUBLISHED
    expect(screen.getByText('Bản nháp')).toBeInTheDocument(); // StatusBadge DRAFT

    // Sao chép mã ghi danh
    const copyButtons = screen.getAllByRole('button', { name: 'Sao chép mã ghi danh' });
    expect(copyButtons.length).toBeGreaterThan(0);
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('WEB2026');
    });
  });

  it('allows instructor to create a new course via CourseFormDialog', async () => {
    courseApi.listCourses.mockResolvedValue({ items: [] });
    courseApi.createCourse.mockResolvedValue({
      course: {
        id: 200,
        code: 'INT3306',
        title: 'Phát triển ứng dụng Web',
        semester: 'HK2-2026',
        ownerId: 2,
        status: 'DRAFT',
        enrollment_key: 'WEB3306'
      }
    });

    renderCoursesPage({ user: { id: 2, role: 'GIANG_VIEN' } });

    const createButton = await screen.findByRole('button', { name: 'Tạo khóa học mới' });
    fireEvent.click(createButton);

    expect(screen.getByRole('heading', { name: 'Tạo khóa học mới' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Mã môn học/), { target: { value: 'INT3306' } });
    fireEvent.change(screen.getByLabelText(/Tên khóa học/), { target: { value: 'Phát triển ứng dụng Web' } });
    fireEvent.change(screen.getByLabelText(/Học kỳ/), { target: { value: 'HK2-2026' } });

    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận tạo' }));

    await waitFor(() => {
      expect(courseApi.createCourse).toHaveBeenCalledWith({
        code: 'INT3306',
        title: 'Phát triển ứng dụng Web',
        semester: 'HK2-2026',
        description: null
      });
    });
  });

  it('allows student to join a course with enrollment key and handles errors', async () => {
    courseApi.listCourses.mockResolvedValue({ items: [] });
    renderCoursesPage({ user: { id: 5, role: 'SINH_VIEN' } });

    const enrollButton = await screen.findByRole('button', { name: 'Tham gia khóa học' });
    fireEvent.click(enrollButton);

    expect(screen.getByRole('heading', { name: 'Tham gia khóa học' })).toBeInTheDocument();

    const inputKey = screen.getByLabelText(/Mã ghi danh/);
    const submitEnroll = screen.getByRole('button', { name: 'Tham gia' });

    // Trường hợp 404
    courseApi.enrollByCode.mockRejectedValueOnce(
      new ApiError({ status: 404, message: 'Mã ghi danh không tồn tại hoặc chưa xuất bản' })
    );
    fireEvent.change(inputKey, { target: { value: 'SAI999' } });
    fireEvent.click(submitEnroll);

    expect(await screen.findByText('Mã ghi danh không tồn tại hoặc chưa xuất bản')).toBeInTheDocument();

    // Trường hợp 409
    courseApi.enrollByCode.mockRejectedValueOnce(
      new ApiError({ status: 409, message: 'Bạn đã là thành viên của khóa học này' })
    );
    fireEvent.click(submitEnroll);
    expect(await screen.findByText('Bạn đã là thành viên của khóa học này')).toBeInTheDocument();

    // Trường hợp 429 (EC-22)
    courseApi.enrollByCode.mockRejectedValueOnce(
      new ApiError({ status: 429, code: 'RATE_LIMIT', message: 'Rate limit' })
    );
    fireEvent.click(submitEnroll);
    expect(await screen.findByText('Bạn đã thử quá nhiều lần, vui lòng đợi 1 phút')).toBeInTheDocument();

    // Thành công
    courseApi.enrollByCode.mockResolvedValueOnce({
      message: 'Ghi danh khóa học thành công',
      courseId: 101
    });
    fireEvent.change(inputKey, { target: { value: 'WEB2026' } });
    fireEvent.click(submitEnroll);

    await waitFor(() => {
      expect(courseApi.enrollByCode).toHaveBeenCalledWith('WEB2026');
    });
  });
});
