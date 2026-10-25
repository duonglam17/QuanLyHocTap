import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '@/shared/auth/authContext.js';
import { ApiError } from '@/shared/api/ApiError.js';
import * as scheduleApi from '../api/schedules.js';
import { ScheduleTab } from './ScheduleTab.jsx';

vi.mock('../api/schedules.js');

const mockSchedules = [
  {
    id: 101,
    courseId: 1,
    title: 'Buổi 1: Giới thiệu môn học',
    date: '2026-03-02',
    startTime: '08:00:00',
    endTime: '10:00:00',
    roomOrLink: 'Phòng 302-G2',
    status: 'SCHEDULED'
  },
  {
    id: 102,
    courseId: 1,
    title: 'Buổi 2: Kiến trúc phần mềm',
    date: '2026-03-09',
    startTime: '08:00:00',
    endTime: '10:00:00',
    roomOrLink: 'https://meet.google.com/abc-xyz',
    status: 'RESCHEDULED'
  }
];

function renderScheduleTab({
  courseId = 1,
  course = { id: 1, code: 'INT3306', status: 'PUBLISHED' },
  isOwner = true,
  user = { id: 2, role: 'GIANG_VIEN' }
} = {}) {
  return render(
    <AuthContext.Provider value={{ user, status: 'authenticated' }}>
      <MemoryRouter initialEntries={[`/courses/${courseId}`]}>
        <Routes>
          <Route
            element={<ScheduleTab course={course} courseId={courseId} isOwner={isOwner} />}
            path="/courses/:courseId"
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('ScheduleTab (US-17, EC-23)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton when fetching course schedules', () => {
    scheduleApi.listCourseSchedules.mockReturnValue(new Promise(() => {}));
    const { container } = renderScheduleTab();

    expect(screen.getByText('Lịch học và thời khóa biểu')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders error state and retries on failure', async () => {
    scheduleApi.listCourseSchedules.mockRejectedValueOnce(new Error('Máy chủ quá tải'));
    renderScheduleTab();

    expect(await screen.findByText('Máy chủ quá tải')).toBeInTheDocument();

    scheduleApi.listCourseSchedules.mockResolvedValueOnce({ schedules: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));

    await waitFor(() => {
      expect(scheduleApi.listCourseSchedules).toHaveBeenCalledTimes(2);
    });
  });

  it('renders empty state for instructor with add schedule button', async () => {
    scheduleApi.listCourseSchedules.mockResolvedValue({ schedules: [] });
    renderScheduleTab({ isOwner: true });

    expect(await screen.findByText('Chưa có lịch học')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lên lịch buổi học ngay' })).toBeInTheDocument();
  });

  it('renders empty state for student without management buttons', async () => {
    scheduleApi.listCourseSchedules.mockResolvedValue({ schedules: [] });
    renderScheduleTab({ isOwner: false, user: { id: 5, role: 'SINH_VIEN' } });

    expect(await screen.findByText('Chưa có lịch học')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lên lịch buổi học ngay' })).not.toBeInTheDocument();
  });

  it('renders list of schedules with date, time, room/link and status badges', async () => {
    scheduleApi.listCourseSchedules.mockResolvedValue({ schedules: mockSchedules });
    renderScheduleTab();

    expect(await screen.findByText('Buổi 1: Giới thiệu môn học')).toBeInTheDocument();
    expect(screen.getByText('Buổi 2: Kiến trúc phần mềm')).toBeInTheDocument();
    expect(screen.getByText('02/03/2026')).toBeInTheDocument();
    expect(screen.getByText('Phòng 302-G2')).toBeInTheDocument();
    expect(screen.getByText('https://meet.google.com/abc-xyz')).toBeInTheDocument();

    expect(screen.getByText('Đã lên lịch')).toBeInTheDocument();
    expect(screen.getByText('Đã đổi lịch')).toBeInTheDocument();
  });

  it('allows owner to create a new schedule and handles conflict (EC-23)', async () => {
    scheduleApi.listCourseSchedules.mockResolvedValue({ schedules: mockSchedules });
    renderScheduleTab({ isOwner: true });

    await screen.findByText('Buổi 1: Giới thiệu môn học');

    // Click "Lên lịch buổi học"
    const addBtn = screen.getByRole('button', { name: 'Lên lịch buổi học' });
    fireEvent.click(addBtn);

    expect(screen.getByRole('heading', { name: 'Lên lịch buổi học mới' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tiêu đề buổi học/), {
      target: { value: 'Buổi 3: Lập trình REST API' }
    });
    fireEvent.change(screen.getByLabelText(/Ngày học/), {
      target: { value: '2026-03-16' }
    });
    fireEvent.change(screen.getByLabelText(/Giờ bắt đầu/), {
      target: { value: '08:00' }
    });
    fireEvent.change(screen.getByLabelText(/Giờ kết thúc/), {
      target: { value: '10:00' }
    });
    fireEvent.change(screen.getByLabelText(/Phòng học/), {
      target: { value: 'Phòng 401-G2' }
    });

    // Case 1: Trùng giờ học (409 SCHEDULE_CONFLICT - EC-23)
    scheduleApi.createSchedule.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: 'SCHEDULE_CONFLICT',
        message: 'Khung giờ bị trùng với buổi học đã tồn tại trên hệ thống'
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'Lên lịch' }));

    expect(
      await screen.findByText('Khung giờ bị trùng với buổi học đã tồn tại trên hệ thống.')
    ).toBeInTheDocument();

    // Case 2: Tạo thành công
    scheduleApi.createSchedule.mockResolvedValueOnce({
      schedule: {
        id: 103,
        courseId: 1,
        title: 'Buổi 3: Lập trình REST API',
        date: '2026-03-16',
        startTime: '10:00:00',
        endTime: '12:00:00',
        roomOrLink: 'Phòng 401-G2',
        status: 'SCHEDULED'
      }
    });

    fireEvent.change(screen.getByLabelText(/Giờ bắt đầu/), {
      target: { value: '10:00' }
    });
    fireEvent.change(screen.getByLabelText(/Giờ kết thúc/), {
      target: { value: '12:00' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Lên lịch' }));

    await waitFor(() => {
      expect(scheduleApi.createSchedule).toHaveBeenCalledWith(1, {
        title: 'Buổi 3: Lập trình REST API',
        date: '2026-03-16',
        startTime: '10:00',
        endTime: '12:00',
        roomOrLink: 'Phòng 401-G2'
      });
    });
  });

  it('allows owner to edit a schedule', async () => {
    scheduleApi.listCourseSchedules.mockResolvedValue({ schedules: mockSchedules });
    renderScheduleTab({ isOwner: true });

    await screen.findByText('Buổi 1: Giới thiệu môn học');

    const editBtn = screen.getByRole('button', { name: 'Chỉnh sửa buổi học Buổi 1: Giới thiệu môn học' });
    fireEvent.click(editBtn);

    expect(screen.getByRole('heading', { name: 'Chỉnh sửa buổi học' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Phòng học/), {
      target: { value: 'Phòng 505-A2' }
    });

    scheduleApi.updateSchedule.mockResolvedValueOnce({
      schedule: {
        ...mockSchedules[0],
        roomOrLink: 'Phòng 505-A2'
      }
    });

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    await waitFor(() => {
      expect(scheduleApi.updateSchedule).toHaveBeenCalledWith(
        101,
        expect.objectContaining({ roomOrLink: 'Phòng 505-A2' })
      );
    });
  });

  it('allows owner to cancel a schedule via ConfirmDialog', async () => {
    scheduleApi.listCourseSchedules.mockResolvedValue({ schedules: mockSchedules });
    renderScheduleTab({ isOwner: true });

    await screen.findByText('Buổi 1: Giới thiệu môn học');

    const cancelTrigger = screen.getByRole('button', { name: 'Hủy buổi học Buổi 1: Giới thiệu môn học' });
    fireEvent.click(cancelTrigger);

    expect(screen.getByRole('heading', { name: 'Hủy buổi học' })).toBeInTheDocument();

    scheduleApi.cancelSchedule.mockResolvedValueOnce({
      schedule: { ...mockSchedules[0], status: 'CANCELLED' }
    });

    const confirmBtn = screen.getByRole('button', { name: 'Hủy buổi học' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(scheduleApi.cancelSchedule).toHaveBeenCalledWith(101);
    });
  });
});
