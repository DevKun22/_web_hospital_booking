import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hospital_booking_mobile/features/home/data/home_search_history_store.dart';

final homeSearchHistoryStoreProvider = Provider<HomeSearchHistoryStore>((ref) {
  try {
    return SharedHomeSearchHistoryStore();
  } catch (_) {
    // Some test/desktop hosts do not register the preferences plugin.
    // Search must still work; only persistence is skipped for that process.
    return MemoryHomeSearchHistoryStore();
  }
});
