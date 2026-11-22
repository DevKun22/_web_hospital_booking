import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:hospital_booking_mobile/core/design/app_design_tokens.dart';

/// Thu nhỏ nhẹ khi ngón tay chạm vào, trả lại khi nhả. Chỉ nghe sự kiện con trỏ nên không chặn thao tác chạm của phần tử bên trong.
/// Tắt khi người dùng bật giảm chuyển động.
class PressScale extends StatefulWidget {
  const PressScale({super.key, required this.child, this.scale = 0.97});

  final Widget child;
  final double scale;

  @override
  State<PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<PressScale> {
  bool _down = false;

  void _set(bool value) {
    if (_down != value) setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) => Listener(
    onPointerDown: (_) => _set(true),
    onPointerUp: (_) => _set(false),
    onPointerCancel: (_) => _set(false),
    child: AnimatedScale(
      scale: _down ? widget.scale : 1,
      duration: AppMotion.responsive(
        context,
        const Duration(milliseconds: 110),
      ),
      curve: Curves.easeOut,
      child: widget.child,
    ),
  );
}

/// Hiện dần và trượt nhẹ từ dưới lên một lần khi khối xuất hiện; [order] xếp lớp để các khối nối nhau thay vì cùng lúc.
class FadeSlideIn extends StatelessWidget {
  const FadeSlideIn({super.key, required this.child, this.order = 0});

  final Widget child;
  final int order;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    final delay = Duration(milliseconds: 45 * math.min(order, 8));
    final total = AppMotion.deliberate + delay;
    final start = delay.inMilliseconds / total.inMilliseconds;
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: total,
      curve: Interval(start, 1, curve: Curves.easeOutCubic),
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, 14 * (1 - value)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

/// Ô chờ tải nhấp nháy nhẹ (thay cho ô xám đứng yên), dừng khi giảm chuyển động.
class PulseBox extends StatefulWidget {
  const PulseBox({
    super.key,
    required this.height,
    this.width,
    this.radius = AppRadius.card,
  });

  final double height;
  final double? width;
  final double radius;

  @override
  State<PulseBox> createState() => _PulseBoxState();
}

class _PulseBoxState extends State<PulseBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context) || !AppMotion.ambientEnabled) {
      _controller.stop();
    } else if (!_controller.isAnimating) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = Theme.of(context).colorScheme.surfaceContainerHighest;
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Container(
        height: widget.height,
        width: widget.width,
        decoration: BoxDecoration(
          color: Color.lerp(
            color,
            color.withValues(alpha: 0.55),
            Curves.easeInOut.transform(_controller.value),
          ),
          borderRadius: BorderRadius.circular(widget.radius),
        ),
      ),
    );
  }
}

/// Hai lớp sóng mờ trôi chậm ở đáy dải đầu: nền sống động nhưng nhẹ (một bộ điều khiển 26 giây, vẽ lại đúng một vùng).
/// Đứng yên khi giảm chuyển động; tự dừng khi màn hình không hiển thị (TickerMode).
class WaveBackdrop extends StatefulWidget {
  const WaveBackdrop({super.key, this.color = Colors.white, this.height = 36});

  final Color color;
  final double height;

  @override
  State<WaveBackdrop> createState() => _WaveBackdropState();
}

class _WaveBackdropState extends State<WaveBackdrop>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 26),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context) || !AppMotion.ambientEnabled) {
      _controller.stop();
    } else if (!_controller.isAnimating) {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => IgnorePointer(
    child: RepaintBoundary(
      child: SizedBox(
        height: widget.height,
        width: double.infinity,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) => CustomPaint(
            painter: _WavePainter(widget.color, _controller.value),
          ),
        ),
      ),
    ),
  );
}

class _WavePainter extends CustomPainter {
  _WavePainter(this.color, this.phase);

  final Color color;
  final double phase;

  void _wave(Canvas canvas, Size size, double alpha, double shift, double amp) {
    final path = Path()..moveTo(0, size.height);
    for (double x = 0; x <= size.width; x += 6) {
      final y =
          size.height * 0.5 +
          math.sin((x / size.width) * math.pi * 2 + shift) * amp;
      path.lineTo(x, y);
    }
    path
      ..lineTo(size.width, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = color.withValues(alpha: alpha));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final t = phase * math.pi * 2;
    _wave(canvas, size, 0.1, t, size.height * 0.22);
    _wave(canvas, size, 0.16, -t * 1.3 + 1.6, size.height * 0.16);
  }

  @override
  bool shouldRepaint(_WavePainter old) =>
      old.phase != phase || old.color != color;
}
