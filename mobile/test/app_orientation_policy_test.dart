import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/app/app_orientation_policy.dart';

void main() {
  test('phones are locked to portrait, tablets rotate freely', () {
    expect(preferredOrientationsFor(393), [DeviceOrientation.portraitUp]);
    expect(preferredOrientationsFor(599), [DeviceOrientation.portraitUp]);
    expect(preferredOrientationsFor(600), DeviceOrientation.values);
    expect(preferredOrientationsFor(820), DeviceOrientation.values);
  });

  testWidgets('policy applies the orientation list for the current size', (
    tester,
  ) async {
    final calls = <List<Object?>>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'SystemChrome.setPreferredOrientations') {
          calls.add(call.arguments as List<Object?>);
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );

    Future<void> pumpAt(Size size) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      await tester.pumpWidget(
        const MaterialApp(home: AppOrientationPolicy(child: SizedBox())),
      );
    }

    addTearDown(tester.view.reset);
    await pumpAt(const Size(393, 851));
    expect(calls.last, ['DeviceOrientation.portraitUp']);

    await pumpAt(const Size(851, 393)); // phone xoay ngang: vẫn khóa dọc
    expect(calls, hasLength(1));

    await pumpAt(const Size(820, 1180)); // máy tính bảng
    expect(calls.last, hasLength(DeviceOrientation.values.length));
  });
}
