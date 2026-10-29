import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import { ApiError } from '@/shared/api/ApiError.js';
import * as slotsLib from '@/shared/lib/slots.js';
import * as lessonApi from '../api/lessons.js';
import { LessonDetailPage } from './LessonDetailPage.jsx';

vi.mock('../api/lessons.js');
vi.mock('@/shared/lib/slots.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getLessonSections: vi.fn().mockReturnValue([])
  };
});

const mockLesson = {
  id: 10,
  courseId: 101,
  title: 'Kiến trúc phần mềm và Clean Architecture',
  orderIndex: 1,
  content: 'Tổng quan về Separation of Concerns và Dependency Rule.',
  materials: []
};

const mockMaterials = [
  {
    id: 1001,
    lessonId: 10,
    title: 'Slide bài giảng Clean Architecture',
    originalName: 'clean-arch.pdf',
    size: 3145728,
    createdAt: '2026-03-05T08:00:00.000Z'
  }
];

function renderLessonDetailPage({
  lessonId = 10,
  lesson = mockLesson,
  isOwner = true,
  user = { id: 2, role: 'GIANG_VIEN' }
} = {}) {
  return render(
    <AuthContext.Provider value={{ user, status: 'authenticated' }}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: `/lessons/${lessonId}`,
            state: { lesson, courseId: lesson?.courseId, isOwner }
          }
        ]}
      >
        <Routes>
          <Route element={<LessonDetailPage />} path="/lessons/:lessonId" />
          <Route element={<p>Trang khóa học</p>} path="/courses/:courseId" />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('LessonDetailPage (US-05, US-06, Lesson Section Slots)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    slotsLib.getLessonSections.mockReturnValue([]);
  });

  it('renders lesson details, content and materials list', async () => {
    lessonApi.listMaterials.mockResolvedValue({ items: mockMaterials });
    renderLessonDetailPage();

    expect(screen.getByText('Kiến trúc phần mềm và Clean Architecture')).toBeInTheDocument();
    expect(screen.getByText('Bài 1')).toBeInTheDocument();
    expect(
      screen.getByText('Tổng quan về Separation of Concerns và Dependency Rule.')
    ).toBeInTheDocument();

    expect(await screen.findByText('Slide bài giảng Clean Architecture')).toBeInTheDocument();
    expect(screen.getByText(/3(\.0)? MB/)).toBeInTheDocument();
  });

  it('allows user to download a material', async () => {
    lessonApi.listMaterials.mockResolvedValue({ items: mockMaterials });
    renderLessonDetailPage();

    await screen.findByText('Slide bài giảng Clean Architecture');

    const downloadBtn = screen.getByRole('button', {
      name: 'Tải xuống tài liệu Slide bài giảng Clean Architecture'
    });
    lessonApi.downloadMaterial.mockResolvedValueOnce({});
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(lessonApi.downloadMaterial).toHaveBeenCalledWith(101, 1001);
    });
  });

  it('allows course owner to upload new material via MaterialUploadDialog', async () => {
    lessonApi.listMaterials.mockResolvedValue({ items: mockMaterials });
    renderLessonDetailPage({ isOwner: true });

    await screen.findByText('Slide bài giảng Clean Architecture');

    const uploadTrigger = screen.getByRole('button', { name: 'Tải lên tài liệu mới' });
    fireEvent.click(uploadTrigger);

    expect(screen.getByRole('heading', { name: 'Tải lên tài liệu học tập' })).toBeInTheDocument();

    const dummyFile = new File(['content'], 'sample.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/Chọn tệp tài liệu/);
    fireEvent.change(fileInput, { target: { files: [dummyFile] } });

    lessonApi.uploadMaterial.mockResolvedValueOnce({
      material: { id: 1002, title: 'sample', originalName: 'sample.pdf' }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tải lên' }));

    await waitFor(() => {
      expect(lessonApi.uploadMaterial).toHaveBeenCalledWith(
        '10',
        expect.objectContaining({ title: 'sample', file: dummyFile }),
        expect.any(Function)
      );
    });
  });

  it('renders slot extension sections from getLessonSections (Host for M3)', async () => {
    function MockDiscussionSection({ lessonId, role }) {
      return (
        <section data-testid="mock-discussion-section">
          <h3>Diễn đàn thảo luận bài học {lessonId}</h3>
          <p>Vai trò hiện tại: {role}</p>
        </section>
      );
    }

    slotsLib.getLessonSections.mockReturnValue([
      {
        id: 'discussion',
        order: 10,
        roles: ['ADMIN', 'GIANG_VIEN', 'SINH_VIEN'],
        Component: MockDiscussionSection
      }
    ]);

    lessonApi.listMaterials.mockResolvedValue({ items: mockMaterials });
    renderLessonDetailPage();

    expect(await screen.findByTestId('mock-discussion-section')).toBeInTheDocument();
    expect(screen.getByText('Diễn đàn thảo luận bài học 10')).toBeInTheDocument();
  });

  it('disables submit button and input fields while uploading material (trạng thái đang gửi)', async () => {
    lessonApi.listMaterials.mockResolvedValue({ items: [] });
    let resolveUpload;
    lessonApi.uploadMaterial.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      })
    );

    renderLessonDetailPage();

    const uploadTrigger = screen.getByRole('button', { name: 'Tải lên tài liệu mới' });
    fireEvent.click(uploadTrigger);

    const titleInput = screen.getByLabelText(/Tiêu đề tài liệu/);
    fireEvent.change(titleInput, { target: { value: 'Tài liệu mẫu' } });

    const dummyFile = new File(['data'], 'sample.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/Chọn tệp tài liệu/);
    fireEvent.change(fileInput, { target: { files: [dummyFile] } });

    const submitBtn = screen.getByRole('button', { name: 'Tải lên' });
    fireEvent.click(submitBtn);

    expect(screen.getByRole('button', { name: /Đang xử lý/ })).toBeDisabled();
    expect(titleInput).toBeDisabled();

    resolveUpload({ material: { id: 200, title: 'Tài liệu mẫu' } });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Tải lên tài liệu học tập' })).not.toBeInTheDocument();
    });
  });

  it('handles HTTP errors (403, 409, 413, 415) in MaterialUploadDialog', async () => {
    lessonApi.listMaterials.mockResolvedValue({ items: [] });
    renderLessonDetailPage();

    const uploadTrigger = screen.getByRole('button', { name: 'Tải lên tài liệu mới' });
    fireEvent.click(uploadTrigger);

    const titleInput = screen.getByLabelText(/Tiêu đề tài liệu/);
    fireEvent.change(titleInput, { target: { value: 'Tài liệu kiểm tra lỗi' } });

    const dummyFile = new File(['data'], 'test.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText(/Chọn tệp tài liệu/);
    fireEvent.change(fileInput, { target: { files: [dummyFile] } });

    const submitBtn = screen.getByRole('button', { name: 'Tải lên' });

    // 403 Forbidden
    lessonApi.uploadMaterial.mockRejectedValueOnce(
      new ApiError({ status: 403, message: 'Bạn không có quyền tải tài liệu cho bài học này.' })
    );
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Bạn không có quyền tải tài liệu cho bài học này.')).toBeInTheDocument();

    // 409 Conflict
    lessonApi.uploadMaterial.mockRejectedValueOnce(
      new ApiError({ status: 409, message: 'Khóa học đã lưu trữ, không thể tải thêm tài liệu.' })
    );
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Khóa học đã lưu trữ, không thể tải thêm tài liệu.')).toBeInTheDocument();

    // 413 Over 50MB
    lessonApi.uploadMaterial.mockRejectedValueOnce(
      new ApiError({ status: 413, message: 'Dung lượng tệp vượt quá giới hạn tối đa 50MB.' })
    );
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Dung lượng tệp vượt quá giới hạn tối đa 50MB.')).toBeInTheDocument();

    // 415 Unsupported media type
    lessonApi.uploadMaterial.mockRejectedValueOnce(
      new ApiError({ status: 415, message: 'Loại định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, DOCX, PPTX, ZIP, RAR.' })
    );
    fireEvent.click(submitBtn);
    expect(await screen.findByText('Loại định dạng tệp không được hỗ trợ. Chỉ chấp nhận PDF, DOCX, PPTX, ZIP, RAR.')).toBeInTheDocument();
  });

  it('renders lesson with null content gracefully without crashing', async () => {
    lessonApi.listMaterials.mockResolvedValue({ items: [] });
    renderLessonDetailPage({
      lesson: {
        id: 99,
        courseId: 101,
        title: 'Bài học không có nội dung',
        orderIndex: 5,
        content: null
      }
    });

    expect(await screen.findByText('Bài học không có nội dung')).toBeInTheDocument();
    expect(screen.getByText('Bài 5')).toBeInTheDocument();
  });
});
