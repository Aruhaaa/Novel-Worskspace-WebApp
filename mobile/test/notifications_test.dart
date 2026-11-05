import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:novelist_workspace/data/local_backend.dart';
import 'package:novelist_workspace/data/models.dart';
import 'package:novelist_workspace/screens/me/notifications_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support.dart';

/// A phone-only backend that pretends to be a cloud for the calls that matter here.
class NotesBackend extends LocalBackend {
  NotesBackend(SharedPreferences prefs, this.items)
    : super.withData(prefs, LocalBackend.seed());

  List<AppNotification>? items;
  final readCalls = <List<String>?>[];
  final saved = <NotificationSettings>[];
  NotificationSettings settings = const NotificationSettings();

  @override
  Future<List<AppNotification>?> notifications(String userId) async => items;

  @override
  Future<void> markNotificationsRead(String userId, {List<String>? ids}) async {
    readCalls.add(ids);
  }

  @override
  Future<NotificationSettings> notificationSettings(String userId) async => settings;

  @override
  Future<void> saveNotificationSettings(String userId, NotificationSettings s) async {
    saved.add(s);
    settings = s;
  }
}

AppNotification note(
  String id,
  String kind, {
  String actor = 'Ada',
  String snippet = '',
  int count = 1,
  bool read = false,
  String project = 'Long Tides',
  int? rating,
  String role = '',
}) => AppNotification(
  id: id,
  kind: kind,
  actorName: actor,
  snippet: snippet,
  count: count,
  createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
  readAt: read ? DateTime.now() : null,
  projectTitle: project,
  rating: rating,
  role: role,
);

