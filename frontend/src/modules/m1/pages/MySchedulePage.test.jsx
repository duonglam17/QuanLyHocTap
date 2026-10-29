import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import * as scheduleApi from '../api/schedules.js';
import { MySchedulePage } from './MySchedulePage.jsx';

vi.mock('../api/schedules.js');

const mockStudentSchedules = [
  {
    id: 201,
    courseId: 1,
    courseCode: 'INT3306',
    courseTitle: 'Phát triển ứng dụng Web',
    title: 'Buổi 1: Giới thiệu môn học',
    date: '2026-03-02',
    startTime: '08:00:00',
    endTime: '10:00:00',
    roomOrLink: 'Phòng 302-G2',
    status: 'SCHEDULED'
  },
  {
    id: 202,
    courseId: 2,
    courseCode: 'INT3307',
    courseTitle: 'An toàn thông tin',
    title: 'Buổi 1: Mã hóa khóa đối xứng',
    date: '2026-03-03',
    startTime: '13:00:00',
    endTime: '15:00:00',
    roomOrLink: 'https://meet.google.com/sec-room',
    status: 'RESCHEDULED'
  }
];

function renderMySchedulePage({ user = { id: 10, role: 'SINH_VIEN', fullName: 'Nguyễn Văn A' } } = {}) {
  return render(
    <AuthContext.Provider value={{ user, status: 'authenticated' }}>
      <MemoryRouter initialEntries={['/me/schedule']}>
        <MySchedulePage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('MySchedulePage (US-18)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when fetching timetable', () => {
    scheduleApi.listStudentSchedule.mockReturnValue(new Promise(() => {}));
    const { container } = renderMySchedulePage();

    expect(screen.getByText('Lịch học của tôi')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders error state and retries on failure', async () => {
    scheduleApi.listStudentSchedule.mockRejectedValueOnce(new Error('Lỗi tải thời khóa biểu'));
    renderMySchedulePage();

    expect(await screen.findByText('Lỗi tải thời khóa biểu')).toBeInTheDocument();

    scheduleApi.listStudentSchedule.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 10 });
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => {
      expect(scheduleApi.listStudentSchedule).toHaveBeenCalledTimes(2);
    });
  });

  it('renders empty state when student has no schedules', async () => {
    scheduleApi.listStudentSchedule.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });
    renderMySchedulePage();

    expect(await screen.findByText('Không có lịch học')).toBeInTheDocument();
    expect(
      screen.getByText('Bạn không có buổi học nào trong thời gian tới. Hãy ghi danh khóa học để cập nhật lịch học.')
    ).toBeInTheDocument();
  });

  it('renders timetable list with courseCode, courseTitle, date, time, and room/link', async () => {
    scheduleApi.listStudentSchedule.mockResolvedValue({
      items: mockStudentSchedules,
      total: 2,
      page: 1,
      limit: 10
    });
    renderMySchedulePage();

    expect(await screen.findByText('Buổi 1: Giới thiệu môn học')).toBeInTheDocument();
    expect(screen.getByText('Buổi 1: Mã hóa khóa đối xứng')).toBeInTheDocument();

    expect(screen.getByText('INT3306')).toBeInTheDocument();
    expect(screen.getByText('Khóa học: Phát triển ứng dụng Web')).toBeInTheDocument();
    expect(screen.getByText('02/03/2026')).toBeInTheDocument();
    expect(screen.getByText('Phòng 302-G2')).toBeInTheDocument();

    expect(screen.getByText('INT3307')).toBeInTheDocument();
    expect(screen.getByText('Khóa học: An toàn thông tin')).toBeInTheDocument();
    expect(screen.getByText('03/03/2026')).toBeInTheDocument();
    expect(screen.getByText('https://meet.google.com/sec-room')).toBeInTheDocument();

    // Verify status badges
    expect(screen.getByText('Đã lên lịch')).toBeInTheDocument();
    expect(screen.getByText('Đã đổi lịch')).toBeInTheDocument();
  });

  it('supports pagination when multiple pages of schedules exist', async () => {
    scheduleApi.listStudentSchedule.mockResolvedValue({
      items: mockStudentSchedules,
      total: 25,
      page: 1,
      limit: 10
    });
    renderMySchedulePage();

    expect(await screen.findByText('Buổi 1: Giới thiệu môn học')).toBeInTheDocument();

    // Check pagination exists
    const nav = screen.getByRole('navigation', { name: /phân trang/i });
    expect(nav).toBeInTheDocument();

    // Click next page ("Sau")
    const nextButton = screen.getByRole('button', { name: /Sau/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(scheduleApi.listStudentSchedule).toHaveBeenCalledWith({ page: 2, limit: 10 });
    });
  });

  it('handles HTTP errors (401, 403) and displays error state with retry', async () => {
    scheduleApi.listStudentSchedule.mockRejectedValueOnce(
      new Error('Phiên làm việc hết hạn hoặc bạn không có quyền xem thời khóa biểu')
    );
    renderMySchedulePage();

    expect(
      await screen.findByText('Phiên làm việc hết hạn hoặc bạn không có quyền xem thời khóa biểu')
    ).toBeInTheDocument();

    scheduleApi.listStudentSchedule.mockResolvedValueOnce({ items: [], total: 0 });
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => {
      expect(scheduleApi.listStudentSchedule).toHaveBeenCalledTimes(2);
    });
  });

  it('renders schedule item with null roomOrLink gracefully', async () => {
    const itemWithNullRoom = [
      {
        id: 205,
        courseId: 1,
        courseCode: 'INT3306',
        courseTitle: 'Phát triển ứng dụng Web',
        title: 'Buổi hướng dẫn tự học',
        date: '2026-03-10',
        startTime: '09:00:00',
        endTime: '11:00:00',
        roomOrLink: null,
        status: 'SCHEDULED'
      }
    ];
    scheduleApi.listStudentSchedule.mockResolvedValue({ items: itemWithNullRoom, total: 1, page: 1, limit: 10 });
    renderMySchedulePage();

    expect(await screen.findByText('Buổi hướng dẫn tự học')).toBeInTheDocument();
    expect(screen.getByText('INT3306')).toBeInTheDocument();
  });
});
