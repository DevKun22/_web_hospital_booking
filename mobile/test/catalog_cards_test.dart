import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/design/app_colors.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/core/widgets/app_detail.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:hospital_booking_mobile/core/widgets/app_entity_mark.dart';
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
  test('chữ viết tắt bỏ từ chung đầu tên khoa, gói', () {
    expect(entityInitials('Khoa Tim mạch'), 'TM');
    expect(entityInitials('Gói khám tổng quát cơ bản'), 'TQ');
    expect(entityInitials('Chuyên khoa Da liễu'), 'DL');
    expect(entityInitials('Nhi'), 'N');
    expect(entityInitials('Khoa'), 'K');
    expect(entityInitials('   '), '?');
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
                department: CatalogDepartment(
                  id: '1',
                  name: 'Khoa cơ xương khớp và phục hồi chức năng',
                  doctorCount: 12,
                  packageCount: 3,
                  availableSlotCount: 20,
                ),
              ),
              DepartmentTile(
                department: CatalogDepartment(id: '2', name: 'Khoa nhi'),
              ),
              DepartmentTile(
                department: CatalogDepartment(
                  id: '3',
                  name: 'Tai mũi họng',
                  doctorCount: 1,
                ),
              ),
            ],
          ),
        ),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('khung màn chi tiết không vỡ ở cỡ chữ $scale', (tester) async {
      tester.view.physicalSize = const Size(360, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        _host(
          scale,
          Builder(
            builder: (context) => Column(
              children: [
                AppDetailHeader(
                  tint: context.colors.zone(AppZone.danger),
                  leading: const Icon(Icons.favorite_outline),
                  title:
                      'Gói khám sức khỏe tổng quát nâng cao dành cho người trên bốn mươi tuổi',
                  subtitle:
                      'Khám lâm sàng, xét nghiệm máu và nước tiểu, điện tim.',
                  chips: const [
                    AppDetailChip(label: 'Nổi bật'),
                    AppDetailChip(
                      label: 'Khoa cơ xương khớp và phục hồi chức năng',
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const AppDetailFacts(
                  facts: [
                    ('350.000 đ', 'Phí khám'),
                    ('22 năm', 'Kinh nghiệm'),
                    ('4,8', '12 đánh giá'),
                  ],
                ),
                const SizedBox(height: 8),
                AppDetailSection(
                  title: 'Bác sĩ (12)',
                  actionLabel: 'Xem tất cả',
                  onAction: () {},
                  child: const Text('Nội dung'),
                ),
                AppDetailBar(
                  priceLabel: 'Giá trọn gói',
                  price: '2.810.000 đ',
                  primaryLabel: 'Đặt lịch chuyên khoa',
                  onPrimary: () {},
                  onAssistant: () {},
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  }
}
