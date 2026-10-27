import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/providers/app_providers.dart';
import 'package:hospital_booking_mobile/features/auth/application/auth_controller.dart';
import 'package:local_auth/local_auth.dart';

final localAuthenticationGatewayProvider = Provider<LocalAuthenticationGateway>(
  (ref) => DeviceLocalAuthenticationGateway(LocalAuthentication()),
);

final appLockControllerProvider =
    NotifierProvider<AppLockController, AppLockState>(AppLockController.new);

const appLockBackgroundGracePeriod = Duration(seconds: 45);

abstract interface class LocalAuthenticationGateway {
  Future<bool> isSupported();
  Future<bool> authenticate();
}

class DeviceLocalAuthenticationGateway implements LocalAuthenticationGateway {
  const DeviceLocalAuthenticationGateway(this._authentication);

  final LocalAuthentication _authentication;

  @override
  Future<bool> isSupported() => _authentication.isDeviceSupported();

  @override
  Future<bool> authenticate() => _authentication.authenticate(
    localizedReason: 'Xác thực để mở dữ liệu y tế trên thiết bị này',
    biometricOnly: false,
    persistAcrossBackgrounding: true,
  );
}

class AppLockState {
  const AppLockState({
    this.enabled = false,
    this.supported = false,
    this.locked = false,
    this.isChecking = true,
    this.isAuthenticating = false,
    this.message,
  });

  final bool enabled;
  final bool supported;
  final bool locked;
  final bool isChecking;
  final bool isAuthenticating;
  final String? message;

  AppLockState copyWith({
    bool? enabled,
    bool? supported,
    bool? locked,
    bool? isChecking,
    bool? isAuthenticating,
    String? message,
    bool clearMessage = false,
  }) => AppLockState(
    enabled: enabled ?? this.enabled,
    supported: supported ?? this.supported,
    locked: locked ?? this.locked,
    isChecking: isChecking ?? this.isChecking,
    isAuthenticating: isAuthenticating ?? this.isAuthenticating,
    message: clearMessage ? null : (message ?? this.message),
  );
}

class AppLockController extends Notifier<AppLockState> {
  bool _authenticated = false;
  DateTime? _backgroundedAt;

  @override
  AppLockState build() {
    _authenticated = ref.watch(
      authControllerProvider.select((state) => state.isAuthenticated),
    );
    Future<void>.microtask(_load);
    return const AppLockState();
  }

  Future<void> _load() async {
    var enabled = false;
    try {
      enabled = await ref.read(appPreferencesProvider).isAppLockEnabled();
    } catch (_) {
      // Unit/widget tests and unsupported embedders may not register the
      // SharedPreferences platform. The secure default is app-lock disabled.
    }
    // Do not open a platform channel on every cold start when the feature is
    // disabled. Capability is verified immediately before the user enables it.
    var supported = !enabled;
    if (enabled) {
      try {
        supported = await ref
            .read(localAuthenticationGatewayProvider)
            .isSupported();
      } catch (_) {
        supported = false;
      }
    }
    state = AppLockState(
      enabled: enabled,
      supported: supported,
      locked: enabled && _authenticated,
      isChecking: false,
      message: enabled && !supported
          ? 'Thiết bị hiện không cung cấp phương thức khóa màn hình phù hợp.'
          : null,
    );
  }

  Future<bool> setEnabled(bool enabled) async {
    if (state.isChecking || state.isAuthenticating) return false;
    if (enabled) {
      var supported = false;
      try {
        supported = await ref
            .read(localAuthenticationGatewayProvider)
            .isSupported();
      } catch (_) {
        supported = false;
      }
      if (!supported) {
        state = state.copyWith(
          supported: false,
          message:
              'Hãy thiết lập vân tay, khuôn mặt hoặc mã khóa trên thiết bị trước.',
        );
        return false;
      }
      state = state.copyWith(supported: true);
    }
    state = state.copyWith(isAuthenticating: true, clearMessage: true);
    final authenticated = await _authenticate();
    if (!authenticated) {
      state = state.copyWith(
        isAuthenticating: false,
        message: 'Chưa xác thực nên cài đặt bảo mật không thay đổi.',
      );
      return false;
    }
    await ref.read(appPreferencesProvider).setAppLockEnabled(enabled);
    state = state.copyWith(
      enabled: enabled,
      locked: false,
      isAuthenticating: false,
      clearMessage: true,
    );
    _backgroundedAt = null;
    return true;
  }

  void noteBackgrounded({DateTime? now}) {
    if (!_authenticated || !state.enabled || state.isAuthenticating) return;
    _backgroundedAt ??= now ?? DateTime.now();
  }

  void handleAppResumed({DateTime? now}) {
    final backgroundedAt = _backgroundedAt;
    _backgroundedAt = null;
    if (backgroundedAt == null ||
        !_authenticated ||
        !state.enabled ||
        state.isAuthenticating) {
      return;
    }

    final elapsed = (now ?? DateTime.now()).difference(backgroundedAt);
    if (elapsed >= appLockBackgroundGracePeriod) {
      state = state.copyWith(locked: true, clearMessage: true);
    }
  }

  Future<bool> unlock() async {
    if (!state.enabled || !state.locked || state.isAuthenticating) return true;
    state = state.copyWith(isAuthenticating: true, clearMessage: true);
    final authenticated = await _authenticate();
    state = state.copyWith(
      locked: !authenticated,
      isAuthenticating: false,
      message: authenticated ? null : 'Không thể xác thực. Vui lòng thử lại.',
      clearMessage: authenticated,
    );
    return authenticated;
  }

  Future<bool> _authenticate() async {
    try {
      return await ref.read(localAuthenticationGatewayProvider).authenticate();
    } catch (_) {
      return false;
    }
  }
}
