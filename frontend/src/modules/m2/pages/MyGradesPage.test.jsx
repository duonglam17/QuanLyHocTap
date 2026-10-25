import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as gradesApi from '../api/grades.js';
import courseTabs from '../course-tabs.jsx';
import { MyGradesPage } from './MyGradesPage.jsx';

vi.mock('../api/grades.js', () => ({
  getMyCourseGrades: vi.fn(),
  listCoursesForGrades: vi.fn()
}));

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterAll(() => {
  if (originalScrollIntoView) {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  } else {
    delete HTMLElement.prototype.scrollIntoView;
  }
});

const courses = [
  { id: 12, code: 'CS101', title: 'Nhập môn lập trình' },
  { id: 18, code: 'CS202', title: 'Cấu trúc dữ liệu' }
];

function renderPage(route = '/me/grades') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <MyGradesPage />
    </MemoryRouter>
  );
}

function gradebook(assignments = [], quizzes = []) {
  return { course_id: 12, assignments, quizzes };
}

describe('MyGradesPage (US-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading while courses are being fetched', () => {
    gradesApi.listCoursesForGrades.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải khóa học');
  });

  it('registers a student-only Điểm tab in course details', () => {
    expect(courseTabs).toContainEqual(
      expect.objectContaining({
        id: 'grades',
        label: 'Điểm',
        roles: ['SINH_VIEN']
      })
    );
  });

  it('shows an actionable error state when course loading fails', async () => {
    gradesApi.listCoursesForGrades.mockRejectedValue(new Error('Không tải được khóa học.'));

    renderPage();

    expect(await screen.findByText('Không tải được khóa học.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('shows an empty state when the student has no courses', async () => {
    gradesApi.listCoursesForGrades.mockResolvedValue({ items: [] });

    renderPage();

    expect(await screen.findByText('Bạn chưa tham gia khóa học nào')).toBeInTheDocument();
  });

  it('shows an empty gradebook for a selected course', async () => {
    gradesApi.listCoursesForGrades.mockResolvedValue({ items: courses });
    gradesApi.getMyCourseGrades.mockResolvedValue(gradebook());

    renderPage();

    expect(await screen.findByText('Chưa có điểm')).toBeInTheDocument();
    expect(gradesApi.getMyCourseGrades).toHaveBeenCalledWith(12);
  });

  it('shows published quiz scores and preserves missing scores as "Chưa có"', async () => {
    gradesApi.listCoursesForGrades.mockResolvedValue({ items: courses });
    gradesApi.getMyCourseGrades.mockResolvedValue(
      gradebook(
        [
          {
            type: 'ASSIGNMENT',
            id: 4,
            title: 'Bài tập tuần 1',
            score: null,
            maxScore: 10,
            status: 'SUBMITTED'
          }
        ],
        [
          {
            type: 'QUIZ',
            id: 8,
            title: 'Kiểm tra chương 1',
            score: 8.5,
            maxScore: 10,
            status: 'SUBMITTED'
          }
        ]
      )
    );

    renderPage();

    expect(await screen.findByText('Bài tập tuần 1')).toBeInTheDocument();
    expect(screen.getByText('Kiểm tra chương 1')).toBeInTheDocument();
    const assignmentRow = screen.getByRole('row', { name: /Bài tập tuần 1/ });
    expect(within(assignmentRow).getAllByText('Chưa có')).toHaveLength(2);
    expect(screen.getByText('8,5')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(
      'Điểm trắc nghiệm chưa được mở để xem sẽ không hiển thị.'
    );
  });

  it('lets the student switch courses', async () => {
    const user = userEvent.setup();
    gradesApi.listCoursesForGrades.mockResolvedValue({ items: courses });
    gradesApi.getMyCourseGrades.mockResolvedValue(gradebook());

    renderPage();

    const courseSelector = await screen.findByRole('combobox', { name: 'Khóa học' });
    fireEvent.keyDown(courseSelector, { key: 'ArrowDown' });
    await screen.findByRole('option', { name: 'CS202 - Cấu trúc dữ liệu' });
    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => {
      expect(gradesApi.getMyCourseGrades).toHaveBeenCalledWith(18);
    });
  });

  it('shows a retryable error when the gradebook request fails', async () => {
    gradesApi.listCoursesForGrades.mockResolvedValue({ items: courses });
    gradesApi.getMyCourseGrades.mockRejectedValue(new Error('Không tải được bảng điểm.'));

    renderPage();

    expect(await screen.findByText('Không tải được bảng điểm.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });
});
