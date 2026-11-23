import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/department_visuals.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/widgets/department_tile.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/widgets/doctor_catalog_card.dart';
import 'package:hospital_booking_mobile/features/catalog/presentation/widgets/package_catalog_card.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';

const _scales = [1.0, 1.3, 1.6, 2.0];

Widget _host(double scale, Widget child) => MaterialApp(
  theme: AppTheme.light,
  builder: (context, home) => MediaQuery(
    data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
    child: home!,
  ),
  home: Scaffold(
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: child,
    ),
  ),
);

const _doctor = CatalogDoctor(
  id: 'd1',
  fullName: 'Nguyễn Minh Hoàng Phúc Thịnh',
  title: 'PGS.TS.BSCKII',
  departmentName: 'Khoa cơ xương khớp và phục hồi chức năng',
  consultationFee: 350000,
  experience: 22,
  averageRating: 4.8,
  reviewCount: 12,
  todayAvailableSlots: [
    CatalogDoctorSlot(startTime: '08:00', endTime: '08:30'),
    CatalogDoctorSlot(startTime: '08:30', endTime: '09:00'),
    CatalogDoctorSlot(startTime: '09:00', endTime: '09:30'),
  ],
);

const _package = MedicalPackage(
  id: 'p1',
  name:
      'Gói khám sức khỏe tổng quát nâng cao dành cho người trên bốn mươi tuổi',
  basePrice: 800000,
  serviceFee: 10000,
  includedItemsTotal: 0,
  finalPrice: 810000,
  isPopular: true,
  isBhytSupport: true,
  summary:
      'Khám lâm sàng, xét nghiệm máu và nước tiểu, điện tim, siêu âm bụng tổng quát và tư vấn kết quả.',
  departmentName: 'Khoa tim mạch',
);

void main() {
  testWidgets('bảng biểu tượng khớp tên khoa có dấu và không dấu', (
    tester,
  ) async {
    late BuildContext context;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Builder(
          builder: (c) {
            context = c;
            return const SizedBox();
          },
        ),
      ),
    );
    IconData icon(String name, [String? slug]) =>
        departmentVisual(context, name: name, slug: slug).icon;

    expect(icon('Khoa nhi'), Icons.child_care_outlined);
    expect(icon('Khoa tim mạch'), Icons.monitor_heart_outlined);
    expect(icon('Khoa', 'tim-mach'), Icons.monitor_heart_outlined);
    expect(icon('Tai mũi họng'), Icons.hearing_outlined);
    expect(icon('Khoa tổng quát'), Icons.health_and_safety_outlined);
    // Khoa chưa có trong bảng dùng biểu tượng chung; "nhiễm" không bị nhầm với "nhi".
    expect(icon('Khoa truyền nhiễm'), Icons.medical_services_outlined);
  });

  for (final scale in _scales) {
    testWidgets('thẻ bác sĩ không vỡ ở cỡ chữ $scale', (tester) async {
      tester.view.physicalSize = const Size(360, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        _host(scale, const DoctorCatalogCard(doctor: _doctor)),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('thẻ gói khám không vỡ ở cỡ chữ $scale', (tester) async {
      tester.view.physicalSize = const Size(360, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        _host(scale, const PackageCatalogCard(item: _package)),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('lưới chuyên khoa không vỡ ở cỡ chữ $scale', (tester) async {
      tester.view.physicalSize = const Size(360, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        _host(
          scale,
          const DepartmentGrid(
            children: [
              DepartmentTile(
                id: '1',
                name: 'Khoa cơ xương khớp và phục hồi chức năng',
                doctorCount: 12,
                index: 0,
              ),
              DepartmentTile(
                id: '2',
                name: 'Khoa nhi',
                doctorCount: 0,
                index: 1,
              ),
              DepartmentTile(
                id: '3',
                name: 'Tai mũi họng',
                doctorCount: 1,
                index: 2,
              ),
            ],
          ),
        ),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  }
}
