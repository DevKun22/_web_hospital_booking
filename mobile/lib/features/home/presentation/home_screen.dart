import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/router/route_guard.dart';
import 'package:hospital_booking_mobile/app/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_error_banner.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_state.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authControllerProvider);
    final user = auth.user;
    final isAuthenticated = auth.isAuthenticated;
    final sessionError = auth.errorFor(AuthErrorOrigin.session);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 20,
        title: const Row(
          children: [
            AppBrandMark(size: 36),
            SizedBox(width: 10),
            Text('Hospital Booking'),
          ],
        ),
        actions: [
          IconButton(
            onPressed: () => context.push(
              isAuthenticated ? '/profile' : loginLocation('/profile'),
            ),
            icon: Icon(
              isAuthenticated
                  ? Icons.account_circle_outlined
                  : Icons.login_rounded,
            ),
            tooltip: isAuthenticated ? 'Hồ sơ' : 'Đăng nhập',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
          children: [
            if (sessionError != null) ...[
              AppErrorBanner(
                error: sessionError,
                onDismiss: ref
                    .read(authControllerProvider.notifier)
                    .dismissError,
              ),
              const SizedBox(height: 16),
            ],
            Text(
              isAuthenticated
                  ? 'Xin chào, ${user?.fullName ?? 'bệnh nhân'}'
                  : 'Chăm sóc sức khỏe dễ dàng hơn',
              style: Theme.of(
                context,
              ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(
              isAuthenticated
                  ? 'Phiên đăng nhập đã được kết nối an toàn với hệ thống.'
                  : 'Bạn có thể khám phá dịch vụ và đặt lịch mà chưa cần tài khoản.',
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppTheme.primary, Color(0xFF0A9290)],
                ),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AppStatusBadge(
                    label: 'TRẢI NGHIỆM MOBILE MỚI',
                    tone: AppStatusTone.success,
                    icon: Icons.auto_awesome_rounded,
                  ),
                  const SizedBox(height: 14),
                  Text(
                    'Đặt lịch đúng chuyên khoa,\nan tâm từng bước',
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Luồng chọn bác sĩ và giờ khám sẽ được kết nối ở mốc kế tiếp.',
                    style: TextStyle(color: Color(0xDFFFFFFF)),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(0, 44),
                      backgroundColor: Colors.white,
                      foregroundColor: AppTheme.primary,
                    ),
                    onPressed: () => context.go('/booking'),
                    icon: const Icon(Icons.calendar_month_outlined),
                    label: const Text('Bắt đầu đặt lịch'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            const AppSectionHeader(title: 'Dịch vụ của bạn'),
            const SizedBox(height: 10),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.15,
              children: [
                _FeatureCard(
                  icon: Icons.calendar_month_outlined,
                  label: 'Đặt lịch khám',
                  detail: 'Không cần tài khoản',
                  onTap: () => context.go('/booking'),
                ),
                _FeatureCard(
                  icon: Icons.event_note_outlined,
                  label: 'Lịch khám của tôi',
                  detail: isAuthenticated ? 'Đã đăng nhập' : 'Cần đăng nhập',
                  onTap: () => context.push(
                    isAuthenticated
                        ? '/appointments'
                        : loginLocation('/appointments'),
                  ),
                ),
                _FeatureCard(
                  icon: Icons.description_outlined,
                  label: 'Kết quả khám',
                  detail: 'Bảo vệ bằng tài khoản',
                  onTap: () => context.push(
                    isAuthenticated
                        ? '/medical-records'
                        : loginLocation('/medical-records'),
                  ),
                ),
                _FeatureCard(
                  icon: Icons.medication_outlined,
                  label: 'Đơn thuốc',
                  detail: 'Bảo vệ bằng tài khoản',
                  onTap: () => context.push(
                    isAuthenticated
                        ? '/prescriptions'
                        : loginLocation('/prescriptions'),
                  ),
                ),
              ],
            ),
            if (!isAuthenticated) ...[
              const SizedBox(height: 22),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Đã có tài khoản bệnh nhân?',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Đăng nhập để xem lịch, hồ sơ sức khỏe và kết quả khám trên mọi thiết bị.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: 14),
                      OutlinedButton.icon(
                        onPressed: () => context.push('/login'),
                        icon: const Icon(Icons.login_rounded),
                        label: const Text('Đăng nhập'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _FeatureCard extends StatelessWidget {
  const _FeatureCard({
    required this.icon,
    required this.label,
    required this.detail,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String detail;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primaryContainer,
                borderRadius: BorderRadius.circular(13),
              ),
              child: Icon(icon, color: Theme.of(context).colorScheme.primary),
            ),
            const Spacer(),
            Text(label, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 3),
            Text(
              detail,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
