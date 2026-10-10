import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/features/packages/application/package_providers.dart';
import 'package:hospital_booking_mobile/features/packages/data/package_repository.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';
import 'package:hospital_booking_mobile/features/packages/presentation/package_detail_screen.dart';

const _package = MedicalPackage(
  id: 'package-1',
  name: 'Gói tim mạch',
  slug: 'goi-tim-mach',
  description: 'Tầm soát tim mạch toàn diện.',
  summary: 'Chủ động kiểm tra sức khỏe tim mạch.',
  note: 'Nhịn ăn trước khi lấy máu.',
  departmentId: 'department-1',
  departmentName: 'Tim mạch',
  basePrice: 800000,
  serviceFee: 50000,
  includedItemsTotal: 800000,
  finalPrice: 850000,
  isPopular: true,
  isBhytSupport: true,
  items: [
    MedicalPackageItem(
      id: 'item-1',
      name: 'Điện tim',
      price: 200000,
      included: true,
      order: 1,
    ),
  ],
);

class _FakePackageRepository extends PackageRepository {
  _FakePackageRepository() : super(Dio());

  @override
  Future<MedicalPackage> fetchBySlug(String slug) async => _package;
}

void main() {
  testWidgets(
    'package detail opens booking with package and department preset',
    (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final router = GoRouter(
        initialLocation: '/packages/goi-tim-mach',
        routes: [
          GoRoute(
            path: '/packages/:slug',
            builder: (_, state) =>
                PackageDetailScreen(slug: state.pathParameters['slug']!),
          ),
          GoRoute(path: '/home', builder: (_, _) => const Text('Trang chủ')),
          GoRoute(
            path: '/booking',
            builder: (_, state) => Text(
              'booking:${state.uri.queryParameters['packageId']}:'
              '${state.uri.queryParameters['departmentId']}',
            ),
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            packageRepositoryProvider.overrideWithValue(
              _FakePackageRepository(),
            ),
          ],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Gói tim mạch'), findsOneWidget);
      expect(find.text('Điện tim'), findsOneWidget);
      expect(find.text('850.000 đ'), findsNWidgets(2));

      await tester.tap(find.text('Đặt gói này'));
      await tester.pumpAndSettle();

      expect(find.text('booking:package-1:department-1'), findsOneWidget);
    },
  );
}
