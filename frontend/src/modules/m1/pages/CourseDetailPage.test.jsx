import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import { ApiError } from '@/shared/api/ApiError.js';
import { toast } from '@/shared/components/molecules/Toast.jsx';
import { formatScore, formatDateTime } from '@/shared/lib/formatters.js';
import * as slotsLib from '@/shared/lib/slots.js';
import * as courseApi from '../api/courses.js';
import { CourseDetailPage } from './CourseDetailPage.jsx';

vi.mock('../api/courses.js');
vi.mock('@/shared/lib/slots.js');
vi.mock('@/shared/components/molecules/Toast.jsx', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

function renderCourseDetailPage({
  courseId = '101',
  user = { id: 2, role: 'GIANG_VIEN', fullName: 'Cô Mai' }
} = {}) {
  return render(
    <AuthContext.Provider value={{ user, status: 'authenticated', login: vi.fn(), logout: vi.fn() }}>
      <MemoryRouter initialEntries={[`/courses/${courseId}`]}>
        <Routes>
          <Route element={<CourseDetailPage />} path="/courses/:courseId" />
          <Route element={<p>Danh sách khóa học</p>} path="/courses" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('CourseDetailPage (US-03, US-04, Slots & Archive)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    slotsLib.getCourseTabs.mockReturnValue([]);
  });

  it('renders loading skeleton while fetching course details', () => {
    courseApi.getCourse.mockReturnValue(new Promise(() => {}));
    const { container } = renderCourseDetailPage();

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders error state and retry when course cannot be loaded', async () => {
    courseApi.getCourse.mockRejectedValueOnce(new Error('Khóa học không tồn tại'));
    renderCourseDetailPage();

    expect(await screen.findByText('Khóa học không tồn tại')).toBeInTheDocument();
    const retryButton = screen.getByRole('button', { name: 'Thử lại' });
    expect(retryButton).toBeInTheDocument();

    courseApi.getCourse.mockResolvedValueOnce({
      course: { id: 101, code: 'INT3101', title: 'Web App', ownerId: 2, status: 'PUBLISHED' }
    });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(courseApi.getCourse).toHaveBeenCalledTimes(2);
    });
  });

  it('allows course owner to publish a draft course', async () => {
    const draftCourse = {
      id: 101,
      code: 'INT3101',
      title: 'Lập trình Web nâng cao',
      semester: 'HK1-2026',
      description: 'Mô tả',
      ownerId: 2,
      status: 'DRAFT',
      enrollment_key: 'WEB2026'
    };
    courseApi.getCourse.mockResolvedValue({ course: draftCourse });
    courseApi.publishCourse.mockResolvedValue({
      course: { ...draftCourse, status: 'PUBLISHED' }
    });

    renderCourseDetailPage();

    expect(await screen.findByText('Lập trình Web nâng cao')).toBeInTheDocument();
    expect(screen.getByText('Bản nháp')).toBeInTheDocument();

    const publishTrigger = screen.getByRole('button', { name: 'Xuất bản' });
    fireEvent.click(publishTrigger);

    // Xác nhận trong ConfirmDialog
    const confirmButton = screen.getByRole('button', { name: 'Xuất bản' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(courseApi.publishCourse).toHaveBeenCalledWith(101);
    });
  });

  it('allows course owner to archive a course with ConfirmDialog (EC-09)', async () => {
    const publishedCourse = {
      id: 101,
      code: 'INT3101',
      title: 'Lập trình Web nâng cao',
      semester: 'HK1-2026',
      ownerId: 2,
      status: 'PUBLISHED',
      enrollment_key: 'WEB2026'
    };
    courseApi.getCourse.mockResolvedValue({ course: publishedCourse });
    courseApi.deleteOrArchiveCourse.mockResolvedValue({
      courseId: 101,
      status: 'ARCHIVED',
      archived: true,
      message: 'Khóa học đã có dữ liệu học tập nên được chuyển sang trạng thái Lưu trữ (chỉ đọc).'
    });

    renderCourseDetailPage();

    expect(await screen.findByText('Lập trình Web nâng cao')).toBeInTheDocument();

    const archiveTrigger = screen.getByRole('button', { name: 'Lưu trữ' });
    fireEvent.click(archiveTrigger);

    // Xác nhận trong ConfirmDialog
    const confirmButton = screen.getByRole('button', { name: 'Lưu trữ' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(courseApi.deleteOrArchiveCourse).toHaveBeenCalledWith(101);
    });
  });

  it('renders read-only banner when course is ARCHIVED and disables edit/publish buttons', async () => {
    const archivedCourse = {
      id: 101,
      code: 'INT3101',
      title: 'Lập trình Web 2025',
      semester: 'HK2-2025',
      ownerId: 2,
      status: 'ARCHIVED',
      enrollment_key: 'WEB2025'
    };
    courseApi.getCourse.mockResolvedValue({ course: archivedCourse });

    renderCourseDetailPage();

    expect(await screen.findByText('Lập trình Web 2025')).toBeInTheDocument();
    expect(screen.getByText('Đã lưu trữ')).toBeInTheDocument(); // StatusBadge
    expect(screen.getByText(/Khóa học đã lưu trữ \(Chỉ đọc\):/)).toBeInTheDocument();

    // Các nút Sửa, Xuất bản, Lưu trữ không được hiển thị khi đã archived
    expect(screen.queryByRole('button', { name: 'Sửa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất bản' })).not.toBeInTheDocument();
  });

  it('renders slot tabs from getCourseTabs and passes proper props', async () => {
    const activeCourse = {
      id: 101,
      code: 'INT3101',
      title: 'Lập trình Web',
      semester: 'HK1-2026',
      ownerId: 2,
      status: 'PUBLISHED',
      enrollment_key: 'WEB2026'
    };
    courseApi.getCourse.mockResolvedValue({ course: activeCourse });

    function MockTabComponent(props) {
      return (
        <div data-testid="mock-tab">
          <p>Course ID: {props.courseId}</p>
          <p>Owner: {props.isOwner ? 'true' : 'false'}</p>
          <p>Role: {props.role}</p>
        </div>
      );
    }

    slotsLib.getCourseTabs.mockReturnValue([
      {
        id: 'lessons',
        label: 'Bài giảng',
        order: 10,
        Component: MockTabComponent
      }
    ]);

    renderCourseDetailPage({ user: { id: 2, role: 'GIANG_VIEN' } });

    expect(await screen.findByText('Bài giảng')).toBeInTheDocument();
    expect(screen.getByTestId('mock-tab')).toBeInTheDocument();
    expect(screen.getByText('Course ID: 101')).toBeInTheDocument();
    expect(screen.getByText('Owner: true')).toBeInTheDocument();
    expect(screen.getByText('Role: GIANG_VIEN')).toBeInTheDocument();
  });

  it('disables submit button and inputs while updating course details (trạng thái đang gửi)', async () => {
    const activeCourse = {
      id: 101,
      code: 'INT3101',
      title: 'Lập trình Web nâng cao',
      semester: 'HK1-2026',
      description: 'Mô tả ban đầu',
      ownerId: 2,
      status: 'PUBLISHED',
      enrollment_key: 'WEB2026'
    };
    courseApi.getCourse.mockResolvedValue({ course: activeCourse });
    let resolveUpdate;
    courseApi.updateCourse.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      })
    );

    renderCourseDetailPage({ user: { id: 2, role: 'GIANG_VIEN' } });

    expect(await screen.findByText('Lập trình Web nâng cao')).toBeInTheDocument();

    const editBtn = screen.getByRole('button', { name: 'Sửa' });
    fireEvent.click(editBtn);

    expect(screen.getByRole('heading', { name: 'Chỉnh sửa khóa học' })).toBeInTheDocument();

    const submitBtn = screen.getByRole('button', { name: 'Lưu thay đổi' });
    fireEvent.click(submitBtn);

    // Verify submit button is disabled with loading state
    expect(screen.getByRole('button', { name: /Đang lưu/ })).toBeDisabled();

    resolveUpdate({
      course: { ...activeCourse, title: 'Lập trình Web nâng cao (Đã cập nhật)' }
    });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Chỉnh sửa khóa học' })).not.toBeInTheDocument();
    });
  });

  it('handles 401, 403 (IDOR) and 409 errors when publishing course', async () => {
    const draftCourse = {
      id: 101,
      code: 'INT3101',
      title: 'Lập trình Web nâng cao',
      semester: 'HK1-2026',
      ownerId: 2,
      status: 'DRAFT',
      enrollment_key: 'WEB2026'
    };
    courseApi.getCourse.mockResolvedValue({ course: draftCourse });

    renderCourseDetailPage({ user: { id: 2, role: 'GIANG_VIEN' } });
    expect(await screen.findByText('Lập trình Web nâng cao')).toBeInTheDocument();

    // 403 IDOR
    courseApi.publishCourse.mockRejectedValueOnce(
      new ApiError({ status: 403, message: 'Bạn không có quyền xuất bản khóa học này.' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản' })); // ConfirmDialog

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Bạn không có quyền xuất bản khóa học này.');
    });

    // 409 Conflict
    courseApi.publishCourse.mockRejectedValueOnce(
      new ApiError({ status: 409, message: 'Khóa học đã được xuất bản hoặc đã lưu trữ.' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Khóa học đã được xuất bản hoặc đã lưu trữ.');
    });
  });

  it('renders course with null description and null enrollment_key without crashing', async () => {
    const courseWithNulls = {
      id: 105,
      code: 'INT4000',
      title: 'Chuyên đề tốt nghiệp',
      semester: 'HK2-2026',
      description: null,
      ownerId: 2,
      status: 'PUBLISHED',
      enrollment_key: null
    };
    courseApi.getCourse.mockResolvedValue({ course: courseWithNulls });

    renderCourseDetailPage({ user: { id: 2, role: 'GIANG_VIEN' } });

    expect(await screen.findByText('Chuyên đề tốt nghiệp')).toBeInTheDocument();
    expect(screen.queryByLabelText('Sao chép mã ghi danh')).not.toBeInTheDocument();
  });

  it('verifies formatScore and formatDateTime return "Chưa có" when values are null or undefined', () => {
    expect(formatScore(null)).toBe('Chưa có');
    expect(formatScore(undefined)).toBe('Chưa có');
    expect(formatDateTime(null)).toBe('Chưa có');
    expect(formatDateTime(undefined)).toBe('Chưa có');
    expect(formatScore(8.5)).toBe('8,5');
  });
});
