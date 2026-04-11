import axios from 'axios';
import toast from 'react-hot-toast';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Trước khi gửi request đi: Tự động đính kèm Token
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

// Sau khi nhận response về: Bắt lỗi Toàn cầu & Auto Refresh Token
axiosClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    // 1. Nếu là lỗi 401 Unauth (Token chết vòng 1) và CHƯA BỊ lặp (chưa dán cờ _retry)
    // Đồng thời không phải lỗi tại lúc đang đăng nhập/văng thẳng
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/refresh') {
      originalRequest._retry = true; // Dán cờ đang-khắc-phục

      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          // Gọi API độc lập (axios thường) để tránh Loop interceptor
          const backendUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/v1';
          const res = await axios.post(`${backendUrl}/auth/refresh`, null, {
            params: { refresh_token: refreshToken }
          });
          
          if (res.status === 200) {
            const newAccessToken = res.data.access_token;
            const newRefreshToken = res.data.refresh_token; // Nếu server cấp lại cả refresh token
            
            localStorage.setItem('access_token', newAccessToken);
            if (newRefreshToken) localStorage.setItem('refresh_token', newRefreshToken);

            // Gắn token mới vào Headers của Request vừa bị fail lúc nãy
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            // Yêu cầu Axios bắn lại cú request hụt đó
            return axiosClient(originalRequest);
          }
        } catch (refreshError) {
          // Refresh Token CŨNG chết (Bị khóa hoặc hết hạn)
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        // Đã hết 401 mà lại không có Refresh Token trong máy
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }

    // 2. Global Exception Catching: Hiển thị cửa sổ Toast cho mọi lỗi Backend đổ về
    // Loại trừ 401 để không báo "Token invalid" lúc nó đang tự dộng múa refresh token
    if (error.response && error.response.status !== 401) {
       const errorMsg = error.response.data?.detail || "Lỗi giao tiếp hệ thống, vui lòng thử lại!";
       // Báo lỗi dạng Toast thay vì console.log im lìm
       toast.error(errorMsg);
    } else if (!error.response) {
       // Lỗi từ mạng lưới, server đứt mạng
       toast.error("Không thể kết nối đến máy chủ Backend!");
    }

    return Promise.reject(error);
  }
);

export default axiosClient;