import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:novelist_workspace/data/backend.dart';
import 'package:novelist_workspace/data/local_backend.dart';
import 'package:novelist_workspace/data/models.dart';
import 'package:novelist_workspace/state/app_state.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support.dart';

/// A phone-only backend that records what it was asked, and can pretend to be a cloud for the calls that matter here.
class RecordingBackend extends LocalBackend {
  RecordingBackend(SharedPreferences prefs, {this.sessionMode})
    : super.withData(prefs, LocalBackend.seed());

  /// What the pretend account already says it came for
  final String? sessionMode;

  final resets = <String>[];
  final reports = <String>[];
  final savedModes = <String>[];
  bool resetFails = false;

  @override
  Future<AppUser?> restoreSession() async {
    final base = await super.restoreSession();
    if (base == null || sessionMode == null) return base;
    return AppUser(id: base.id, email: base.email, mode: sessionMode);
  }

  @override
  Future<void> requestPasswordReset(String email) async {
    if (resetFails) throw BackendException('Too many requests. Please wait.');
    resets.add(email);
  }

  @override
  Future<void> saveUseMode(String mode) async => savedModes.add(mode);

  @override
  Future<void> reportNovel(
    String reporterId,
    Project project,
    String reason,
    String details,
  ) async {
    reports.add('${project.id}/$reason/$details');
    await super.reportNovel(reporterId, project, reason, details);
  }
}

Future<void> signUpAs(WidgetTester tester, String email) async {
  await tester.tap(find.text('Start writing'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField).at(0), email);
  await tester.enterText(find.byType(TextField).at(1), 'secret123');
  await tester.tap(find.text('Create account'));
  await tester.pumpAndSettle();
}

Future<void> chooseReading(WidgetTester tester) async {
  await tester.tap(find.text('To read'));
  await tester.pumpAndSettle();
}

Future<void> openNovel(WidgetTester tester, String title) async {
  await tester.tap(find.text(title).last);
  await tester.pumpAndSettle();
}

