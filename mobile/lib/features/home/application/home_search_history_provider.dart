import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/core/errors/swallowed_error.dart';
import 'package:hospital_booking_mobile/features/home/data/home_search_history_store.dart';

final homeSearchHistoryStoreProvider = Provider<HomeSearchHistoryStore>((ref) {
  try {
    return SharedHomeSearchHistoryStore();
  } catch (error) {
    logSwallowedError('home_search_history_provider', error);
    // Some test/desktop hosts do not register the preferences plugin.
    // Search must still work; only persistence is skipped for that process.
    return MemoryHomeSearchHistoryStore();
  }
});
