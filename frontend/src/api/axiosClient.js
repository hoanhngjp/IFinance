import axios from 'axios';

const axiosClient = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/v1', // Trỏ thẳng vào Backend của bạn
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

// Sau khi nhận response về: Tự động bắt lỗi 401 (Hết hạn Token)
axiosClient.interceptors.response.use(
  (response) => response.data, // Chỉ lấy phần data của BE trả về cho gọn
  (error) => {
    if (error.response?.status === 401) {
      // Logic xử lý khi token chết: Xóa token cũ và đẩy về trang đăng nhập
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
      // Tương lai bạn có thể nâng cấp gọi API /refresh-token ở đây trước khi logout
    }
    return Promise.reject(error);
  }
);

export default axiosClient;