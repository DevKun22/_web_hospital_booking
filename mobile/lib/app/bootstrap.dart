import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/app/hospital_booking_app.dart';
import 'package:hospital_booking_mobile/core/config/app_config.dart';
import 'package:hospital_booking_mobile/core/errors/global_error_handler.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';

Future<void> bootstrap(AppEnvironment environment) async {
  WidgetsFlutterBinding.ensureInitialized();
  installGlobalErrorHandlers();
  final config = AppConfig.fromEnvironment(defaultEnvironment: environment);
  if (config.enableNetworkLogs) {
    debugPrint('[APP_CONFIG] API base URL: ${config.apiBaseUrl}');
  }

  runApp(
    ProviderScope(
      overrides: [appConfigProvider.overrideWithValue(config)],
      child: const HospitalBookingApp(),
    ),
  );
}
