import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';

class BookingStartScreen extends StatelessWidget {
  const BookingStartScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Đặt lịch khám')),
    body: SafeArea(
      child: AppEmptyState(
        icon: Icons.calendar_month_rounded,
        title: 'Luồng đặt lịch đã sẵn sàng để kết nối',
        message:
            'Bạn đang sử dụng ứng dụng với tư cách khách. '
            'Bước chọn chuyên khoa, bác sĩ và giờ khám sẽ được triển khai ở mốc tiếp theo.',
        action: FilledButton.icon(
          onPressed: () => context.go('/home'),
          icon: const Icon(Icons.explore_outlined),
          label: const Text('Khám phá trang chủ'),
        ),
      ),
    ),
  );
}
