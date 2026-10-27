enum MainNavigationBranch {
  home(path: '/home'),
  records(path: '/records'),
  booking(path: '/booking'),
  notifications(path: '/notifications'),
  profile(path: '/profile');

  const MainNavigationBranch({required this.path});

  final String path;

  static MainNavigationBranch fromIndex(int index) {
    if (index < 0 || index >= values.length) return home;
    return values[index];
  }
}
