import { api } from '../../../shared/api/client.js';

export async function getAssignment(assignmentId) {
  const response = await api.get(`/assignments/${assignmentId}`);
  return response.data;
}

export async function getMySubmission(assignmentId) {
  const response = await api.get(`/assignments/${assignmentId}/submissions/me`);
  return response.data;
}

export async function submitAssignment(assignmentId, file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.upload(`/assignments/${assignmentId}/submissions`, formData, {
    onProgress: ({ percentage }) => onProgress(percentage)
  });
  return response.data;
}
