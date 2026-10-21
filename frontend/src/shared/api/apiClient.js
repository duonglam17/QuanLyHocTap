import axios from 'axios';

/**
 * LMS Mini Centralized Axios HTTP Client
 * - Tuân thủ kiến trúc REST API
 * - Tự động đính kèm JWT Bearer Token
 * - Chuẩn hóa xử lý lỗi tập trung: 401, 403, 404, 422, 5xx
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Đính kèm Access Token vào mọi yêu cầu
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Chuẩn hóa dữ liệu trả về và bắt lỗi HTTP
apiClient.interceptors.response.use(
  (response) => {
    // Trả trực tiếp payload data
    return response.data;
  },
  (error) => {
    const status = error.response ? error.response.status : null;
    const responseData = error.response ? error.response.data : null;

    let normalizedMessage = 'Đã có lỗi xảy ra. Vui lòng thử lại.';
    let errorDetails = null;

    if (!error.response) {
      // Lỗi kết nối mạng hoặc server không phản hồi
      normalizedMessage = 'Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng.';
    } else {
      switch (status) {
        case 401:
          // Hết hạn phiên hoặc token không hợp lệ (US-02, EC-14)
          normalizedMessage =
            responseData?.message || 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          if (
            typeof window !== 'undefined' &&
            !window.location.pathname.startsWith('/login')
          ) {
            window.location.href = '/login?session_expired=true';
          }
          break;

        case 403:
          // Quyền bị từ chối do không đủ thẩm quyền (RBAC, IDOR)
          normalizedMessage =
            responseData?.message || 'Bạn không có quyền thực hiện thao tác này.';
          break;

        case 404:
          // Không tìm thấy tài nguyên
          normalizedMessage =
            responseData?.message || 'Tài nguyên được yêu cầu không tồn tại.';
          break;

        case 422:
          // Dữ liệu đầu vào không hợp lệ
          normalizedMessage =
            responseData?.message || 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.';
          errorDetails = responseData?.errors || null;
          break;

        case 429:
          // Vượt quá giới hạn tần suất (Rate Limiting)
          normalizedMessage =
            responseData?.message || 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng chờ giây lát.';
          break;

        case 500:
        case 502:
        case 503:
        case 504:
          // Lỗi hệ thống server
          normalizedMessage =
            'Máy chủ gặp sự cố trong quá trình xử lý. Vui lòng thử lại sau.';
          break;

        default:
          normalizedMessage = responseData?.message || normalizedMessage;
          break;
      }
    }

    const enhancedError = new Error(normalizedMessage);
    enhancedError.status = status;
    enhancedError.data = responseData;
    enhancedError.details = errorDetails;

    return Promise.reject(enhancedError);
  }
);

export default apiClient;

