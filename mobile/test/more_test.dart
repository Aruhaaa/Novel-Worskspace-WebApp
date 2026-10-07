import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:novelist_workspace/data/backend.dart';
import 'package:novelist_workspace/data/local_backend.dart';
import 'package:novelist_workspace/data/models.dart';
import 'package:novelist_workspace/data/supabase_backend.dart';
import 'package:novelist_workspace/screens/link/reading_link_screen.dart';
import 'package:novelist_workspace/screens/write/notebook_screen.dart';
import 'package:novelist_workspace/state/app_state.dart';
import 'package:novelist_workspace/state/daily_words.dart';
import 'package:novelist_workspace/theme.dart';
import 'package:novelist_workspace/widgets/html_view.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'support.dart';

/// Stands in for the cloud's reading-link functions.
class ShareBackend extends LocalBackend {
  ShareBackend(SharedPreferences prefs)
    : super.withData(prefs, LocalBackend.seed());

  static const token =
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
  bool active = true;
  final comments = <Map<String, String>>[];

  @override
  Future<SharedManuscript?> sharedManuscript(String t) async {
    if (!active || t != token) return null;
    return const SharedManuscript(
      projectId: 'p',
      title: 'The Keeper\'s Daughter',
      authorName: 'Ann',
      description: '',
      chapters: [
        SharedChapter(
          id: 'c1',
          title: 'The Light Goes Out',
          html: '<p>Ines climbed the stairs.</p><hr><p>Then the lamp failed.</p>',
        ),
        SharedChapter(
          id: 'c2',
          title: 'A Letter',
          html: '<p>She found it in the tide table.</p>',
        ),
      ],
    );
  }

  @override
  Future<List<LinkComment>> myLinkComments(String t, String key) async => [
    for (final c in comments.where((c) => c['key'] == key))
      LinkComment(
        id: c['id']!,
        chapterId: c['chapter']!,
        quote: c['quote']!,
        note: c['note']!,
        createdAt: DateTime.now(),
      ),
  ];

