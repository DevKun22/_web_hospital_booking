class AccessTokenStore {
  String? _accessToken;

  String? get accessToken => _accessToken;
  bool get hasToken => _accessToken?.isNotEmpty ?? false;

  void set(String token) => _accessToken = token;
  void clear() => _accessToken = null;
}
