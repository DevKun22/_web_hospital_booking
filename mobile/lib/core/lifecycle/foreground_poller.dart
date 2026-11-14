import 'dart:async';

import 'package:flutter/widgets.dart';

/// Gọi [onTick] định kỳ nhưng chỉ khi ứng dụng đang ở tiền cảnh.
///
/// Khi ứng dụng xuống nền hoặc bị che, bộ đếm dừng hẳn (không gọi API vô ích, đỡ pin và đỡ tải
/// cho máy chủ); khi quay lại, bộ đếm chạy lại từ đầu chu kỳ. Việc làm mới ngay lúc quay lại do
/// `PatientDataSyncCoordinator.handleAppResumed` đảm nhiệm, nên bộ này không tự gọi thêm.
class ForegroundPoller with WidgetsBindingObserver {
  ForegroundPoller({required this.interval, required this.onTick});

  final Duration interval;
  final void Function() onTick;

  Timer? _timer;
  bool _started = false;

  bool get isRunning => _timer != null;

  void start() {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    final state = WidgetsBinding.instance.lifecycleState;
    if (state == null || state == AppLifecycleState.resumed) _schedule();
  }

  void stop() {
    if (!_started) return;
    _started = false;
    WidgetsBinding.instance.removeObserver(this);
    _cancel();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!_started) return;
    if (state == AppLifecycleState.resumed) {
      _schedule();
    } else {
      _cancel();
    }
  }

  void _schedule() {
    _cancel();
    _timer = Timer.periodic(interval, (_) => onTick());
  }

  void _cancel() {
    _timer?.cancel();
    _timer = null;
  }
}
