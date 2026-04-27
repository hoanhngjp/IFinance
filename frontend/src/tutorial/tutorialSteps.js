/**
 * Tutorial step definitions for desktop and mobile breakpoints.
 *
 * Each step MUST have a unique `key` — this is used to map the current
 * position across breakpoints when the user resizes the window mid-tour.
 *
 * CSS tour selectors (tour-*) must be added to their corresponding
 * components before these steps can highlight the correct elements:
 *
 *  Desktop targets           Component
 *  ─────────────────────     ─────────────────────
 *  .tour-sidebar             Sidebar.jsx (container div)
 *  .tour-add-transaction-btn App.jsx > DesktopHeader (Link button)
 *  .tour-dashboard           Sidebar.jsx (Home nav link)
 *  .tour-ai-chat             Sidebar.jsx (AI Chat nav link)
 *  .tour-wallets             Sidebar.jsx (Wallets nav link)
 *
 *  Mobile targets            Component
 *  ─────────────────────     ─────────────────────
 *  .tour-add-transaction-mobile  BottomNav.jsx (FAB +)
 *  .tour-dashboard-mobile        BottomNav.jsx (Home link)
 *  .tour-ai-chat-mobile          BottomNav.jsx (AI Chat link)
 */

export const desktopSteps = [
  {
    key: 'welcome',
    target: 'body',
    placement: 'center',
    skipBeacon: true,
    title: '👋 Chào mừng đến với IFinance!',
    content:
      'Đây là ứng dụng quản lý tài chính thông minh của bạn. ' +
      'Hãy để chúng tôi hướng dẫn qua các tính năng chính — chỉ mất khoảng 30 giây.',
  },
  {
    key: 'sidebar-nav',
    target: '.tour-sidebar',
    placement: 'right',
    skipBeacon: true,
    skipScroll: true,
    title: '🗂 Thanh điều hướng',
    content:
      'Từ đây bạn truy cập toàn bộ tính năng: Giao dịch, Ví tiền, ' +
      'Ngân sách, Đầu tư, Sổ Nợ và nhiều hơn nữa.',
  },
  {
    key: 'add-transaction',
    target: '.tour-add-transaction-btn',
    placement: 'bottom',
    skipBeacon: true,
    title: '➕ Thêm giao dịch',
    content:
      'Nhấn vào đây để ghi nhận thu nhập hoặc chi tiêu. ' +
      'Bạn có thể nhập bằng tay, dùng AI thông minh hoặc scan hóa đơn.',
  },
  {
    key: 'dashboard',
    target: '.tour-dashboard',
    placement: 'right',
    skipBeacon: true,
    skipScroll: true,
    title: '📊 Trang chủ & Thống kê',
    content:
      'Theo dõi tổng quan tài chính, biểu đồ thu chi theo thời gian ' +
      'và số dư từng ví một cách trực quan.',
  },
  {
    key: 'ai-chat',
    target: '.tour-ai-chat',
    placement: 'right',
    skipBeacon: true,
    skipScroll: true,
    title: '✨ Trợ lý AI Thông minh',
    content:
      'Trợ lý AI Gemini giúp bạn ghi nhận giao dịch bằng ngôn ngữ tự nhiên, ' +
      'phân tích thói quen chi tiêu và đưa ra tư vấn tài chính.',
  },
  {
    key: 'wallets',
    target: '.tour-wallets',
    placement: 'right',
    skipBeacon: true,
    skipScroll: true,
    title: '👛 Quản lý Ví tiền',
    content:
      'Quản lý đồng thời nhiều ví: tiền mặt, ngân hàng, ví điện tử. ' +
      'Số dư được cập nhật tự động sau mỗi giao dịch.',
  },
];

export const mobileSteps = [
  {
    key: 'welcome',
    target: 'body',
    placement: 'center',
    skipBeacon: true,
    title: '👋 Chào mừng đến với IFinance!',
    content:
      'Ứng dụng quản lý tài chính thông minh của bạn. ' +
      'Khám phá các tính năng chính trong vài giây.',
  },
  {
    key: 'add-transaction',
    target: '.tour-add-transaction-mobile',
    placement: 'top',
    skipBeacon: true,
    title: '➕ Thêm giao dịch',
    content:
      'Nhấn vào nút + ở giữa thanh điều hướng để thêm thu nhập ' +
      'hoặc chi tiêu mới bằng AI hoặc nhập tay.',
  },
  {
    key: 'dashboard',
    target: '.tour-dashboard-mobile',
    placement: 'top',
    skipBeacon: true,
    title: '📊 Trang chủ & Thống kê',
    content:
      'Xem tổng quan tài chính, biểu đồ thu chi và theo dõi ' +
      'số dư các ví của bạn tại đây.',
  },
  {
    key: 'ai-chat',
    target: '.tour-ai-chat-mobile',
    placement: 'top',
    skipBeacon: true,
    title: '✨ Trợ lý AI',
    content:
      'Trò chuyện với AI để ghi nhận giao dịch nhanh và nhận ' +
      'tư vấn tài chính thông minh.',
  },
];
