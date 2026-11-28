// Nghiệm thu tự động trợ lý Kun trên máy ảo/thiết bị thật, chạy app thật với backend THỬ (không bao giờ trỏ production):
//   flutter test integration_test/chatbot_acceptance_test.dart -d emulator-5554 \
//     --dart-define=APP_ENV=development --dart-define=API_BASE_URL=http://10.0.2.2:4100/api/v1
// Backend phải chạy chế độ phát triển (OTP_DEBUG_ENABLED=true) trên DB thử có dữ liệu mẫu (seed:clinic, seed:chatbot-faq).
// Không cần khóa Gemini: hành trình chỉ dùng nút bấm và các câu tự nhiên mà máy chủ hiểu bằng quy tắc
// ("xem lịch hẹn của tôi", "hủy lịch hẹn giúp tôi", ngày giờ như "sáng thứ hai tuần sau").
//
// Hành trình (một người dùng, tự nhiên, từ khách có phiên trò chuyện → đăng nhập → đặt → hủy → đăng xuất → người khác):
//  1. Khách mở Kun, chọn chuyên khoa → bác sĩ → khung giờ bằng nút; Kun nói rõ CHƯA giữ chỗ.
//  2. Khách hỏi "xem lịch hẹn của tôi" → Kun mời đăng nhập; bấm nút → tab Lịch hẹn (không màn trắng) hiện đăng nhập.
//  3. Đăng nhập email + OTP → quay lại Kun: cuộc trò chuyện của khách còn nguyên; hỏi lại → Kun trả lời theo tài khoản.
//  4. Hỏi "sáng thứ hai tuần sau còn lịch không" → Kun vẫn nhớ bác sĩ đã chọn lúc là khách (phiên được xoay mang theo lựa chọn).
//  5. Chọn giờ → "Đặt lịch ngay" mở form điền sẵn → đặt thành công (đã đăng nhập).
//  6. Quay lại Kun: "hủy lịch hẹn giúp tôi" → hỏi xác nhận → xác nhận → "Mình đã hủy".
//  7. Đăng xuất → mở Kun: cuộc trò chuyện cũ (có thẻ lịch hẹn) đã bị xóa khỏi máy.
//  8. Người khác đăng nhập trên cùng máy, hỏi "xem lịch hẹn của tôi" → không thấy lịch của người trước.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:hospital_booking_mobile/app/bootstrap.dart';
import 'package:hospital_booking_mobile/app/hospital_booking_app.dart';
import 'package:hospital_booking_mobile/core/config/app_config.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:hospital_booking_mobile/features/auth/presentation/login_panel.dart';
import 'package:hospital_booking_mobile/features/booking/application/booking_submission_controller.dart';
import 'package:hospital_booking_mobile/features/chatbot/application/chatbot_controller.dart';
import 'package:integration_test/integration_test.dart';

const _timeout = Duration(seconds: 40);
final _runId = DateTime.now().millisecondsSinceEpoch % 100000;

/// Bơm khung hình tới khi [finder] xuất hiện (không dùng pumpAndSettle: khung chat có hoạt ảnh và đồng hồ đếm ngược chạy liên tục).
Future<void> _waitFor(WidgetTester tester, Finder finder, {Duration timeout = _timeout, String? reason}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 200));
    if (finder.evaluate().isNotEmpty) return;
  }
  // In các chữ đang hiện trên màn hình để biết đang kẹt ở đâu.
  final visible = find
      .byType(Text)
      .evaluate()
      .map((e) => (e.widget as Text).data ?? (e.widget as Text).textSpan?.toPlainText() ?? '')
      .where((t) => t.trim().isNotEmpty)
      .take(40)
      .join(' | ');
  fail('Hết thời gian chờ: ${reason ?? finder.describeMatch(Plurality.one)} — màn hình đang có: $visible');
}

Future<void> _tap(WidgetTester tester, Finder finder, {String? reason}) async {
  await _waitFor(tester, finder, reason: reason);
  await tester.ensureVisible(finder.last);
  await tester.pump(const Duration(milliseconds: 300));
  // Chỉ chạm vào phần tử thật sự nhận chạm: trang chủ có bản thu gọn của thanh tìm kiếm bị ẩn khi chưa cuộn.
  final touchable = finder.hitTestable();
  await tester.tap(touchable.evaluate().isNotEmpty ? touchable.last : finder.last);
  await tester.pump(const Duration(milliseconds: 300));
}

ProviderContainer _container(WidgetTester tester) =>
    ProviderScope.containerOf(tester.element(find.byType(HospitalBookingApp)));

