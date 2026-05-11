import axios from 'axios';
import toast from 'react-hot-toast';

const getErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const normalized = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (!item || typeof item !== 'object') return '';

        const fieldPath = Array.isArray(item.loc)
          ? item.loc.filter((segment) => segment !== 'body').join('.')
          : '';

        if (fieldPath && item.msg) return `${fieldPath}: ${item.msg}`;
        return item.msg || '';
      })
      .filter(Boolean);

    if (normalized.length > 0) {
      return normalized.join(' | ');
    }
  }

  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message;
  }

  return 'Lỗi giao tiếp hệ thống, vui lòng thử lại!';
};

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh') {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const backendUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
          const res = await axios.post(`${backendUrl}/auth/refresh`, null, {
            params: { refresh_token: refreshToken }
          });

          if (res.status === 200) {
            const newAccessToken = res.data.access_token;
            const newRefreshToken = res.data.refresh_token;

            localStorage.setItem('access_token', newAccessToken);
            if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);

            // retry với token mới
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return axiosClient(originalRequest);
          }
        } catch (refreshError) {
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }

    if (error.response && error.response.status !== 401) {
      toast.error(getErrorMessage(error));
    } else if (!error.response) {
      toast.error("Không thể kết nối đến máy chủ Backend!");
    }

    return Promise.reject(error);
  }
);

export default axiosClient;