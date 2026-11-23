import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/features/dependents/application/dependent_profiles_controller.dart';
import 'package:hospital_booking_mobile/features/dependents/domain/dependent_profile.dart';
import 'package:hospital_booking_mobile/features/dependents/presentation/dependent_detail_screen.dart';
import 'package:hospital_booking_mobile/features/dependents/presentation/dependent_wizard_screen.dart';

const _child = DependentProfile(
  id: 'd1',
  fullName: 'Nguyễn Bé An',
  relationship: DependentRelationship.child,
  hasBhyt: false,
);

class _Recorder extends DependentProfilesController {
  _Recorder(this.created, this.updated);

  final List<DependentProfileDraft> created;
  final List<Map<String, Object?>> updated;

  @override
  DependentProfilesState build() =>
      const DependentProfilesState(items: [_child], loaded: true);

  @override
  Future<DependentProfile?> create(DependentProfileDraft draft) async {
    created.add(draft);
    return _child;
  }

  @override
  Future<bool> updateFields(String id, Map<String, Object?> fields) async {
    updated.add(fields);
    return true;
  }
}

Future<void> _pump(
  WidgetTester tester,
  Widget screen,
  _Recorder recorder,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        dependentProfilesControllerProvider.overrideWith(() => recorder),
      ],
      child: MaterialApp(home: screen),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('wizard: cần chọn quan hệ, nhập tên và tick xác nhận mới lưu', (
    tester,
  ) async {
    final created = <DependentProfileDraft>[];
    await _pump(tester, const DependentWizardScreen(), _Recorder(created, []));

    // Chưa chọn quan hệ thì nút Tiếp tục bị khóa.
    final next = find.byKey(const ValueKey('wizard-next'));
    expect(tester.widget<FilledButton>(next).onPressed, isNull);
    await tester.tap(find.text('Con'));
    await tester.pumpAndSettle();
    await tester.tap(next);
    await tester.pumpAndSettle();

    // Tên quá ngắn bị chặn.
    await tester.enterText(find.byType(TextFormField), 'A');
    await tester.tap(next);
    await tester.pumpAndSettle();
    expect(find.text('Họ tên tối thiểu 2 ký tự.'), findsOneWidget);

    await tester.enterText(find.byType(TextFormField), 'Nguyễn Bé An');
    await tester.tap(next);
    await tester.pumpAndSettle();

    // Chưa tick xác nhận thì không lưu.
    await tester.tap(next);
    await tester.pumpAndSettle();
    expect(created, isEmpty);
    expect(find.text('Cần xác nhận quyền quản lý hồ sơ này.'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('dependent-consent')));
    await tester.pumpAndSettle();
    await tester.tap(next);
    await tester.pumpAndSettle();

    expect(created, hasLength(1));
    expect(created.single.fullName, 'Nguyễn Bé An');
    expect(created.single.relationship, DependentRelationship.child);
    expect(created.single.consentConfirmed, isTrue);
  });

  testWidgets('chi tiết: chạm một dòng chỉ gửi đúng trường vừa sửa', (
    tester,
  ) async {
    final updated = <Map<String, Object?>>[];
    await _pump(
      tester,
      const DependentDetailScreen(dependentId: 'd1'),
      _Recorder([], updated),
    );

    final row = find.byKey(const ValueKey('row-fullName'));
    await tester.tap(row);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('edit-sheet-field')),
      'Nguyễn Bé Bình',
    );
    await tester.tap(find.byKey(const ValueKey('edit-sheet-save')));
    await tester.pumpAndSettle();

    expect(updated, [
      {'fullName': 'Nguyễn Bé Bình'},
    ]);
  });

  testWidgets('chi tiết: bật BHYT phải kèm mã thẻ trong cùng yêu cầu', (
    tester,
  ) async {
    final updated = <Map<String, Object?>>[];
    await _pump(
      tester,
      const DependentDetailScreen(dependentId: 'd1'),
      _Recorder([], updated),
    );

    final toggle = find.byKey(const ValueKey('switch-bhyt'));
    await tester.scrollUntilVisible(
      toggle,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(toggle);
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const ValueKey('edit-sheet-field')),
      'DN4797912345678',
    );
    await tester.tap(find.byKey(const ValueKey('edit-sheet-save')));
    await tester.pumpAndSettle();

    expect(updated, [
      {'hasBHYT': true, 'healthInsuranceCode': 'DN4797912345678'},
    ]);
  });
}