/// Gõ một câu vào khung chat của Kun và gửi, rồi chờ Kun trả lời (khung nhập mở lại).
Future<void> _say(WidgetTester tester, String text) async {
  final input = find.byWidgetPredicate((w) => w is TextField && w.decoration?.hintText == 'Nhập câu hỏi…');
  await _waitFor(tester, input, reason: 'ô nhập của Kun');
  // Chờ Kun trả lời xong lượt trước (đang gửi thì không nhận tin mới).
  final endIdle = DateTime.now().add(_timeout);
  while (!_container(tester).read(chatbotControllerProvider).canSend && DateTime.now().isBefore(endIdle)) {
    await tester.pump(const Duration(milliseconds: 200));
  }
  final before = _container(tester).read(chatbotControllerProvider).messages.length;
  // Đặt nội dung vào ô rồi gọi đúng hàm xử lý phím "gửi" của ô nhập (onSubmitted): cùng đường gửi với người dùng, không phụ
  // thuộc bàn phím ảo hay focus (ô nhập bỏ focus sau mỗi lượt gửi).
  final field = tester.widget<TextField>(input);
  field.controller!.text = text;
  await tester.pump(const Duration(milliseconds: 200));
  field.onSubmitted!(text);
  await tester.pump(const Duration(milliseconds: 300));
  final end = DateTime.now().add(_timeout);
  while (DateTime.now().isBefore(end)) {
    final state = _container(tester).read(chatbotControllerProvider);
    // Đã có tin của người dùng và câu trả lời của Kun (hai tin mới), hoặc báo lỗi.
    if (state.messages.length >= before + 2 && !state.isSending) return;
    if (state.error != null && !state.isSending) fail('Kun báo lỗi khi gửi "$text": ${state.error?.message}');
    await tester.pump(const Duration(milliseconds: 200));
  }
  fail('Kun không trả lời câu: $text');
}

/// Chờ câu trả lời mới nhất của Kun chứa [snippet] (đọc trạng thái hội thoại: danh sách tin dựng lười, tin có thể ngoài màn hình).
Future<void> _expectReply(WidgetTester tester, String snippet, {required String reason}) async {
  final end = DateTime.now().add(_timeout);
  String last = '';
  while (DateTime.now().isBefore(end)) {
    final messages = _container(tester).read(chatbotControllerProvider).messages;
    last = messages.isEmpty ? '' : messages.last.content;
    if (last.contains(snippet)) return;
    await tester.pump(const Duration(milliseconds: 200));
  }
  fail('$reason — Kun trả lời: "$last"');
}

Future<void> _openKun(WidgetTester tester) async {
  await _tap(tester, find.text('Trang chủ'), reason: 'tab Trang chủ');
  // Nút "Hỏi Kun" gọi đúng context.push('/chatbot'); gọi trực tiếp vì bản thu gọn của thanh tìm kiếm che vùng chạm khi test.
  final button = find.byKey(const Key('home-ask-kun-button'));
  await _waitFor(tester, button, reason: 'nút Hỏi Kun');
  unawaited(GoRouter.of(tester.element(button.first)).push<void>('/chatbot'));
  await _waitFor(tester, find.text('Đang sẵn sàng hỗ trợ'), reason: 'Kun sẵn sàng');
}