Future<void> signUpAndRead(WidgetTester tester, String email) async {
  await tester.tap(find.text('Start writing'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField).at(0), email);
  await tester.enterText(find.byType(TextField).at(1), 'secret123');
  await tester.tap(find.text('Create account'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('To read'));
  await tester.pumpAndSettle();
}

/// The Notifications line is below the fold in Me, so scroll to it first
Future<void> showNotificationsLine(WidgetTester tester) async {
  await tester.scrollUntilVisible(
    find.text('Notifications'),
    300,
    scrollable: find.byType(Scrollable).first,
  );
}

Future<void> openNotifications(WidgetTester tester) async {
  await showNotificationsLine(tester);
  await tester.tap(find.text('Notifications'));
  await tester.pumpAndSettle();
}

Future<void> openMe(WidgetTester tester) async {
  await tester.tap(
    find.descendant(of: find.byType(NavigationBar), matching: find.text('Me')),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('what a notification says', () {
    test('each kind, in a line', () {
      expect(note('1', 'follow').title, 'Ada started following you');
      expect(note('2', 'comment').title, 'Ada commented on Long Tides');
      expect(note('3', 'review').title, 'Ada reviewed Long Tides');
      expect(note('4', 'message').title, 'Ada sent you a message');
      expect(note('5', 'message', count: 4).title, 'Ada sent you 4 new messages');
      expect(note('6', 'share_comment').title, 'Ada commented on a reading link for Long Tides');
      expect(note('7', 'collab', role: 'coauthor').title, 'Ada joined Long Tides as co-author');
      expect(note('8', 'follow', actor: '').title, 'Someone started following you');
      expect(note('9', 'comment', project: '').title, 'Ada commented on your novel');
    });

    test('a review shows its stars with the words', () {
      expect(note('1', 'review', snippet: 'Beautiful and calm.', rating: 4).detail, '★★★★☆ Beautiful and calm.');
      expect(note('2', 'comment', snippet: 'I loved the tide.').detail, 'I loved the tide.');
    });

    test('a row from the database is read, with the extras kept with it', () {
      final n = AppNotification.fromRow({
        'id': 'abc',
        'kind': 'review',
        'actor_name': 'Ben',
        'snippet': 'Fine',
        'count': 1,
        'created_at': '2026-11-05T10:00:00Z',
        'read_at': null,
        'meta': {'project_title': 'Salt', 'rating': 5},
      });
      expect(n.unread, isTrue);
      expect(n.title, 'Ben reviewed Salt');
      expect(n.rating, 5);
      expect(AppNotification.fromRow({'id': 'x', 'kind': 'follow', 'read_at': '2026-11-05T10:00:00Z'}).unread, isFalse);
    });
  });

  group('on the phone', () {
    testWidgets('Me counts what is new, the list says what happened, and reading one marks it', (tester) async {
      late NotesBackend backend;
      final b = await boot(
        tester,
        makeBackend: (prefs) => backend = NotesBackend(prefs, [
          note('a', 'comment', snippet: 'I loved the tide.'),
          note('b', 'follow', actor: 'Ben'),
          note('c', 'review', snippet: 'Old news', read: true, rating: 3),
        ]),
      );
      await signUpAndRead(tester, 'writer@example.com');

      expect(b.state.unreadNotifications, 2);
      // The count is on the Me tab, and on the Notifications line inside it
      await openMe(tester);
      await showNotificationsLine(tester);
      expect(find.text('2 new'), findsOneWidget);
      expect(find.text('2'), findsWidgets);

      await openNotifications(tester);
      expect(find.byType(NotificationsScreen), findsOneWidget);
      expect(find.text('Ada commented on Long Tides'), findsOneWidget);
      expect(find.textContaining('I loved the tide.'), findsOneWidget);
      expect(find.text('Ben started following you'), findsOneWidget);
      expect(find.textContaining('Old news'), findsOneWidget);

      // Tapping one marks it read, here and on the server
      await tester.tap(find.text('Ben started following you'));
      await tester.pumpAndSettle();
      expect(backend.readCalls, [
        ['b'],
      ]);
      expect(b.state.unreadNotifications, 1);

      // "Mark all read" does the rest
      await tester.tap(find.text('Mark all read'));
      await tester.pumpAndSettle();
      expect(backend.readCalls.last, isNull);
      expect(b.state.unreadNotifications, 0);
      expect(find.text('Mark all read'), findsNothing);
    });

    testWidgets('a kind that is switched off is hidden, not counted, and saved', (tester) async {
      late NotesBackend backend;
      final b = await boot(
        tester,
        makeBackend: (prefs) => backend = NotesBackend(prefs, [
          note('a', 'comment', snippet: 'Nice'),
          note('b', 'follow', actor: 'Ben'),
        ]),
      );
      await signUpAndRead(tester, 'writer@example.com');
      await openMe(tester);
      await openNotifications(tester);
      expect(b.state.unreadNotifications, 2);

      await tester.scrollUntilVisible(find.text('Comments on your novels'), 200, scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text('Comments on your novels'));
      await tester.pumpAndSettle();

      expect(backend.saved.last.muted, {'comment'});
      expect(b.state.unreadNotifications, 1);
      await tester.scrollUntilVisible(find.text('Ben started following you'), -200, scrollable: find.byType(Scrollable).first);
      expect(find.text('Ada commented on Long Tides'), findsNothing);
      expect(find.text('Ben started following you'), findsOneWidget);

      // Switching it back on
      await tester.scrollUntilVisible(find.text('Comments on your novels'), 200, scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text('Comments on your novels'));
      await tester.pumpAndSettle();
      expect(backend.saved.last.muted, isEmpty);
      expect(b.state.unreadNotifications, 2);
    });

    testWidgets('with nowhere to read them from, it says what is needed', (tester) async {
      await boot(tester, makeBackend: (prefs) => NotesBackend(prefs, null));
      await signUpAndRead(tester, 'writer@example.com');
      await openMe(tester);
      await showNotificationsLine(tester);
      expect(find.text('Follows, comments, reviews and messages'), findsOneWidget);
      await openNotifications(tester);
      expect(find.textContaining('Notifications come from the cloud database'), findsOneWidget);
    });

    testWidgets('nothing new says so, and the phone alone has no notifications at all', (tester) async {
      final b = await boot(tester);
      await signUpAndRead(tester, 'writer@example.com');
      expect(b.state.notifications, isNull);
      expect(b.state.unreadNotifications, 0);

      final empty = await boot(tester, makeBackend: (prefs) => NotesBackend(prefs, []));
      await signUpAndRead(tester, 'second@example.com');
      await openMe(tester);
      await openNotifications(tester);
      expect(find.textContaining('Nothing new yet'), findsOneWidget);
      expect(empty.state.unreadNotifications, 0);
    });

    testWidgets('signing out forgets them', (tester) async {
      final b = await boot(
        tester,
        makeBackend: (prefs) => NotesBackend(prefs, [note('a', 'follow')]),
      );
      await signUpAndRead(tester, 'writer@example.com');
      expect(b.state.unreadNotifications, 1);
      await b.state.signOut();
      expect(b.state.notifications, isNull);
      expect(b.state.unreadNotifications, 0);
    });

    testWidgets('"Help fix problems" can be switched off in Me, and stays off', (tester) async {
      final b = await boot(tester);
      await signUpAndRead(tester, 'writer@example.com');
      await openMe(tester);
      expect(b.state.errorReportsOn, isTrue);
      await tester.scrollUntilVisible(find.text('Help fix problems'), 200, scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text('Help fix problems'));
      await tester.pumpAndSettle();
      expect(b.state.errorReportsOn, isFalse);
      expect(b.prefs.getString('error_reports'), 'off');
    });
  });
}
