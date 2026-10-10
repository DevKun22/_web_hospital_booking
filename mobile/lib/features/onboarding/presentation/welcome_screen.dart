import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/core/widgets/app_ui.dart';
import 'package:hospital_booking_mobile/features/onboarding/application/onboarding_controller.dart';

class WelcomeScreen extends ConsumerWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final onboarding = ref.watch(onboardingControllerProvider);
    final isSaving = onboarding.isLoading;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 28),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AppBrandMark(size: 40),
                        SizedBox(width: 10),
                        Text(
                          'HOSPITAL BOOKING',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.1,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 34),
                  _WelcomeIllustration(
                    primary: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(height: 34),
                  Text(
                    'CHĂM SÓC DỄ DÀNG HƠN',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Đặt lịch khám\nan tâm từng bước',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      height: 1.16,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Chọn chuyên khoa, bác sĩ và thời gian phù hợp. '
                    'Bạn chưa cần tạo tài khoản để bắt đầu.',
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: 28),
                  AppPrimaryButton(
                    label: 'Đặt lịch ngay',
                    icon: Icons.arrow_forward_rounded,
                    loading: isSaving,
                    onPressed: () => _continueTo(context, ref, '/booking'),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: isSaving
                        ? null
                        : () => _continueTo(context, ref, '/login'),
                    icon: const Icon(Icons.login_rounded),
                    label: const Text('Tôi đã có tài khoản'),
                  ),
                  const SizedBox(height: 4),
                  TextButton(
                    onPressed: isSaving
                        ? null
                        : () => _continueTo(context, ref, '/home'),
                    child: const Text('Khám phá dịch vụ trước'),
                  ),
                  if (onboarding.hasError) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Không thể lưu lựa chọn trên thiết bị. Vui lòng thử lại.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.shield_outlined,
                        size: 16,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 6),
                      const Flexible(
                        child: Text(
                          'Thông tin chỉ được yêu cầu khi cần xác nhận lịch.',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _continueTo(
    BuildContext context,
    WidgetRef ref,
    String location,
  ) async {
    await ref.read(onboardingControllerProvider.notifier).completeWelcome();
    if (!context.mounted) return;
    if (ref.read(onboardingControllerProvider).hasError) return;
    context.go(location);
  }
}

class _WelcomeIllustration extends StatelessWidget {
  const _WelcomeIllustration({required this.primary});

  final Color primary;

  @override
  Widget build(BuildContext context) => AspectRatio(
    aspectRatio: 1.8,
    child: DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFDDF3EE), Color(0xFFE5F1FA)],
        ),
        borderRadius: BorderRadius.circular(36),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              color: primary,
              borderRadius: BorderRadius.circular(30),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x22075B58),
                  blurRadius: 28,
                  offset: Offset(0, 12),
                ),
              ],
            ),
            child: const Icon(
              Icons.medical_services_rounded,
              color: Colors.white,
              size: 48,
            ),
          ),
          const Positioned(
            left: 34,
            bottom: 25,
            child: _FloatingIcon(icon: Icons.event_available_rounded),
          ),
          const Positioned(
            right: 32,
            top: 24,
            child: _FloatingIcon(icon: Icons.forum_outlined),
          ),
        ],
      ),
    ),
  );
}

class _FloatingIcon extends StatelessWidget {
  const _FloatingIcon({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
    width: 48,
    height: 48,
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surface,
      borderRadius: BorderRadius.circular(15),
      boxShadow: const [
        BoxShadow(
          color: Color(0x18075B58),
          blurRadius: 18,
          offset: Offset(0, 7),
        ),
      ],
    ),
    child: Icon(icon, color: Theme.of(context).colorScheme.primary),
  );
}
