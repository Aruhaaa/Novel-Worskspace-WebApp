import 'package:shared_preferences/shared_preferences.dart';

/// Finding out what goes wrong on people's phones, so it can be fixed. When something breaks, a short report is sent:
/// what the error said, where in the program it happened, which part of the app was open and which version it was.
/// Never what anyone wrote, and never who they are. It can be switched off in Me.
///
/// With a cloud database the report goes to the list the admin reads on the website (Admin > Errors). On the phone
/// alone there is nowhere to send it, so it is dropped.

/// Messages that are about the phone or the connection, not about this app
final _noise = <RegExp>[
  RegExp(r'SocketException', caseSensitive: false),
  RegExp(r'HandshakeException', caseSensitive: false),
  RegExp(r'Failed host lookup', caseSensitive: false),
  RegExp(r'Connection (closed|refused|reset|failed)', caseSensitive: false),
  RegExp(r'ClientException with SocketException', caseSensitive: false),
  RegExp(r'TimeoutException', caseSensitive: false),
];

/// What the error said, with anything personal taken out: email addresses, sign-in tokens, a piece of someone's
/// writing (an engine puts the bit it could not read in the message), and the folders of this phone.
String scrubMessage(String message) {
  var s = message;
  s = s.replaceAllMapped(RegExp(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*'), (_) => '[token]');
  s = s.replaceAllMapped(RegExp(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'), (_) => '[email]');
  // FormatException: Unexpected character (at character 1) {"title": "My secret chapter ...
  s = s.replaceAllMapped(RegExp(r'(FormatException:[^\n]*)[\s\S]*'), (m) => m[1]!);
  // an address keeps its path (which file failed) but loses the host and anything after a "?"
  s = s.replaceAllMapped(RegExp(r'(https?://[^\s"\x27()?#]*)[?#][^\s"\x27()]*'), (m) => m[1]!);
  s = s.replaceAll(RegExp(r'https?://[^/\s"\x27()]+'), '');
  // places on this phone
  s = s.replaceAll(RegExp(r'(/data/user/\d+/[^\s)"\x27]*/|/storage/[^\s)"\x27]*/|[A-Za-z]:\\[^\s)"\x27]*\\)'), '');
  return s.length > 300 ? s.substring(0, 300) : s;
}

/// The stack as sent: where in the program, never the words of the message and never a folder on this phone.
String cleanStack(StackTrace? stack) {
  if (stack == null) return '';
  final frame = RegExp(r'^#\d+\s');
  final lines = stack
      .toString()
      .split('\n')
      .where((l) => frame.hasMatch(l.trim()))
      .take(14)
      .map(
        (l) => l
            .replaceAll(RegExp(r'file:///[^\s)]*/'), '')
            .replaceAll(RegExp(r'(/data/user/\d+/[^\s)]*/)'), '')
            .replaceAll(RegExp(r'\s{2,}'), ' '),
      )
      .toList();
  final text = lines.join('\n');
  return text.length > 3500 ? text.substring(0, 3500) : text;
}

/// Errors that differ only in numbers or quoted words group together
String normalise(String message) => message
    .replaceAll(RegExp(r'[0-9a-f]{8,}', caseSensitive: false), '#')
    .replaceAll(RegExp(r'\d+'), '#')
    .replaceAll(RegExp(r'"[^"]*"|\x27[^\x27]*\x27'), '…');

/// The first place in the app's own code where it went wrong, without line numbers that change between versions
String topFrame(String cleaned) {
  final lines = cleaned.split('\n');
  final own = lines.firstWhere(
    (l) => l.contains('package:novelist_workspace'),
    orElse: () => lines.isEmpty ? '' : lines.first,
  );
  return own.replaceAll(RegExp(r':\d+:\d+'), '').trim();
}

String fingerprintOf(String message, String cleanedStack) {
  var h = 0x811c9dc5;
  for (final unit in '${normalise(message)}|${topFrame(cleanedStack)}'.codeUnits) {
    h ^= unit;
    h = (h * 0x01000193) & 0xffffffff;
  }
  return h.toRadixString(16).padLeft(8, '0');
}

typedef ReportSink = Future<void> Function(Map<String, String> report);

class ErrorReporter {
  ErrorReporter(this.prefs, this.send, {this.version = 'phone'});

  final SharedPreferences prefs;
  final ReportSink send;
  final String version;

  static const _perProblem = 3;
  static const _perSession = 40;
  final _seen = <String, int>{};
  int _sent = 0;

  /// On unless switched off
  bool get enabled => prefs.getString('error_reports') != 'off';
  Future<void> setEnabled(bool on) => prefs.setString('error_reports', on ? 'on' : 'off');

  /// Report something that went wrong. Quietly does nothing if reports are off, the same problem has been
  /// seen too often, or it is just the connection.
  void report(Object error, StackTrace? stack, {String where = 'app'}) {
    try {
      if (!enabled) return;
      final said = '$error';
      final type = error.runtimeType.toString();
      final message = scrubMessage(said.startsWith(type) ? said : '$type: $said');
      if (_noise.any((re) => re.hasMatch(message))) return;
      final cleaned = cleanStack(stack);
      final fingerprint = fingerprintOf(message, cleaned);
      final count = (_seen[fingerprint] ?? 0) + 1;
      _seen[fingerprint] = count;
      if (count > _perProblem || _sent >= _perSession) return;
      _sent++;
      // Fire and forget: reporting is never waited for and never throws
      send({
        'fingerprint': fingerprint,
        'message': message,
        'stack': cleaned,
        'where': where,
        'version': version,
        'device': 'phone',
      }).catchError((Object _) {});
    } catch (_) {
      // Reporting must never be the thing that breaks
    }
  }
}
