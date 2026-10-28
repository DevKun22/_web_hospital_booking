import 'package:shared_preferences/shared_preferences.dart';

abstract interface class AppointmentPreparationStore {
  Future<Set<String>> read(String scope);
  Future<void> write(String scope, Set<String> completedItemIds);
}

class SharedAppointmentPreparationStore implements AppointmentPreparationStore {
  SharedAppointmentPreparationStore({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const _prefix = 'appointment_preparation_v1_';
  final SharedPreferencesAsync _preferences;

  @override
  Future<Set<String>> read(String scope) async {
    if (!_isSafeScope(scope)) return {};
    final values = await _preferences.getStringList('$_prefix$scope');
    return values?.toSet() ?? {};
  }

  @override
  Future<void> write(String scope, Set<String> completedItemIds) async {
    if (!_isSafeScope(scope)) return;
    final key = '$_prefix$scope';
    if (completedItemIds.isEmpty) {
      await _preferences.remove(key);
      return;
    }
    final sorted = completedItemIds.toList()..sort();
    await _preferences.setStringList(key, sorted);
  }

  bool _isSafeScope(String value) =>
      value.isNotEmpty &&
      value.length <= 220 &&
      RegExp(r'^[a-zA-Z0-9:_-]+$').hasMatch(value);
}

class MemoryAppointmentPreparationStore implements AppointmentPreparationStore {
  MemoryAppointmentPreparationStore([
    Map<String, Set<String>> initial = const {},
  ]) : values = {
         for (final entry in initial.entries) entry.key: {...entry.value},
       };

  final Map<String, Set<String>> values;

  @override
  Future<Set<String>> read(String scope) async => {...?values[scope]};

  @override
  Future<void> write(String scope, Set<String> completedItemIds) async {
    if (completedItemIds.isEmpty) {
      values.remove(scope);
    } else {
      values[scope] = {...completedItemIds};
    }
  }
}
