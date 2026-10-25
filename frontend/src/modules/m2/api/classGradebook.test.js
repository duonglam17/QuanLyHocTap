import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../../shared/api/client.js';
import { downloadClassGradebook, getClassGradebook } from './classGradebook.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('class gradebook API', () => {
  it('requests the selected course gradebook page', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [] });

    await getClassGradebook(17, 2);

    expect(get).toHaveBeenCalledWith('/m2-assessment/courses/17/grades', {
      params: { page: 2 }
    });
  });

  it('downloads the complete gradebook through the authenticated API client', async () => {
    const download = vi.spyOn(api, 'download').mockResolvedValue({ filename: 'grades.csv' });

    await downloadClassGradebook(17);

    expect(download).toHaveBeenCalledWith('/m2-assessment/courses/17/grades/export-csv');
  });
});
