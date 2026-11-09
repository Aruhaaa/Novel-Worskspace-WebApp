import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:novelist_workspace/data/backend.dart';
import 'package:novelist_workspace/data/local_backend.dart';
import 'package:novelist_workspace/data/models.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support.dart';

// Publishing a novel one chapter at a time (supabase/setup_scripts/20261106_chapter_publishing.sql): the phone's reader hides drafts,
// and the writer can publish or take down a chapter from the chapter list.

/// Behaves like a database that has had the chapter publishing setup run: every chapter reports whether it is published, only the
/// owner may change that, and the book is listed while at least one of its chapters is published (the database's own trigger).
class PublishingBackend extends LocalBackend {
  PublishingBackend(SharedPreferences prefs)
    : super.withData(prefs, LocalBackend.seed());
  final Map<String, bool> published = {};
  String? refuse; // a message to fail with, like a database that says no

  @override
  Future<List<Chapter>> chapters(String projectId) async {
    final list = await super.chapters(projectId);
    return [
      for (final c in list)
        Chapter.fromJson({
          ...c.toJson(),
          'published_at': (published[c.id] ?? false)
              ? '2026-11-02T00:00:00.000Z'
              : null,
        }),
    ];
  }

  @override
  Future<Chapter> setChapterPublished(String id, bool value) async {
    if (refuse != null) throw BackendException(refuse!);
    final chapter = await super.setChapterPublished(id, value);
    published[id] = value;
    final siblings = await super.chapters(chapter.projectId);
    await setPublished(
      chapter.projectId,
      siblings.any((c) => published[c.id] ?? false),
      'Writer',
    );
    return (await chapters(chapter.projectId))
        .firstWhere((c) => c.id == chapter.id);
  }
}

