import 'package:flutter_test/flutter_test.dart';
import 'package:novelist_workspace/state/error_reporter.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// What the phone tells the admin when something breaks. The point is what is NOT sent: no writing, no names.
Future<ErrorReporter> reporter(
  List<Map<String, String>> sent, {
  Map<String, Object> initial = const {},
  ReportSink? sink,
}) async {
  SharedPreferences.setMockInitialValues({...initial});
  final prefs = await SharedPreferences.getInstance();
  return ErrorReporter(
    prefs,
    sink ??
        (report) async {
          sent.add(report);
        },
    version: '1.2.3',
  );
}

StackTrace stackAt(String frames) => StackTrace.fromString(frames);

const ownFrames =
    '#0      Reader.build (package:novelist_workspace/screens/read/reader_screen.dart:112:9)\n'
    '#1      State.setState (package:flutter/src/widgets/framework.dart:1234:5)\n'
    '#2      main (file:///data/user/0/com.example.novelist/app_flutter/lib/main.dart:3:3)\n';

void main() {
  group('what is taken out of a report', () {
    test('an email address and a sign-in token', () {
      final said = scrubMessage(
        'Could not save for ada@example.com with eyJhbGciOiJIUzI1NiJ9.abcdefghij.sig',
      );
      expect(said, contains('[email]'));
      expect(said, contains('[token]'));
      expect(said, isNot(contains('ada@example.com')));
      expect(said, isNot(contains('eyJhbGci')));
    });

    test('a piece of the text that could not be read is not kept', () {
      final said = scrubMessage(
        'FormatException: Unexpected character (at character 1)\n{"title": "My secret chapter"}\n^',
      );
      expect(said, 'FormatException: Unexpected character (at character 1)');
    });

    test('the host and the query of an address, but not which file failed', () {
      final said = scrubMessage(
        'Failed to load https://novel.example.com/assets/Reader.js?token=abc123',
      );
      expect(said, contains('/assets/Reader.js'));
      expect(said, isNot(contains('novel.example.com')));
      expect(said, isNot(contains('token=abc123')));
    });

    test('folders on the phone', () {
      final said = scrubMessage(
        'Cannot open /data/user/0/com.example.novelist/files/chapters.json',
      );
      expect(said, isNot(contains('/data/user/0')));
      expect(said, contains('chapters.json'));
    });

    test('a long message is cut short', () {
      expect(scrubMessage('x' * 900).length, 300);
    });

    test('a stack keeps where in the program, and nothing about this phone', () {
      final cleaned = cleanStack(stackAt(ownFrames));
      expect(cleaned, contains('Reader.build (package:novelist_workspace/screens/read/reader_screen.dart:112:9)'));
      expect(cleaned, isNot(contains('/data/user/0')));
      expect(cleaned, isNot(contains('com.example.novelist')));
      expect(cleaned.split('\n'), hasLength(3));
    });

    test('lines of a stack that are not places in the program are dropped (the first line repeats the message)', () {
      final cleaned = cleanStack(
        stackAt('Bad state: ada@example.com has no chapters\n#0      A.b (package:novelist_workspace/a.dart:1:1)'),
      );
      expect(cleaned, isNot(contains('ada@example.com')));
      expect(cleaned.split('\n'), hasLength(1));
    });
  });

  group('grouping the same problem', () {
    test('differences in numbers or quoted words do not make a new problem', () {
      final cleaned = cleanStack(stackAt(ownFrames));
      expect(
        fingerprintOf('RangeError: Invalid value: 5 for "abc"', cleaned),
        fingerprintOf('RangeError: Invalid value: 9 for "xyz"', cleaned),
      );
    });

    test('a different problem, or a different place, is a different one', () {
      final cleaned = cleanStack(stackAt(ownFrames));
      final other = cleanStack(
        stackAt('#0      Other.build (package:novelist_workspace/screens/other.dart:5:5)'),
      );
      expect(fingerprintOf('StateError: one', cleaned), isNot(fingerprintOf('StateError: two words', cleaned)));
      expect(fingerprintOf('StateError: one', cleaned), isNot(fingerprintOf('StateError: one', other)));
    });

    test('line numbers moving between versions do not split a problem', () {
      expect(
        fingerprintOf('StateError: x', cleanStack(stackAt('#0      A.b (package:novelist_workspace/a.dart:10:2)'))),
        fingerprintOf('StateError: x', cleanStack(stackAt('#0      A.b (package:novelist_workspace/a.dart:48:9)'))),
      );
    });
  });

  group('reporting', () {
    test('sends a short report with where, which version, and nothing private', () async {
      final sent = <Map<String, String>>[];
      final r = await reporter(sent);
      r.report(StateError('chapter of ada@example.com is missing'), stackAt(ownFrames), where: 'flutter');
      await Future<void>.delayed(Duration.zero);

      expect(sent, hasLength(1));
      final report = sent.single;
      expect(report['message'], 'StateError: Bad state: chapter of [email] is missing');
      expect(report['where'], 'flutter');
      expect(report['version'], '1.2.3');
      expect(report['device'], 'phone');
      expect(report['fingerprint'], hasLength(8));
      expect(report['stack'], contains('Reader.build'));
      expect(report.values.join(' '), isNot(contains('ada@example.com')));
    });

    test('the same problem is sent three times at most', () async {
      final sent = <Map<String, String>>[];
      final r = await reporter(sent);
      for (var i = 0; i < 8; i++) {
        r.report(StateError('again'), stackAt(ownFrames));
      }
      await Future<void>.delayed(Duration.zero);
      expect(sent, hasLength(3));
      // A different problem still gets through
      r.report(StateError('something else'), stackAt(ownFrames));
      await Future<void>.delayed(Duration.zero);
      expect(sent, hasLength(4));
    });

    test('a lost connection is not a bug in the app', () async {
      final sent = <Map<String, String>>[];
      final r = await reporter(sent);
      r.report(Exception('SocketException: Failed host lookup: example.com'), null);
      r.report(Exception('Connection refused'), null);
      await Future<void>.delayed(Duration.zero);
      expect(sent, isEmpty);
    });

    test('switched off, nothing is sent, and the choice is remembered', () async {
      final sent = <Map<String, String>>[];
      final r = await reporter(sent, initial: {'error_reports': 'off'});
      expect(r.enabled, isFalse);
      r.report(StateError('quiet'), stackAt(ownFrames));
      await Future<void>.delayed(Duration.zero);
      expect(sent, isEmpty);

      await r.setEnabled(true);
      expect(r.enabled, isTrue);
      r.report(StateError('now heard'), stackAt(ownFrames));
      await Future<void>.delayed(Duration.zero);
      expect(sent, hasLength(1));
    });

    test('reporting never breaks the app, however the sending fails', () async {
      final slow = await reporter(
        [],
        sink: (_) async => throw StateError('the server said no'),
      );
      final instant = await reporter(
        [],
        sink: (_) => throw StateError('thrown before a future'),
      );
      expect(() => slow.report(StateError('a'), null), returnsNormally);
      expect(() => instant.report(StateError('b'), null), returnsNormally);
      await Future<void>.delayed(Duration.zero);
    });
  });
}
