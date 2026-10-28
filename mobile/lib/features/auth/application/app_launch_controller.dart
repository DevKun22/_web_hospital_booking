import 'package:flutter_riverpod/flutter_riverpod.dart';

final appLaunchControllerProvider = NotifierProvider<AppLaunchController, bool>(
  AppLaunchController.new,
);

class AppLaunchController extends Notifier<bool> {
  @override
  bool build() => false;

  void completePresentation() {
    if (!state) state = true;
  }
}
