export function getRoleDefaultPath(role) {
  switch (role) {
    case 'ADMIN':
      return '/admin/users';
    case 'GIANG_VIEN':
    case 'SINH_VIEN':
      return '/courses';
    default:
      return '/';
  }
}

export function safeReturnPath(from, role) {
  const path = typeof from === 'string' ? from : from?.pathname;
  if (path && path.startsWith('/') && !path.startsWith('//') && path !== '/login' && path !== '/') {
    if (typeof from === 'string') return path;
    return `${path}${from.search || ''}${from.hash || ''}`;
  }
  return getRoleDefaultPath(role);
}
