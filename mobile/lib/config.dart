/// Where the app gets its data. Pass the cloud details when building:
///   flutter run --dart-define-from-file=env.json
/// With none, the app runs on this device alone (a few sample novels, nothing leaves the phone), just like the
/// web app does when it has no database.
class Config {
  Config._();

  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');

  static bool get hasCloud =>
      supabaseUrl.trim().isNotEmpty && supabaseAnonKey.trim().isNotEmpty;

  /// Which build this is, so a report says which release it came from (`--dart-define=APP_VERSION=1.2.3`)
  static const appVersion = String.fromEnvironment('APP_VERSION', defaultValue: 'phone');

  /// Where reading links point. Anyone with a link can read in a browser, or paste it into the app.
  static const publicAppUrl = String.fromEnvironment(
    'PUBLIC_APP_URL',
    defaultValue: 'https://novelistworkspace.kakamond.com/',
  );
}