  @override
  Future<LinkComment> addLinkComment({
    required String token,
    required String readerKey,
    required String readerName,
    required String chapterId,
    required String quote,
    required String note,
  }) async {
    if (readerName.trim().isEmpty) {
      throw BackendException('Please add your name first.');
    }
    final id = 'cm${comments.length}';
    comments.add({
      'id': id,
      'key': readerKey,
      'name': readerName,
      'chapter': chapterId,
      'quote': quote,
      'note': note,
    });
    return LinkComment(
      id: id,
      chapterId: chapterId,
      quote: quote,
      note: note,
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<bool> deleteLinkComment(String t, String key, String id) async {
    final before = comments.length;
    comments.removeWhere((c) => c['id'] == id && c['key'] == key);
    return comments.length < before;
  }
}

void main() {
  group('reading links', () {
    test('the secret is found in a whole link, a pasted fragment or the bare code', () {
      const t =
          'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
      expect(tokenFromLink('https://example.com/#/read/$t'), t);
      expect(tokenFromLink('  $t  '), t);
      expect(tokenFromLink('Here you go: https://x.app/#/read/${t.toUpperCase()} thanks'), t);
      expect(tokenFromLink('https://example.com/#/library'), isNull);
      expect(tokenFromLink('abc123'), isNull);
    });

    testWidgets('a reader opens a link with no account, reads, and comments on a chapter', (tester) async {
      final b = await boot(tester, makeBackend: ShareBackend.new);
      final backend = b.backend as ShareBackend;
      await tester.tap(find.text('I have a reading link'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField).first,
        'https://novel.app/#/read/${ShareBackend.token}',
      );
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();

      expect(find.text('The Keeper\'s Daughter'), findsWidgets);
      expect(find.textContaining('Ines climbed the stairs', findRichText: true), findsOneWidget);

      await tester.tap(find.text('Comment on chapter').first);
      await tester.pumpAndSettle();
      // no name yet: asked for it, and told why if it is skipped
      await tester.enterText(find.byType(TextField).last, 'Slow start.');
      await tester.tap(find.text('Send comment'));
      await tester.pumpAndSettle();
      expect(find.textContaining('add your name'), findsOneWidget);

      await tester.enterText(find.byType(TextField).first, 'Sam');
      await tester.tap(find.text('Send comment'));
      await tester.pumpAndSettle();
      expect(backend.comments.single['name'], 'Sam');
      expect(backend.comments.single['note'], 'Slow start.');
      expect(backend.comments.single['chapter'], 'c1');
      expect(find.text('Your comments (1)'), findsOneWidget);
    });

    testWidgets('a turned-off link says so plainly', (tester) async {
      final b = await boot(tester, makeBackend: ShareBackend.new);
      (b.backend as ShareBackend).active = false;
      await tester.tap(find.text('I have a reading link'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, ShareBackend.token);
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      expect(find.text('This link cannot be opened'), findsOneWidget);
    });

    testWidgets('something that is not a link is explained, not opened', (tester) async {
      await boot(tester);
      await tester.tap(find.text('I have a reading link'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'hello');
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      expect(find.textContaining('does not look like a reading link'), findsOneWidget);
    });

    testWidgets('on a phone with no cloud, links explain why they cannot work', (tester) async {
      await boot(tester);
      await tester.tap(find.text('I have a reading link'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byType(TextField).first,
        ShareBackend.token,
      );
      await tester.tap(find.text('Open'));
      await tester.pumpAndSettle();
      expect(find.textContaining('need the cloud database'), findsOneWidget);
    });
  });

  group('words written today', () {
    late SharedPreferences prefs;
    var day = '2026-10-08';
    DailyWords make() => DailyWords(prefs, today: () => day);

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      prefs = await SharedPreferences.getInstance();
      day = '2026-10-08';
    });

    test('only growth counts, summed over every chapter', () async {
      final d = make();
      await d.startDay('p', {'a': 100, 'b': 50});
      expect(await d.noteWords('p', 'a', 130), 30);
      expect(await d.noteWords('p', 'b', 70), 50);
      expect(d.writtenToday('p'), 50);
    });

    test('deleting text never lowers today\'s count', () async {
      final d = make();
      await d.startDay('p', {'a': 100});
      await d.noteWords('p', 'a', 200);
      expect(await d.noteWords('p', 'a', 120), isNull);
      expect(d.writtenToday('p'), 100);
    });

    test('a chapter that already existed is not written today', () async {
      final d = make();
      await d.startDay('p', {'a': 100});
      await d.markExisting('p', 'restored', 900);
      expect(await d.noteWords('p', 'restored', 900), isNull);
      expect(d.writtenToday('p'), 0);
    });

    test('a new chapter counts in full', () async {
      final d = make();
      await d.startDay('p', {'a': 100});
      expect(await d.noteWords('p', 'new', 40), 40);
    });

    test('a new day starts from how long the book is that morning', () async {
      final d = make();
      await d.startDay('p', {'a': 100});
      await d.noteWords('p', 'a', 180);
      day = '2026-10-09';
      expect(d.writtenToday('p'), 0);
      expect(await d.noteWords('p', 'a', 200), 20);
    });

    test('a day that rolls over while the app is open carries the lengths across', () async {
      final d = make();
      await d.startDay('p', {'a': 100});
      await d.noteWords('p', 'a', 180);
      day = '2026-10-09';
      expect(await d.noteWords('p', 'a', 185), 5);
    });

    test('a chapter that arrives from another device is not written today', () async {
      final d = make();
      await d.startDay('p', {'a': 100});
      await d.startDay('p', {'a': 100, 'fromWeb': 500});
      expect(await d.noteWords('p', 'fromWeb', 500), isNull);
    });
  });

  group('app state', () {
    test('what a person chose to do is remembered for them, and not for someone else', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final backend = await LocalBackend.open(prefs);
      final s = AppState(backend: backend, prefs: prefs);
      await s.init();
      await s.signUp('a@x.co', 'secret123');
      expect(s.mode, isNull);
      await s.chooseMode(UseMode.write);
      await s.signOut();
      await s.signUp('b@x.co', 'secret123');
      expect(s.mode, isNull);
      await s.signOut();
      await s.signIn('a@x.co', 'secret123');
      expect(s.mode, UseMode.write);
    });

    test('saved novels and reading places survive a restart', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final backend = await LocalBackend.open(prefs);
      final s = AppState(backend: backend, prefs: prefs);
      await s.toggleSaved('n1');
      await s.setProgress('n1', 3);
      await s.setProgress('n2', 1);
      final again = AppState(backend: backend, prefs: prefs);
      expect(again.isSaved('n1'), isTrue);
      expect(again.progressFor('n1')?.chapterIndex, 3);
      expect(again.continueReading.first, 'n2'); // read most recently
    });

    test('theme, typeface and size are remembered', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final backend = await LocalBackend.open(prefs);
      final s = AppState(backend: backend, prefs: prefs);
      await s.setTheme('midnight');
      await s.setProseFont('garamond');
      await s.setFontScale(1.3);
      final again = AppState(backend: backend, prefs: prefs);
      expect(again.theme.id, 'midnight');
      expect(again.proseFontId, 'garamond');
      expect(again.fontScale, 1.3);
    });

    test('the text size cannot be set to something unreadable', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final s = AppState(backend: await LocalBackend.open(prefs), prefs: prefs);
      await s.setFontScale(9);
      expect(s.fontScale, 1.6);
      await s.setFontScale(0.1);
      expect(s.fontScale, 0.8);
    });
  });

  group('themes', () {
    for (final t in themeOptions) {
      test('${t.name} builds, with readable text on its page', () {
        final data = buildTheme(t);
        expect(data.scaffoldBackgroundColor, t.canvas);
        // ink on paper is comfortably readable
        double lum(Color c) => c.computeLuminance();
        final hi = lum(t.ink) > lum(t.canvas) ? lum(t.ink) : lum(t.canvas);
        final lo = lum(t.ink) > lum(t.canvas) ? lum(t.canvas) : lum(t.ink);
        expect((hi + 0.05) / (lo + 0.05), greaterThan(7));
      });
    }
  });

  group('the chapter reader', () {
    testWidgets('shows every kind of thing the web editor writes', (tester) async {
      usePhone(tester);
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: HtmlView(
                html:
                    '<h1>Title</h1><p>Plain <strong>bold</strong> <em>italic</em> <mark>marked</mark> and a '
                    '<span data-type="mention" data-id="1">@Mara</span>.</p><blockquote><p>A quote</p></blockquote>'
                    '<ul><li><p>one</p><ul><li><p>nested</p></li></ul></li></ul><ol><li><p>first</p></li></ol>'
                    '<hr><p style="text-align: center">Centered</p><p>Line<br>break</p>'
                    '<table><tbody><tr><td>cell words</td></tr></tbody></table><script>alert(1)</script>',
                prose: const TextStyle(fontSize: 18),
                accent: Colors.red,
                muted: Colors.grey,
                border: Colors.grey,
              ),
            ),
          ),
        ),
      );
      for (final s in ['Title', 'A quote', 'nested', 'first', 'Centered', 'cell words']) {
        expect(find.textContaining(s, findRichText: true), findsWidgets, reason: s);
      }
      expect(find.textContaining('@Mara', findRichText: true), findsOneWidget);
      expect(find.text('∗   ∗   ∗'), findsOneWidget);
      // nothing from a script is ever shown or run
      expect(find.textContaining('alert', findRichText: true), findsNothing);
    });

    testWidgets('an empty chapter says so', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: HtmlView(html: '', prose: TextStyle(fontSize: 18), accent: Colors.red, muted: Colors.grey, border: Colors.grey),
          ),
        ),
      );
      expect(find.text('This chapter is empty.'), findsOneWidget);
    });
  });

  group('the notebook', () {
    testWidgets('an entry can be added, opened and deleted', (tester) async {
      final b = await boot(tester);
      await b.state.signUp('w@x.co', 'secret123');
      await tester.pumpAndSettle();
      final project = await b.backend.createProject(b.state.user!.id, 'Book', '');
      await pumpScreen(tester, b.state, NotebookScreen(project: project));

      await tester.tap(find.text('Add'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'Mara Voss');
      await tester.enterText(find.byType(TextField).last, 'The night radio operator.');
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect((await b.backend.entities(project.id)).single.name, 'Mara Voss');
      expect(find.text('Mara Voss'), findsOneWidget);

      await tester.tap(find.text('Mara Voss'));
      await tester.pumpAndSettle();
      expect(find.text('The night radio operator.'), findsWidgets);
      await tester.tap(find.text('Delete'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
      await tester.pumpAndSettle();
      expect(await b.backend.entities(project.id), isEmpty);
    });
  });

  group('the cloud connection', () {
    test('a missing table is told apart from a real failure', () {
      expect(SupabaseBackend.isMissingSchema(const PostgrestException(message: "Could not find the table 'public.chapter_notes' in the schema cache", code: 'PGRST205')), isTrue);
      expect(SupabaseBackend.isMissingSchema(const PostgrestException(message: 'relation "x" does not exist', code: '42P01')), isTrue);
      expect(SupabaseBackend.isMissingSchema(const PostgrestException(message: 'permission denied', code: '42501')), isFalse);
    });

    test('no signal is told apart from a refusal', () {
      expect(SupabaseBackend.isNetworkFailure(Exception('SocketException: Failed host lookup')), isTrue);
      expect(SupabaseBackend.isNetworkFailure(Exception('XMLHttpRequest error.')), isTrue);
      expect(SupabaseBackend.isNetworkFailure(const PostgrestException(message: 'permission denied', code: '42501')), isFalse);
    });
  });

  group('the data source on the phone', () {
    test('keeps everything across a restart', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final a = await LocalBackend.open(prefs);
      final p = await a.createProject('u', 'Kept', 'desc');
      final c = await a.createChapter(p.id, 'One');
      await a.updateChapter(c.id, content: '<p>words</p>');
      await a.saveChapterNote(p.id, c.id, const ChapterNote(status: ChapterStatus.done, synopsis: 's', notes: 'n', updatedAt: 5));
      final b = await LocalBackend.open(prefs);
      expect((await b.myProjects('u')).single.title, 'Kept');
      expect((await b.chapters(p.id)).single.content, '<p>words</p>');
      expect((await b.chapterNotes(p.id))[c.id]?.status, ChapterStatus.done);
    });

    test('publishing puts a novel in the library with its author, and taking it down removes it', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final a = await LocalBackend.open(prefs);
      final p = await a.createProject('u', 'Mine', '');
      expect((await a.publishedProjects()).where((x) => x.id == p.id), isEmpty);
      await a.setPublished(p.id, true, 'Ann');
      final listed = (await a.publishedProjects()).firstWhere((x) => x.id == p.id);
      expect(listed.authorName, 'Ann');
      await a.setPublished(p.id, false, 'Ann');
      expect((await a.publishedProjects()).where((x) => x.id == p.id), isEmpty);
    });

    test('a chapter that is deleted can be found in Recently deleted', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      final a = await LocalBackend.open(prefs);
      final p = await a.createProject('u', 'Mine', '');
      final c = await a.createChapter(p.id, 'Gone');
      await a.updateChapter(c.id, content: '<p>text</p>');
      final full = (await a.chapters(p.id)).single;
      await a.keepDeleted(full);
      await a.deleteChapter(c.id);
      expect(await a.chapters(p.id), isEmpty);
      final bin = await a.recentlyDeleted(p.id);
      expect(bin.single.title, 'Gone');
      expect(bin.single.content, '<p>text</p>');
    });
  });
}
