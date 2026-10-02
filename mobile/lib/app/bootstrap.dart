import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/app/hospital_booking_app.dart';
import 'package:hospital_booking_mobile/core/config/app_config.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';

void bootstrap(AppEnvironment environment) {
  WidgetsFlutterBinding.ensureInitialized();
  final config = AppConfig.fromEnvironment(defaultEnvironment: environment);

  runApp(
    ProviderScope(
      overrides: [appConfigProvider.overrideWithValue(config)],
      child: const HospitalBookingApp(),
    ),
  );
}
