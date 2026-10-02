import 'dart:async';

class SessionEvents {
  final _invalidatedController = StreamController<void>.broadcast();

  Stream<void> get invalidated => _invalidatedController.stream;

  void invalidate() {
    if (!_invalidatedController.isClosed) {
      _invalidatedController.add(null);
    }
  }

  Future<void> dispose() => _invalidatedController.close();
}
