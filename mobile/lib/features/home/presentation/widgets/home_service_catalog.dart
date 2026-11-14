import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';

class HomeService {
  const HomeService({
    required this.shortLabel,
    required this.label,
    required this.description,
    required this.icon,
    required this.location,
    this.requiresAccount = false,
    this.opensMainBranch = false,
  });

  final String shortLabel;
  final String label;
  final String description;
  final IconData icon;
  final String location;
  final bool requiresAccount;
  final bool opensMainBranch;
}

class HomeServiceSection {
  const HomeServiceSection({required this.title, required this.services});

  final String title;
  final List<HomeService> services;
}

const homeBookingService = HomeService(
  shortLabel: 'Khám theo bác sĩ',
  label: 'Đặt lịch khám',
  description: 'Chọn bác sĩ, chuyên khoa hoặc gói khám',
  icon: Icons.calendar_month_outlined,
  location: '/booking',
  opensMainBranch: true,
);

const homeAppointmentsService = HomeService(
  shortLabel: 'Tra cứu lịch hẹn',
  label: 'Lịch khám của tôi',
  description: 'Theo dõi lịch sắp tới và lịch sử khám',
  icon: Icons.event_note_outlined,
  location: '/appointments',
  requiresAccount: true,
);

const homeRecordsService = HomeService(
  shortLabel: 'Kết quả khám',
  label: 'Kết quả khám',
  description: 'Xem hồ sơ và kết quả đã được bệnh viện công bố',
  icon: Icons.description_outlined,
  location: '/medical-records',
  requiresAccount: true,
);

const homePrescriptionsService = HomeService(
  shortLabel: 'Đơn thuốc',
  label: 'Đơn thuốc',
  description: 'Xem thuốc và hướng dẫn sử dụng sau khám',
  icon: Icons.medication_outlined,
  location: '/prescriptions',
  requiresAccount: true,
);

const homeInvoicesService = HomeService(
  shortLabel: 'Hóa đơn',
  label: 'Hóa đơn',
  description: 'Kiểm tra chi phí và trạng thái thanh toán',
  icon: Icons.receipt_long_outlined,
  location: '/invoices',
  requiresAccount: true,
);

const homeHealthHubService = HomeService(
  shortLabel: 'Kết quả & đơn thuốc',
  label: 'Tổng quan hồ sơ',
  description: 'Một nơi cho kết quả khám, đơn thuốc và hóa đơn',
  icon: Icons.health_and_safety_outlined,
  location: '/records',
  requiresAccount: true,
  opensMainBranch: true,
);

const homeDepartmentsService = HomeService(
  shortLabel: 'Khám chuyên khoa',
  label: 'Danh sách chuyên khoa',
  description: 'Tìm đúng chuyên khoa theo nhu cầu khám',
  icon: Icons.local_hospital_outlined,
  location: '/departments',
);

const homeDoctorsService = HomeService(
  shortLabel: 'Tìm bác sĩ',
  label: 'Danh sách bác sĩ',
  description: 'Tìm theo tên, chuyên môn và chuyên khoa',
  icon: Icons.person_search_outlined,
  location: '/doctors',
);

const homePackagesService = HomeService(
  shortLabel: 'Gói khám sức khỏe',
  label: 'Gói khám sức khỏe',
  description: 'Khám phá các gói chăm sóc theo nhu cầu',
  icon: Icons.health_and_safety_outlined,
  location: '/packages',
);

const homeChatbotService = HomeService(
  shortLabel: 'Trợ lý sức khỏe',
  label: 'Trợ lý đặt lịch 24/7',
  description: 'Gợi ý chuyên khoa, bác sĩ và lịch trống',
  icon: Icons.smart_toy_outlined,
  location: '/chatbot',
);

const homeNotificationsService = HomeService(
  shortLabel: 'Thông báo',
  label: 'Thông báo',
  description: 'Theo dõi cập nhật lịch khám và hồ sơ',
  icon: Icons.notifications_none_rounded,
  location: '/notifications',
  requiresAccount: true,
  opensMainBranch: true,
);

const homeProfileService = HomeService(
  shortLabel: 'Tài khoản',
  label: 'Tài khoản',
  description: 'Quản lý thông tin người khám và phiên đăng nhập',
  icon: Icons.account_circle_outlined,
  location: '/profile',
  requiresAccount: true,
  opensMainBranch: true,
);

const homeSupportService = HomeService(
  shortLabel: 'Hỗ trợ',
  label: 'Trung tâm hỗ trợ',
  description: 'Hotline, cấp cứu và hướng dẫn sử dụng dịch vụ',
  icon: Icons.support_agent_rounded,
  location: '/support',
);

const homePrimaryServices = <HomeService>[
  homeBookingService,
  homeAppointmentsService,
  homeHealthHubService,
  homePrescriptionsService,
  homeInvoicesService,
  homeDoctorsService,
  homeDepartmentsService,
  homePackagesService,
];

const homeServiceSections = <HomeServiceSection>[
  HomeServiceSection(
    title: 'Khám & dịch vụ',
    services: [
      homeBookingService,
      homeDoctorsService,
      homeDepartmentsService,
      homePackagesService,
      homeChatbotService,
    ],
  ),
  HomeServiceSection(
    title: 'Hồ sơ sức khỏe',
    services: [
      homeHealthHubService,
      homeAppointmentsService,
      homeRecordsService,
      homePrescriptionsService,
      homeInvoicesService,
    ],
  ),
  HomeServiceSection(
    title: 'Tài khoản & hỗ trợ',
    services: [
      homeSupportService,
      homeNotificationsService,
      homeProfileService,
    ],
  ),
];
