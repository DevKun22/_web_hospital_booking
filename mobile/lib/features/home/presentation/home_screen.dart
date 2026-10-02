import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final features = const [
      (Icons.calendar_month_outlined, 'Đặt lịch khám', 'Phase 3'),
      (Icons.event_note_outlined, 'Lịch khám của tôi', 'Phase 3'),
      (Icons.description_outlined, 'Kết quả khám', 'Phase 4'),
      (Icons.medication_outlined, 'Đơn thuốc', 'Phase 4'),
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Hospital Booking'),
        actions: [
          IconButton(
            onPressed: () => context.push('/profile'),
            icon: const Icon(Icons.account_circle_outlined),
            tooltip: 'Hồ sơ',
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Xin chào, ${user?.fullName ?? 'bệnh nhân'}',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            const Text('Phiên đăng nhập mobile đã kết nối với backend v1.'),
            const SizedBox(height: 24),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: features.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.05,
              ),
              itemBuilder: (context, index) {
                final (icon, label, phase) = features[index];
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          icon,
                          size: 34,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                        const Spacer(),
                        Text(
                          label,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          phase,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
