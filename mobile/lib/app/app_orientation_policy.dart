import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Điện thoại chỉ dùng hướng dọc (giao diện và biểu mẫu thiết kế cho dọc, bàn phím
/// ở hướng ngang che gần hết màn hình); máy tính bảng được xoay tự do.
const double tabletShortestSide = 600;

List<DeviceOrientation> preferredOrientationsFor(double shortestSide) =>
    shortestSide >= tabletShortestSide
    ? DeviceOrientation.values
    : const [DeviceOrientation.portraitUp];

class AppOrientationPolicy extends StatefulWidget {
  const AppOrientationPolicy({super.key, required this.child});

  final Widget child;

  @override
  State<AppOrientationPolicy> createState() => _AppOrientationPolicyState();
}

class _AppOrientationPolicyState extends State<AppOrientationPolicy> {
  bool? _isTablet;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Cạnh ngắn không đổi khi xoay nên không bị lật qua lại giữa hai chế độ.
    final isTablet =
        MediaQuery.sizeOf(context).shortestSide >= tabletShortestSide;
    if (_isTablet == isTablet) return;
    _isTablet = isTablet;
    SystemChrome.setPreferredOrientations(
      preferredOrientationsFor(MediaQuery.sizeOf(context).shortestSide),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
