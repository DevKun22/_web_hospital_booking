import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/theme/app_theme.dart';
import 'package:hospital_booking_mobile/features/booking/domain/booking_catalog.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_doctor_picker.dart';
import 'package:hospital_booking_mobile/features/booking/presentation/widgets/booking_package_picker.dart';
import 'package:hospital_booking_mobile/features/catalog/domain/catalog_entities.dart';
import 'package:hospital_booking_mobile/features/home/presentation/widgets/home_content_sections.dart';
import 'package:hospital_booking_mobile/features/notifications/domain/patient_notification.dart';
import 'package:hospital_booking_mobile/features/notifications/presentation/widgets/notification_list_widgets.dart';
import 'package:hospital_booking_mobile/core/widgets/app_filter_tabs.dart';
import 'package:hospital_booking_mobile/features/notifications/application/push_notifications_controller.dart';
import 'package:hospital_booking_mobile/features/packages/domain/medical_package.dart';
import 'package:hospital_booking_mobile/features/profile/domain/patient_profile.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_menu_widgets.dart';
import 'package:hospital_booking_mobile/features/profile/presentation/widgets/profile_summary_widgets.dart';

/// Chặn lỗi thẻ bị bó, chữ tràn hoặc vỡ khi người dùng đặt cỡ chữ hệ thống lớn.
/// Mỗi màn có thẻ chứa chữ dài phải được dựng ở nhiều cỡ chữ mà không phát sinh lỗi bố cục.
const _scales = [1.0, 1.3, 1.6, 2.0];

Widget _host(double scale, Widget child) => MaterialApp(
  theme: AppTheme.light,
  builder: (context, home) => MediaQuery(
    data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
    child: home!,
  ),
  home: Scaffold(body: child),
);

final _longPackage = MedicalPackage(
  id: 'p1',
  name:
      'Gói khám sức khỏe tổng quát nâng cao dành cho người trên bốn mươi tuổi',
  basePrice: 1500000,
  serviceFee: 0,
  includedItemsTotal: 1500000,
  finalPrice: 1850000,
  isPopular: true,
  isBhytSupport: true,
  slug: 'goi-kham-nang-cao',
  summary: 'Xét nghiệm máu, siêu âm ổ bụng, điện tim, X-quang phổi và tư vấn.',
  departmentId: 'd1',
  departmentName: 'Khoa khám bệnh tổng hợp và chăm sóc sức khỏe',
);

const _longDoctor = BookingDoctor(
  id: 'a',
  fullName: 'Nguyễn Minh Hoàng Phúc Thịnh',
  title: 'PGS.TS.BSCKII',
  departmentId: 'd1',
  departmentName: 'Khoa cơ xương khớp và phục hồi chức năng',
  consultationFee: 350000,
  specialization: 'Chấn thương chỉnh hình và y học thể thao',
  experience: 22,
);

void main() {
  for (final scale in _scales) {
    testWidgets('bảng chọn gói khám không vỡ ở cỡ chữ $scale', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        _host(
          scale,
          Builder(
            builder: (context) => TextButton(
              onPressed: () => showBookingPackagePicker(
                context,
                packages: [_longPackage],
                onSelected: (_) {},
              ),
              child: const Text('mở'),
            ),
          ),
        ),
      );
      await tester.tap(find.text('mở'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('booking-package-p1')), findsOneWidget);
    });

    testWidgets('bảng chọn bác sĩ không vỡ ở cỡ chữ $scale', (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        _host(
          scale,
          Builder(
            builder: (context) => TextButton(
              onPressed: () => showBookingDoctorPicker(
                context,
                doctors: const [_longDoctor],
                departments: const [
                  BookingDepartment(
                    id: 'd1',
                    name: 'Khoa cơ xương khớp và phục hồi chức năng',
                  ),
                  BookingDepartment(id: 'd2', name: 'Da liễu'),
                ],
                onSelected: (_) {},
              ),
              child: const Text('mở'),
            ),
          ),
        ),
      );
      await tester.tap(find.text('mở'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('booking-doctor-a')), findsOneWidget);
    });

    testWidgets('dải bác sĩ và gói khám ở Trang chủ không vỡ ở cỡ chữ $scale', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        _host(
          scale,
          ListView(
            children: const [
              HomeDoctorStrip(
                items: [
                  CatalogDoctor(
                    id: 'a',
                    fullName: 'Nguyễn Minh Hoàng Phúc Thịnh',
                    title: 'PGS.TS.BSCKII',
                    departmentName: 'Khoa cơ xương khớp và phục hồi',
                    consultationFee: 350000,
                    experience: 22,
                    averageRating: 4.8,
                    reviewCount: 12,
                    todayAvailableSlots: [
                      CatalogDoctorSlot(startTime: '08:00', endTime: '08:30'),
                      CatalogDoctorSlot(startTime: '08:30', endTime: '09:00'),
                      CatalogDoctorSlot(startTime: '09:00', endTime: '09:30'),
                    ],
                  ),
                ],
              ),
              HomePackageStrip(
                items: [
                  CatalogMedicalPackage(
                    id: 'p1',
                    name:
                        'Gói khám sức khỏe tổng quát nâng cao dành cho người trên bốn mươi tuổi',
                    finalPrice: 1850000,
                    isPopular: true,
                    isBhytSupport: true,
                    summary:
                        'Xét nghiệm máu, siêu âm ổ bụng, điện tim, X-quang phổi và tư vấn.',
                  ),
                ],
              ),
            ],
          ),
        ),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('thông báo và tab lọc không vỡ ở cỡ chữ $scale', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        _host(
          scale,
          Column(
            children: [
              AppFilterTabs<String>(
                items: const ['Tất cả', 'Chưa đọc', 'Lịch hẹn'],
                selected: 'Chưa đọc',
                labelOf: (item) => item,
                onChanged: (_) {},
              ),
              NotificationCard(
                item: PatientNotification(
                  id: 'n1',
                  type: PatientNotificationType.appointmentConfirmed,
                  title:
                      'Lịch khám của bạn đã được cơ sở khám xác nhận thành công',
                  body:
                      'Lịch LK-20261120-0042 vào 25/11 lúc 08:30 với BS Đỗ Quang Huy',
                  publishedAt: DateTime.now().subtract(
                    const Duration(hours: 5),
                  ),
                  isRead: false,
                ),
                onTap: () {},
              ),
            ],
          ),
        ),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('tab Tài khoản không vỡ ở cỡ chữ $scale', (tester) async {
      tester.view.physicalSize = const Size(360, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      const profile = PatientProfile(
        id: 'p1',
        fullName: 'Nguyễn Thị Minh Hoàng Phương Thảo',
        phone: '0325123346',
        isEmailVerified: true,
        hasBhyt: false,
      );
      await tester.pumpWidget(
        _host(
          scale,
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ProfileHeader(profile: profile, onEdit: () {}),
              ProfileCompletionBanner(profile: profile, onTap: () {}),
              const ProfileQuickTiles(),
              ProfileMenuList(
                pushState: const PushNotificationsState(
                  isCheckingPermission: false,
                ),
                onEditProfile: () {},
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