void main() {
  group('forgot password', () {
    testWidgets('asks for an email, then says the same thing for any address', (
      tester,
    ) async {
      late RecordingBackend backend;
      await boot(
        tester,
        makeBackend: (prefs) => backend = RecordingBackend(prefs),
      );
      await tester.tap(find.text('Sign in'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Forgot password?'));
      await tester.pumpAndSettle();

      // Only an email box now, and no password field
      expect(find.byType(TextField), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'someone@example.com');
      await tester.tap(find.text('Send reset link'));
      await tester.pumpAndSettle();

      expect(backend.resets, ['someone@example.com']);
      expect(
        find.textContaining('If there is an account for that address'),
        findsOneWidget,
      );
      await tester.tap(find.text('Back to sign in'));
      await tester.pumpAndSettle();
      expect(find.byType(TextField), findsNWidgets(2));
    });

    testWidgets('a refusal is shown in plain words', (tester) async {
      await boot(
        tester,
        makeBackend: (prefs) => RecordingBackend(prefs)..resetFails = true,
      );
      await tester.tap(find.text('Sign in'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Forgot password?'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'someone@example.com');
      await tester.tap(find.text('Send reset link'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('auth-error')), findsOneWidget);
      expect(find.textContaining('Too many requests'), findsOneWidget);
    });

    testWidgets('a copy with no cloud says why there is nothing to send', (
      tester,
    ) async {
      await boot(tester);
      await tester.tap(find.text('Sign in'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Forgot password?'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'someone@example.com');
      await tester.tap(find.text('Send reset link'));
      await tester.pumpAndSettle();
      expect(find.textContaining('needs the cloud database'), findsOneWidget);
    });

    testWidgets('an invalid email is caught before anything is sent', (
      tester,
    ) async {
      late RecordingBackend backend;
      await boot(
        tester,
        makeBackend: (prefs) => backend = RecordingBackend(prefs),
      );
      await tester.tap(find.text('Sign in'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Forgot password?'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'not an email');
      await tester.tap(find.text('Send reset link'));
      await tester.pumpAndSettle();
      expect(backend.resets, isEmpty);
      expect(find.byKey(const Key('auth-error')), findsOneWidget);
    });
  });

  group('deleting the account', () {
    testWidgets('needs the word DELETE, then removes the work and signs out', (
      tester,
    ) async {
      final b = await boot(tester);
      await signUpAs(tester, 'leaving@example.com');
      await tester.tap(find.text('To write'));
      await tester.pumpAndSettle();
      final me = b.state.user!;
      await b.backend.createProject(me.id, 'Soon Gone', 'a book');
      expect(await b.backend.myProjects(me.id), hasLength(1));

      await tester.tap(find.text('Me'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Delete my account…'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Delete my account…'));
      await tester.pumpAndSettle();

      final confirm = find.widgetWithText(FilledButton, 'Delete everything');
      expect(tester.widget<FilledButton>(confirm).onPressed, isNull);
      await tester.enterText(find.byType(TextField).last, 'delete');
      await tester.pump();
      expect(tester.widget<FilledButton>(confirm).onPressed, isNull);
      await tester.enterText(find.byType(TextField).last, 'DELETE');
      await tester.pump();
      expect(tester.widget<FilledButton>(confirm).onPressed, isNotNull);
      await tester.tap(confirm);
      await tester.pumpAndSettle();

      // Back at the front door, with nothing left for that address
      expect(b.state.user, isNull);
      expect(find.text('Start writing'), findsOneWidget);
      expect(await b.backend.myProjects(me.id), isEmpty);
      expect(
        b.prefs.getKeys().where((k) => k.contains(me.id)),
        isEmpty,
        reason: 'nothing kept on the phone for the deleted account',
      );
    });

    testWidgets('Keep my account changes nothing', (tester) async {
      final b = await boot(tester);
      await signUpAs(tester, 'staying@example.com');
      await tester.tap(find.text('To write'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Me'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Delete my account…'),
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.text('Delete my account…'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Keep my account'));
      await tester.pumpAndSettle();
      expect(b.state.user, isNotNull);
    });
  });

  group('reporting and blocking', () {
    const title = 'The Atlas of Quiet Places';

    testWidgets('a guest is asked to sign in before reporting', (tester) async {
      await boot(tester);
      await tester.tap(find.text('Start reading'));
      await tester.pumpAndSettle();
      await openNovel(tester, title);
      await tester.tap(find.byTooltip('More'));
      await tester.pumpAndSettle();
      // A guest has no account to keep a block on, so only the report is offered
      expect(find.text('Block this writer'), findsNothing);
      await tester.tap(find.text('Report this novel'));
      await tester.pumpAndSettle();
      expect(find.text('Sign in to report a novel.'), findsOneWidget);
    });

    testWidgets('a signed-in reader can report a novel, giving a reason', (
      tester,
    ) async {
      late RecordingBackend backend;
      await boot(
        tester,
        makeBackend: (prefs) => backend = RecordingBackend(prefs),
      );
      await signUpAs(tester, 'reader@example.com');
      await chooseReading(tester);
      await openNovel(tester, title);
      await tester.tap(find.byTooltip('More'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Report this novel'));
      await tester.pumpAndSettle();

      // It cannot be sent until a reason is chosen
      final send = find.widgetWithText(FilledButton, 'Send report');
      expect(tester.widget<FilledButton>(send).onPressed, isNull);
      await tester.tap(find.text('Spam or advertising'));
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(send).onPressed, isNotNull);
      await tester.tap(send);
      await tester.pumpAndSettle();

      expect(backend.reports, ['sample-atlas/spam/']);
      expect(find.textContaining('The report is sent'), findsOneWidget);
    });

    testWidgets(
      'blocking a writer hides their novels, and Unblock brings them back',
      (tester) async {
        final b = await boot(tester);
        await signUpAs(tester, 'reader@example.com');
        await chooseReading(tester);
        await openNovel(tester, title);
        await tester.tap(find.byTooltip('More'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Block this writer'));
        await tester.pumpAndSettle();
        await tester.tap(find.widgetWithText(FilledButton, 'Block'));
        await tester.pumpAndSettle();

        // Back in the library, and the novel is gone from it
        expect(find.text(title), findsNothing);
        expect(b.state.blockedPeople, hasLength(1));

        await tester.tap(find.text('Me'));
        await tester.pumpAndSettle();
        await tester.scrollUntilVisible(
          find.text('Unblock'),
          300,
          scrollable: find.byType(Scrollable).first,
        );
        await tester.tap(find.text('Unblock'));
        await tester.pumpAndSettle();
        expect(b.state.blockedPeople, isEmpty);

        await tester.tap(find.text('Read'));
        await tester.pumpAndSettle();
        expect(find.text(title), findsWidgets);
      },
    );

    testWidgets('a block is remembered after the app restarts', (tester) async {
      final b = await boot(tester);
      await signUpAs(tester, 'reader@example.com');
      await chooseReading(tester);
      final user = b.state.user!;
      await b.state.blockAuthor('sample-author', 'A. Writer');

      final again = AppState(backend: b.backend, prefs: b.prefs);
      await again.init();
      expect(again.user?.id, user.id);
      expect(again.isBlocked('sample-author'), isTrue);
      expect(again.blockedPeople.single.value, 'A. Writer');
    });
  });

  group('what opens first follows the account', () {
    testWidgets(
      'an answer already on the account is used, and the question is not asked again',
      (tester) async {
        late RecordingBackend backend;
        // This phone has never been asked, but the account already says "read"
        SharedPreferences.setMockInitialValues({
          'novelist_local_session': '{"id":"local-a@b.co","email":"a@b.co"}',
        });
        final prefs = await SharedPreferences.getInstance();
        backend = RecordingBackend(prefs, sessionMode: 'read');
        final state = AppState(backend: backend, prefs: prefs);
        await state.init();
        expect(state.mode, UseMode.read);
        expect(
          backend.savedModes,
          isEmpty,
          reason: 'nothing new to tell the account',
        );
      },
    );

    testWidgets(
      'an answer given on this phone is offered to the account once',
      (tester) async {
        SharedPreferences.setMockInitialValues({
          'novelist_local_session': '{"id":"local-a@b.co","email":"a@b.co"}',
          'mode_local-a@b.co': 'write',
        });
        final prefs = await SharedPreferences.getInstance();
        final backend = RecordingBackend(prefs);
        final state = AppState(backend: backend, prefs: prefs);
        await state.init();
        expect(state.mode, UseMode.write);
        expect(backend.savedModes, ['write']);
      },
    );

    testWidgets('choosing a new answer updates the phone and the account', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({
        'novelist_local_session': '{"id":"local-a@b.co","email":"a@b.co"}',
      });
      final prefs = await SharedPreferences.getInstance();
      final backend = RecordingBackend(prefs, sessionMode: 'read');
      final state = AppState(backend: backend, prefs: prefs);
      await state.init();
      await state.chooseMode(UseMode.both);
      expect(state.mode, UseMode.both);
      expect(state.user?.mode, 'both');
      expect(prefs.getString('mode_local-a@b.co'), 'both');
      expect(backend.savedModes, ['both']);
    });
  });
}
