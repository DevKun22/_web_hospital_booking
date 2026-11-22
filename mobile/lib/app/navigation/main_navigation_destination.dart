enum MainNavigationBranch {
  home(path: '/home'),
  services(path: '/services'),
  booking(path: '/booking'),
  appointments(path: '/appointments'),
  profile(path: '/profile');

  const MainNavigationBranch({required this.path});

  final String path;

  static MainNavigationBranch fromIndex(int index) {
    if (index < 0 || index >= values.length) return home;
    return values[index];
  }
}
