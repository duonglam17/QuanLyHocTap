import React from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Users, Calendar, FileText, CheckSquare, MessageSquare, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';

export function RoleSidebar({ role }) {
  // Menu items theo vai trò được định nghĩa trong PRD và flows.md
  const navItemsByRole = {
    ADMIN: [
      { to: '/admin/users', label: 'Quản lý Người dùng (M1)', icon: Users },
      { to: '/admin/courses', label: 'Quản lý Khóa học (M1)', icon: BookOpen },
    ],
    GIANG_VIEN: [
      { to: '/instructor/courses', label: 'Khóa học phụ trách (M1)', icon: BookOpen },
      { to: '/instructor/schedules', label: 'Lịch giảng dạy (M1)', icon: Calendar },
      { to: '/instructor/assignments', label: 'Quản lý Bài tập (M2)', icon: FileText },
      { to: '/instructor/gradebook', label: 'Bảng điểm lớp học (M2)', icon: CheckSquare },
      { to: '/instructor/quizzes', label: 'Đề thi trắc nghiệm (M3)', icon: CheckSquare },
      { to: '/instructor/announcements', label: 'Bảng tin thông báo (M3)', icon: Bell },
    ],
    SINH_VIEN: [
      { to: '/student/my-courses', label: 'Khóa học của tôi (M1)', icon: BookOpen },
      { to: '/student/timetable', label: 'Thời khóa biểu (M1)', icon: Calendar },
      { to: '/student/assignments', label: 'Bài tập cần nộp (M2)', icon: FileText },
      { to: '/student/grades', label: 'Bảng điểm cá nhân (M2)', icon: CheckSquare },
      { to: '/student/quizzes', label: 'Bài thi trắc nghiệm (M3)', icon: CheckSquare },
      { to: '/student/discussions', label: 'Diễn đàn thảo luận (M3)', icon: MessageSquare },
    ],
  };

  const navItems = navItemsByRole[role] || [];

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card p-4">
      <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Điều hướng chính
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