void main() {
  Map<String, dynamic> row(Map<String, dynamic> extra) => {
    'id': 'c1',
    'project_id': 'p1',
    'title': 'One',
    'content': '<p>Words.</p>',
    'position': 0,
    'created_at': '2026-11-01T00:00:00.000Z',
    'updated_at': '2026-11-01T00:00:00.000Z',
    ...extra,
  };

  test('a chapter with a null published_at is a draft', () {
    expect(Chapter.fromJson(row({'published_at': null})).isDraft, isTrue);
  });

  test('a chapter with a published_at is not a draft', () {
    expect(
      Chapter.fromJson(row({'published_at': '2026-11-02T00:00:00.000Z'}))
          .isDraft,
      isFalse,
    );
  });

  test('a chapter from a database without the column is not a draft', () {
    expect(Chapter.fromJson(row({})).isDraft, isFalse);
  });

  test('editing a chapter keeps whether it is a draft', () {
    final draft = Chapter.fromJson(row({'published_at': null}));
    expect(draft.copyWith(content: '<p>More.</p>').isDraft, isTrue);
    expect(Chapter.fromJson(row({})).copyWith(title: 'Two').isDraft, isFalse);
  });

  test('only a chapter that came with a published_at can be published', () {
    expect(
      Chapter.fromJson(row({'published_at': null})).hasPublishState,
      isTrue,
    );
    expect(
      Chapter.fromJson(row({'published_at': '2026-11-02T00:00:00.000Z'}))
          .hasPublishState,
      isTrue,
    );
    expect(Chapter.fromJson(row({})).hasPublishState, isFalse);
    expect(
      Chapter.fromJson(row({'published_at': null}))
          .copyWith(title: 'Two')
          .hasPublishState,
      isTrue,
    );
  });

  group('publishing a chapter from the chapter list', () {
    Future<(Booted, Project, Chapter)> openBook(
      WidgetTester tester, {
      Backend Function(SharedPreferences)? makeBackend,
    }) async {
      final b = await boot(tester, makeBackend: makeBackend);
      await b.state.signUp('writer@example.com', 'secret123');
      await tester.pumpAndSettle();
      final project = await b.backend.createProject(
        b.state.user!.id,
        'Book',
        '',
      );
      final c = await b.backend.createChapter(project.id, 'One');
      await b.backend.updateChapter(c.id, content: '<p>Text of One</p>');
      await tester.tap(find.text('To write'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Book').last);
      await tester.pumpAndSettle();
      return (b, project, c);
    }

    testWidgets(
      'an unpublished chapter can be published, and the book is listed',
      (tester) async {
        final (b, project, c) = await openBook(
          tester,
          makeBackend: PublishingBackend.new,
        );
        expect(find.text('Not published'), findsOneWidget);

        await tester.tap(find.byTooltip('Chapter options'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Publish this chapter'));
        await tester.pumpAndSettle();
        expect(find.text('Publish “One”?'), findsOneWidget);
        expect(find.textContaining('joins the library'), findsOneWidget);
        await tester.tap(find.widgetWithText(FilledButton, 'Publish'));
        await tester.pumpAndSettle();

        expect((b.backend as PublishingBackend).published[c.id], isTrue);
        expect(find.text('Published'), findsOneWidget);
        expect(find.text('Not published'), findsNothing);
        final mine = await b.backend.myProjects(b.state.user!.id);
        expect(mine.singleWhere((p) => p.id == project.id).isPublished, isTrue);
      },
    );

    testWidgets(
      'a published chapter can be taken down again, and Undo brings it back',
      (tester) async {
        final (b, _, c) = await openBook(
          tester,
          makeBackend: (prefs) => PublishingBackend(prefs),
        );
        final backend = b.backend as PublishingBackend;
        backend.published[c.id] = true;
        // Open the book again so it is read with the chapter published
        await tester.pageBack();
        await tester.pumpAndSettle();
        await tester.tap(find.text('Book').last);
        await tester.pumpAndSettle();
        expect(find.text('Published'), findsOneWidget);

        await tester.tap(find.byTooltip('Chapter options'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Unpublish this chapter'));
        await tester.pumpAndSettle();
        expect(
          find.textContaining('book leaves the public library'),
          findsOneWidget,
        );
        await tester.tap(find.widgetWithText(FilledButton, 'Unpublish'));
        await tester.pumpAndSettle();
        expect(backend.published[c.id], isFalse);
        expect(find.text('Not published'), findsOneWidget);

        await tester.tap(find.text('Undo'));
        await tester.pumpAndSettle();
        expect(backend.published[c.id], isTrue);
        expect(find.text('Published'), findsOneWidget);
      },
    );

    testWidgets(
      'when the database says no, the chapter stays as it was and the reason shows',
      (tester) async {
        final (b, _, c) = await openBook(
          tester,
          makeBackend: PublishingBackend.new,
        );
        (b.backend as PublishingBackend).refuse =
            'Only the owner can publish or unpublish a chapter';

        await tester.tap(find.byTooltip('Chapter options'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Publish this chapter'));
        await tester.pumpAndSettle();
        await tester.tap(find.widgetWithText(FilledButton, 'Publish'));
        await tester.pumpAndSettle();

        expect(
          find.text('Only the owner can publish or unpublish a chapter'),
          findsOneWidget,
        );
        expect((b.backend as PublishingBackend).published[c.id], isNot(true));
        expect(find.text('Not published'), findsOneWidget);
      },
    );

    testWidgets(
      'on the phone alone there is no chapter by chapter publishing to offer',
      (tester) async {
        await openBook(tester);
        expect(find.text('Not published'), findsNothing);
        expect(find.text('Published'), findsNothing);

        await tester.tap(find.byTooltip('Chapter options'));
        await tester.pumpAndSettle();
        expect(find.text('Open'), findsOneWidget);
        expect(find.text('Publish this chapter'), findsNothing);
        expect(find.text('Unpublish this chapter'), findsNothing);
        expect(find.text('Delete'), findsOneWidget);
      },
    );
  });
}
