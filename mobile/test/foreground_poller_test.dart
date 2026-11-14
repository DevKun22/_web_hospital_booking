import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hospital_booking_mobile/core/lifecycle/foreground_poller.dart';

void main() {
  testWidgets('ticks while foreground and pauses in the background', (
    tester,
  ) async {
    var ticks = 0;
    final poller = ForegroundPoller(
      interval: const Duration(seconds: 10),
      onTick: () => ticks += 1,
    )..start();

    await tester.pump(const Duration(seconds: 25));
    expect(ticks, 2);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    expect(poller.isRunning, isFalse);
    await tester.pump(const Duration(seconds: 60));
    expect(ticks, 2, reason: 'không gọi API khi ứng dụng ở nền');

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    expect(poller.isRunning, isTrue);
    await tester.pump(const Duration(seconds: 10));
    expect(ticks, 3);

    poller.stop();
  });

  testWidgets('stop cancels the timer and ignores later lifecycle changes', (
    tester,
  ) async {
    var ticks = 0;
    final poller = ForegroundPoller(
      interval: const Duration(seconds: 5),
      onTick: () => ticks += 1,
    )..start();

    poller.stop();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump(const Duration(seconds: 30));

    expect(poller.isRunning, isFalse);
    expect(ticks, 0);
  });
}
