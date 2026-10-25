export function getSafeRedirectPath(path) {
  if (
    typeof path !== 'string' ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    /[a-z][a-z\d+.-]*:/i.test(path)
  ) {
    return null;
  }

  return path;
}
