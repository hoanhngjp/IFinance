import React, { useState, useEffect } from 'react';

export default function CurrencyInput({ value, onChange, placeholder, className, required, ...props }) {
  // Hàm format số nguyên thủy thành chuỗi có dấu chấm (VD: 3000000 -> "3.000.000")
  const formatValue = (val) => {
    if (val === null || val === undefined || val === '') return '';
    const cleanValue = val.toString().replace(/\D/g, ''); // Xóa bỏ mọi ký tự không phải là số
    if (!cleanValue) return '';
    return new Intl.NumberFormat('vi-VN').format(cleanValue);
  };

  const [displayValue, setDisplayValue] = useState(formatValue(value));

  // Đồng bộ lại khi giá trị từ Form cha bị reset (VD: Bấm nút Lưu xong form trống lại)
  useEffect(() => {
    setDisplayValue(formatValue(value));
  }, [value]);

  const handleChange = (e) => {
    // 1. Lấy chuỗi người dùng vừa gõ và lọc bỏ các dấu chấm
    const rawString = e.target.value.replace(/\D/g, '');

    // 2. Chuyển thành số nguyên thủy để gửi về Component cha
    const rawNumber = rawString ? parseInt(rawString, 10) : '';

    // 3. Cập nhật lại giao diện hiển thị với dấu chấm mới
    setDisplayValue(formatValue(rawString));

    // 4. Trả dữ liệu thật (số nguyên thủy) ra bên ngoài thông qua onChange
    if (onChange) {
      onChange({
        target: {
          name: props.name,
          value: rawNumber
        }
      });
    }
  };

  return (
    <input
      type="text" // Bắt buộc dùng text để có thể hiển thị dấu chấm
      inputMode="numeric" // Vẫn bật bàn phím số khi dùng trên điện thoại
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      required={required}
      {...props}
    />
  );
}