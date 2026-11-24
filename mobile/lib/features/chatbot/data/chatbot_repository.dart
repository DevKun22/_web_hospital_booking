import 'package:dio/dio.dart';
import 'package:hospital_booking_mobile/core/errors/api_exception.dart';
import 'package:hospital_booking_mobile/core/network/api_contract.dart';
import 'package:hospital_booking_mobile/features/chatbot/domain/chatbot_models.dart';

import 'package:hospital_booking_mobile/core/network/api_guard.dart';

class ChatbotRepository {
  ChatbotRepository(this._dio);

  final Dio _dio;

  Future<ChatbotSettings> getSettings() async {
    return guardApi(() async {
      final response = await _dio.get<dynamic>('/chatbot/settings');
      return ChatbotSettings.fromJson(requireDataMap(response.data));
    });
  }

  Future<ChatbotResponse> sendMessage({
    required String message,
    String? sessionId,
    ChatbotAction? action,
  }) async {
    return guardApi(() async {
      // Trạng thái hội thoại do máy chủ giữ; danh tính lấy từ token của authDio (khách thì không có token).
      final response = await _dio.post<dynamic>(
        '/chatbot/message',
        data: {
          'sessionId': ?sessionId,
          'message': message.trim(),
          'action': ?action?.toJson(),
        },
      );
      final result = ChatbotResponse.fromJson(requireDataMap(response.data));
      if (result.sessionId.isEmpty || result.reply.trim().isEmpty) {
        throw const ApiException(
          kind: ApiErrorKind.unknown,
          code: 'INVALID_API_CONTRACT',
          message: 'Phản hồi chatbot không đúng định dạng.',
        );
      }
      return result;
    });
  }
}
