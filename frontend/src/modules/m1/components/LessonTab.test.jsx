import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import * as lessonApi from '../api/lessons.js';
import { LessonTab } from './LessonTab.jsx';

vi.mock('../api/lessons.js');

const mockLessons = [
  {
    id: 10,
    courseId: 101,
    title: 'Bài 1: Giới thiệu khóa học',
    orderIndex: 1,
    content: 'Nội dung bài mở đầu về kiến trúc phần mềm.',
    materials: [
      {
        id: 1001,
        lessonId: 10,
        title: 'Slide Giới thiệu',
        originalName: 'slide-intro.pdf',
        size: 2048576,
        createdAt: '2026-03-01T10:00:00.000Z'
      }
    ]
  },
  {
    id: 20,
    courseId: 101,
    title: 'Bài 2: Thực hành REST API',
    orderIndex: 2,
    content: 'Hướng dẫn cài đặt Express và kết nối cơ sở dữ liệu.',
    materials: []
  }
];

function renderLessonTab({
  courseId = 101,
  course = { id: 101, status: 'PUBLISHED' },
  isOwner = true,
  user = { id: 2, role: 'GIANG_VIEN' }
} = {}) {
  return render(
    <AuthContext.Provider value={{ user, status: 'authenticated' }}>
      <MemoryRouter initialEntries={[`/courses/${courseId}`]}>
        <Routes>
          <Route
            element={<LessonTab course={course} courseId={courseId} isOwner={isOwner} />}
            path="/courses/:courseId"
          />
          <Route element={<p>Chi tiết bài học</p>} path="/lessons/:lessonId" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('LessonTab (US-05, US-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when fetching lessons', () => {
    lessonApi.listLessons.mockReturnValue(new Promise(() => {}));
    const { container } = renderLessonTab();

    expect(screen.getByText('Danh sách bài học')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders error state and retries on failure', async () => {
    lessonApi.listLessons.mockRejectedValueOnce(new Error('Lỗi kết nối máy chủ'));
    renderLessonTab();

    expect(await screen.findByText('Lỗi kết nối máy chủ')).toBeInTheDocument();

    lessonApi.listLessons.mockResolvedValueOnce({ items: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => {
      expect(lessonApi.listLessons).toHaveBeenCalledTimes(2);
    });
  });

  it('renders empty state for instructor with add lesson button', async () => {
    lessonApi.listLessons.mockResolvedValue({ items: [] });
    renderLessonTab({ isOwner: true });

    expect(await screen.findByText('Chưa có bài học nào')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm bài học mới' })).toBeInTheDocument();
  });

  it('renders empty state for students without management buttons', async () => {
    lessonApi.listLessons.mockResolvedValue({ items: [] });
    renderLessonTab({ isOwner: false, user: { id: 3, role: 'SINH_VIEN' } });

    expect(await screen.findByText('Chưa có bài học nào')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm bài học mới' })).not.toBeInTheDocument();
  });

  it('renders list of lessons and materials with download option', async () => {
    lessonApi.listLessons.mockResolvedValue({ items: mockLessons });
    renderLessonTab();

    expect(await screen.findByText('Bài 1: Giới thiệu khóa học')).toBeInTheDocument();
    expect(screen.getByText('Bài 2: Thực hành REST API')).toBeInTheDocument();
    expect(screen.getByText('Slide Giới thiệu')).toBeInTheDocument();
    expect(screen.getByText(/2(\.0)? MB/)).toBeInTheDocument();

    // Student / instructor can download
    const downloadBtn = screen.getByRole('button', { name: 'Tải xuống tài liệu Slide Giới thiệu' });
    lessonApi.downloadMaterial.mockResolvedValueOnce({});
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(lessonApi.downloadMaterial).toHaveBeenCalledWith(101, 1001);
    });
  });

  it('allows course owner to create a new lesson via LessonFormDialog', async () => {
    lessonApi.listLessons.mockResolvedValue({ items: mockLessons });
    renderLessonTab({ isOwner: true });

    await screen.findByText('Bài 1: Giới thiệu khóa học');

    const addBtn = screen.getByRole('button', { name: 'Thêm bài học' });
    fireEvent.click(addBtn);

    expect(screen.getByRole('heading', { name: 'Thêm bài học mới' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tiêu đề bài học/), {
      target: { value: 'Bài 3: Thiết kế cơ sở dữ liệu' }
    });
    fireEvent.change(screen.getByLabelText(/Nội dung tóm tắt/), {
      target: { value: 'Mô hình quan hệ và chuẩn hóa dữ liệu.' }
    });

    lessonApi.createLesson.mockResolvedValueOnce({
      lesson: {
        id: 30,
        courseId: 101,
        title: 'Bài 3: Thiết kế cơ sở dữ liệu',
        orderIndex: 3
      }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tạo bài học' }));

    await waitFor(() => {
      expect(lessonApi.createLesson).toHaveBeenCalledWith(101, {
        title: 'Bài 3: Thiết kế cơ sở dữ liệu',
        orderIndex: 3,
        content: 'Mô hình quan hệ và chuẩn hóa dữ liệu.'
      });
    });
  });

  it('allows course owner to upload a material via MaterialUploadDialog', async () => {
    lessonApi.listLessons.mockResolvedValue({ items: mockLessons });
    renderLessonTab({ isOwner: true });

    await screen.findByText('Bài 2: Thực hành REST API');

    const addMaterialBtn = screen.getByRole('button', {
      name: 'Thêm tài liệu cho bài Bài 2: Thực hành REST API'
    });
    fireEvent.click(addMaterialBtn);

    expect(screen.getByRole('heading', { name: 'Tải lên tài liệu học tập' })).toBeInTheDocument();

    const dummyFile = new File(['mock content'], 'lab2-guide.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/Chọn tệp tài liệu/);
    fireEvent.change(fileInput, { target: { files: [dummyFile] } });

    lessonApi.uploadMaterial.mockResolvedValueOnce({
      material: {
        id: 2001,
        title: 'lab2-guide',
        originalName: 'lab2-guide.pdf'
      }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tải lên' }));

    await waitFor(() => {
      expect(lessonApi.uploadMaterial).toHaveBeenCalledWith(
        20,
        expect.objectContaining({ title: 'lab2-guide', file: dummyFile }),
        expect.any(Function)
      );
    });
  });
});