/// Đăng nhập bằng email + OTP thử (mã đọc từ trạng thái app, máy chủ chế độ phát triển trả kèm).
Future<void> _login(WidgetTester tester, String email) async {
  final emailField = find.byWidgetPredicate((w) => w is TextField && w.decoration?.labelText == 'Email');
  await _waitFor(tester, emailField, reason: 'ô email đăng nhập');
  await tester.enterText(emailField, email);
  await _tap(tester, find.text('Gửi mã'));
  String? otp;
  final end = DateTime.now().add(_timeout);
  while (otp == null && DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 200));
    otp = _container(tester).read(authControllerProvider).challenge?.debugOtp;
  }
  expect(otp, isNotNull, reason: 'máy chủ thử phải trả mã OTP thử (OTP_DEBUG_ENABLED=true)');
  await tester.enterText(find.descendant(of: find.byType(OtpCodeField), matching: find.byType(TextField)), otp!);
  await tester.pump(const Duration(milliseconds: 300));
  final confirm = find.text('Xác nhận');
  if (confirm.evaluate().isNotEmpty) await _tap(tester, confirm);
  final end2 = DateTime.now().add(_timeout);
  while (_container(tester).read(authControllerProvider).user == null && DateTime.now().isBefore(end2)) {
    await tester.pump(const Duration(milliseconds: 200));
  }
  expect(_container(tester).read(authControllerProvider).user?.email, email);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Kun: khách có phiên → đăng nhập → đặt → hủy → đăng xuất → người khác', (tester) async {
    final emailA = 'kun.a.$_runId@mobile.invalid';
    final emailB = 'kun.b.$_runId@mobile.invalid';
    unawaited(bootstrap(AppEnvironment.development));
    await _waitFor(tester, find.byType(HospitalBookingApp), reason: 'app khởi động');
    // Lần đầu mở app có màn chào; chờ nó hiện (tối đa 10 giây) rồi bấm "Bắt đầu" để vào trang chủ.
    final start = find.text('Bắt đầu');
    final kunButton = find.byKey(const Key('home-ask-kun-button'));
    final endStart = DateTime.now().add(const Duration(seconds: 10));
    while (start.evaluate().isEmpty && DateTime.now().isBefore(endStart)) {
      await tester.pump(const Duration(milliseconds: 200));
    }
    if (start.evaluate().isNotEmpty) {
      await _tap(tester, start);
      final endGone = DateTime.now().add(const Duration(seconds: 10));
      while (start.evaluate().isNotEmpty && DateTime.now().isBefore(endGone)) {
        await tester.pump(const Duration(milliseconds: 200));
      }
    }
    await _waitFor(tester, kunButton, reason: 'trang chủ có nút Hỏi Kun');

    // 1. Khách chọn chuyên khoa → bác sĩ → khung giờ bằng nút.
    await _openKun(tester);
    await _tap(tester, find.text('Tìm khoa theo triệu chứng'));
    await _tap(tester, find.text('Chọn chuyên khoa'), reason: 'thẻ chuyên khoa');
    await _tap(tester, find.text('Khám theo bác sĩ'), reason: 'nút khám theo bác sĩ');
    await _tap(tester, find.text('Chọn bác sĩ'), reason: 'thẻ bác sĩ');
    await _tap(tester, find.text('Chọn khung giờ'), reason: 'thẻ khung giờ');
    await _expectReply(tester, 'giữ chỗ', reason: 'Kun nói rõ chưa giữ chỗ');

    // 2. Khách hỏi lịch của mình → mời đăng nhập; nút đăng nhập mở tab Lịch hẹn (không màn trắng).
    await _say(tester, 'xem lịch hẹn của tôi');
    await _tap(tester, find.text('Đăng nhập để xem lịch'), reason: 'nút đăng nhập của Kun');
    await _waitFor(tester, find.text('Gửi mã'), reason: 'tab Lịch hẹn hiện màn đăng nhập (không trắng)');

    // 3. Đăng nhập → quay lại Kun: cuộc trò chuyện của khách còn nguyên.
    await _login(tester, emailA);
    await _openKun(tester);
    // Danh sách tin dựng lười (tin cũ ngoài màn hình không được dựng): kiểm trạng thái hội thoại thay vì màn hình.
    final kept = _container(tester).read(chatbotControllerProvider);
    expect(kept.messages.any((m) => m.content.contains('giữ chỗ')), isTrue, reason: 'khách vừa đăng nhập: giữ cuộc trò chuyện');
    final guestSessionId = kept.sessionId;
    expect(guestSessionId, isNotNull);
    await _say(tester, 'xem lịch hẹn của tôi');
    await _expectReply(tester, 'chưa có lịch hẹn nào', reason: 'Kun trả lời theo tài khoản mới (chưa có lịch)');
    // Máy chủ xoay phiên khi khách đăng nhập (mã phiên mới, chống cố định phiên).
    expect(_container(tester).read(chatbotControllerProvider).sessionId, isNot(guestSessionId));

    // 4. Kun vẫn nhớ bác sĩ đã chọn lúc là khách.
    await _say(tester, 'sáng thứ hai tuần sau còn lịch không');
    await _waitFor(tester, find.text('Chọn khung giờ'), reason: 'Kun tìm giờ của đúng bác sĩ đã chọn trước khi đăng nhập');

    // 5. Chọn giờ → "Đặt lịch ngay" mở form điền sẵn → đặt thành công.
    await _tap(tester, find.text('Chọn khung giờ'));
    // Chờ Kun trả lời lượt chọn giờ rồi mới đọc bản nháp.
    final slotDeadline = DateTime.now().add(_timeout);
    while (DateTime.now().isBefore(slotDeadline)) {
      final state = _container(tester).read(chatbotControllerProvider);
      if (!state.isSending && state.draft?.timeSlotId != null) break;
      await tester.pump(const Duration(milliseconds: 200));
    }
    final chosenSlot = _container(tester).read(chatbotControllerProvider).draft?.timeSlotId;
    expect(chosenSlot, isNotNull, reason: 'Kun giữ khung giờ vừa chọn trong bản nháp');
    await _tap(tester, find.text('Đặt lịch ngay'), reason: 'nút đặt lịch có khung giờ điền sẵn');
    // Bước "Chọn lịch" hiện sẵn bác sĩ, ngày, giờ từ Kun; bấm "Tiếp tục" sang form thông tin.
    await _tap(tester, find.text('Tiếp tục'), reason: 'bước chọn lịch đã điền sẵn từ Kun');
    final name = find.byWidgetPredicate((w) => w is TextField && w.decoration?.labelText == 'Họ và tên *');
    await _waitFor(tester, name, reason: 'form thông tin người khám');
    if ((tester.widget<TextField>(name).controller?.text ?? '').trim().isEmpty) {
      await tester.enterText(name, 'Nguoi Kham A');
    }
    final phone = find.byWidgetPredicate((w) => w is TextField && w.decoration?.labelText == 'Số điện thoại *');
    if (phone.evaluate().isNotEmpty && (tester.widget<TextField>(phone).controller?.text ?? '').trim().isEmpty) {
      await tester.enterText(phone, '09${_runId.toString().padLeft(8, '0')}');
    }
    final submit = find.textContaining(RegExp(r'^(Đặt lịch|Giữ lịch, gửi OTP)$'));
    await _tap(tester, submit, reason: 'nút gửi đặt lịch');
    // Tài khoản trùng email đặt lịch có thể bỏ qua OTP; nếu máy chủ vẫn hỏi OTP thì nhập mã thử.
    final end = DateTime.now().add(_timeout);
    while (DateTime.now().isBefore(end)) {
      await tester.pump(const Duration(milliseconds: 300));
      if (find.textContaining(RegExp('Đặt lịch thành công|Đã tiếp nhận lịch khám')).evaluate().isNotEmpty) break;
      final pending = _container(tester).read(bookingSubmissionControllerProvider).pending;
      if (pending?.debugOtp != null && find.text('Xác nhận lịch khám').evaluate().isNotEmpty) {
        await tester.enterText(find.byType(TextField).last, pending!.debugOtp!);
        await _tap(tester, find.text('Xác nhận lịch khám'));
      }
    }
    expect(find.textContaining(RegExp('Đặt lịch thành công|Đã tiếp nhận lịch khám')), findsWidgets);

    // 6. Hủy qua Kun: hỏi xác nhận trước, xác nhận mới hủy.
    await _openKun(tester);
    await _say(tester, 'hủy lịch hẹn giúp tôi');
    await _tap(tester, find.text('Xác nhận hủy lịch'), reason: 'Kun hỏi xác nhận trước khi hủy');
    await _expectReply(tester, 'Mình đã hủy', reason: 'hủy thành công');

    // 7. Đăng xuất → cuộc trò chuyện có thẻ lịch hẹn bị xóa khỏi máy.
    await _tap(tester, find.text('Tài khoản'));
    await _tap(tester, find.text('Đăng xuất'), reason: 'nút đăng xuất');
    await _tap(tester, find.widgetWithText(FilledButton, 'Đăng xuất'), reason: 'xác nhận đăng xuất');
    final endLogout = DateTime.now().add(_timeout);
    while (_container(tester).read(authControllerProvider).user != null && DateTime.now().isBefore(endLogout)) {
      await tester.pump(const Duration(milliseconds: 200));
    }
    await _openKun(tester);
    expect(find.textContaining('Mình đã hủy'), findsNothing, reason: 'không còn thẻ lịch của người trước');
    final cleared = _container(tester).read(chatbotControllerProvider);
    expect(cleared.messages.length, 1, reason: 'chỉ còn lời chào');
    expect(cleared.sessionId, isNull, reason: 'không dùng lại phiên của tài khoản trước');
    expect(find.text('Tra cứu lịch hẹn'), findsOneWidget, reason: 'về lời chào ban đầu');

    // 8. Người khác đăng nhập trên cùng máy: không thấy lịch của người trước.
    await _tap(tester, find.text('Lịch hẹn'));
    await _login(tester, emailB);
    await _openKun(tester);
    await _say(tester, 'xem lịch hẹn của tôi');
    await _expectReply(tester, 'chưa có lịch hẹn nào', reason: 'tài khoản B không thấy lịch của A');
  });
}
