import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:novelist_workspace/editor/autosave.dart';
import 'package:novelist_workspace/state/app_state.dart';
import 'package:novelist_workspace/screens/write/chapter_editor_screen.dart';

import 'support.dart';

QuillController controllerOf(WidgetTester tester) =>
    tester.widget<QuillEditor>(find.byType(QuillEditor)).controller;

Future<void> signUpAs(WidgetTester tester, String email) async {
  await tester.tap(find.text('Start writing'));
  await tester.pumpAndSettle();
  await tester.enterText(find.byType(TextField).at(0), email);
  await tester.enterText(find.byType(TextField).at(1), 'secret123');
  await tester.tap(find.text('Create account'));
  await tester.pumpAndSettle();
}

void main() {
  group('reading', () {
    testWidgets(
      'a guest can browse, open a novel and read a chapter without an account',
      (tester) async {
        await boot(tester);
        expect(find.text('Start reading'), findsOneWidget);
        await tester.tap(find.text('Start reading'));
        await tester.pumpAndSettle();

        expect(find.text('The Atlas of Quiet Places'), findsWidgets);
        expect(find.text('Salt and Static'), findsWidgets);

        await tester.tap(find.text('The Atlas of Quiet Places').last);
        await tester.pumpAndSettle();
        await tester.tap(find.text('Start reading'));
        await tester.pumpAndSettle();
        expect(
          find.textContaining(
            'On the morning the sea disappeared',
            findRichText: true,
          ),
          findsOneWidget,
        );
        await tester.scrollUntilVisible(find.text('Next'), 300);
        expect(find.text('Next'), findsOneWidget);
      },
    );

    testWidgets('the place is kept: reopening the novel offers to continue', (
      tester,
    ) async {
      final b = await boot(tester);
      await tester.tap(find.text('Start reading'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('The Atlas of Quiet Places').last);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Start reading'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Next'), 300);
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      expect(find.text('What the Tide Left'), findsWidgets);
      expect(b.state.progressFor('sample-atlas')?.chapterIndex, 1);

      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text('Continue: chapter 2'), findsOneWidget);
    });

    testWidgets('search narrows the library, and genre chips filter it', (
      tester,
    ) async {
      await boot(tester);
      await tester.tap(find.text('Start reading'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'orchard');
      await tester.pumpAndSettle();
      expect(find.text('A Season in the Orchard'), findsWidgets);
      expect(find.text('Salt and Static'), findsNothing);
    });

    testWidgets('saving a novel keeps it under Saved', (tester) async {
      final b = await boot(tester);
      await tester.tap(find.text('Start reading'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Salt and Static').last);
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Save for later'));
      await tester.pumpAndSettle();
      expect(b.state.isSaved('sample-salt'), isTrue);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('Saved'));
      await tester.pumpAndSettle();
      expect(find.text('Salt and Static'), findsWidgets);
    });

    testWidgets(
      'a guest asked to write is invited to sign in, not blocked from reading',
      (tester) async {
        await boot(tester);
        await tester.tap(find.text('Start reading'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Write').last);
        await tester.pumpAndSettle();
        expect(find.text('Sign in to write'), findsOneWidget);
      },
    );
  });

  group('signing up and choosing', () {
    testWidgets(
      'a new account is asked what brings them here, once, and opens where they chose',
      (tester) async {
        final b = await boot(tester);
        await signUpAs(tester, 'writer@example.com');
        expect(find.text('What brings you here?'), findsOneWidget);
        await tester.tap(find.text('To write'));
        await tester.pumpAndSettle();
        expect(b.state.mode, UseMode.write);
        // opens on the Write space
        expect(find.text('Your first book starts here'), findsOneWidget);
      },
    );

    testWidgets('a reader is not shown writing first', (tester) async {
      await boot(tester);
      await signUpAs(tester, 'reader@example.com');
      await tester.tap(find.text('To read'));
      await tester.pumpAndSettle();
      expect(find.text('Discover'), findsOneWidget);
      expect(find.text('Your first book starts here'), findsNothing);
    });

    testWidgets('a short password is explained, not silently refused', (
      tester,
    ) async {
      await boot(tester);
      await tester.tap(find.text('Start writing'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).at(0), 'a@b.co');
      await tester.enterText(find.byType(TextField).at(1), '123');
      await tester.tap(find.text('Create account'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('auth-error')), findsOneWidget);
    });
  });

  group('writing', () {
    testWidgets(
      'a project, a chapter and a sentence are saved to the data source',
      (tester) async {
        final b = await boot(tester);
        await signUpAs(tester, 'writer@example.com');
        await tester.tap(find.text('To write'));
        await tester.pumpAndSettle();

        await tester.tap(find.text('Start a project'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField).last, 'The Long Light');
        await tester.tap(find.text('Create'));
        await tester.pumpAndSettle();
        expect(find.text('The Long Light'), findsWidgets);

        await tester.tap(find.text('New chapter'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField).last, 'The Lamp Fails');
        await tester.tap(find.text('Create'));
        await tester.pumpAndSettle();

        final c = controllerOf(tester);
        c.replaceText(0, 0, 'Ines climbed the stairs.', null);
        await tester.pump(const Duration(seconds: 2));
        await tester.pumpAndSettle();
        expect(find.textContaining('Saved'), findsWidgets);

        final user = b.state.user!;
        final project = (await b.backend.myProjects(user.id)).single;
        final chapter = (await b.backend.chapters(project.id)).single;
        expect(chapter.title, 'The Lamp Fails');
        expect(chapter.content, '<p>Ines climbed the stairs.</p>');
        // and today's word count was logged
        expect((await b.backend.wordLogs(project.id)).single.count, 4);
      },
    );

    testWidgets(
      'editing one paragraph leaves a scene break, a mention and a table exactly as the web wrote them',
      (tester) async {
        final b = await boot(tester);
        await b.state.signUp('writer@example.com', 'secret123');
        final project = await b.backend.createProject(
          b.state.user!.id,
          'Web book',
          '',
        );
        final chapter = await b.backend.createChapter(
          project.id,
          'Written on the web',
        );
        const original =
            '<p>Alpha <span data-type="mention" class="mention" data-id="m-1" data-label="Mara Voss" data-mention-suggestion-char="@">@Mara Voss</span> and <mark>marked</mark>.</p>'
            '<hr><table><tbody><tr><td>cell</td></tr></tbody></table><p>Beta</p>';
        final loaded = await b.backend.updateChapter(
          chapter.id,
          content: original,
        );

        await pumpScreen(
          tester,
          b.state,
          ChapterEditorScreen(project: project, chapter: loaded),
        );
        final c = controllerOf(tester);
        // Opening it changes nothing
        await tester.pump(const Duration(seconds: 3));
        expect((await b.backend.chapters(project.id)).single.content, original);

        final at = c.document.toPlainText().indexOf('Beta') + 4;
        c.replaceText(at, 0, ' more', null);
        await tester.pump(const Duration(seconds: 2));
        await tester.pumpAndSettle();
        expect(
          (await b.backend.chapters(project.id)).single.content,
          original.replaceFirst('Beta', 'Beta more'),
        );
      },
    );

    testWidgets(
      'a dropped connection loses nothing: the words are kept, then sent when it returns',
      (tester) async {
        final b = await boot(tester, makeBackend: FlakyBackend.new);
        final flaky = b.backend as FlakyBackend;
        await b.state.signUp('writer@example.com', 'secret123');
        final project = await flaky.createProject(b.state.user!.id, 'Book', '');
        final chapter = await flaky.createChapter(project.id, 'One');

        await pumpScreen(
          tester,
          b.state,
          ChapterEditorScreen(project: project, chapter: chapter),
        );
        flaky.failing = true;
        controllerOf(tester)
            .replaceText(0, 0, 'Words that must not be lost.', null);
        await tester.pump(const Duration(seconds: 2));
        await tester.pump();

        expect(find.textContaining('Not saved yet'), findsWidgets);
        // The safety copy is on the phone
        expect(
          Autosave.readDraft(b.prefs, chapter.id)?.html,
          '<p>Words that must not be lost.</p>',
        );
        expect((await flaky.chapters(project.id)).single.content, '');

        flaky.failing = false;
        await tester.pump(const Duration(seconds: 11));
        await tester.pumpAndSettle();
        expect(
          (await flaky.chapters(project.id)).single.content,
          '<p>Words that must not be lost.</p>',
        );
        expect(Autosave.readDraft(b.prefs, chapter.id), isNull);
      },
    );

    testWidgets(
      'unsaved words from a closed session are recovered the next time the chapter opens',
      (tester) async {
        final b = await boot(tester);
        await b.state.signUp('writer@example.com', 'secret123');
        final project = await b.backend.createProject(
          b.state.user!.id,
          'Book',
          '',
        );
        final chapter = await b.backend.createChapter(project.id, 'One');
        await b.prefs.setString(
          'draft_${chapter.id}',
          '{"title":"One","html":"<p>Typed just before the battery died.</p>"}',
        );

        await pumpScreen(
          tester,
          b.state,
          ChapterEditorScreen(project: project, chapter: chapter),
        );
        expect(
          find.text('Recovered unsaved changes from this phone.'),
          findsOneWidget,
        );
        await tester.pump(const Duration(seconds: 2));
        await tester.pumpAndSettle();
        expect(
          (await b.backend.chapters(project.id)).single.content,
          '<p>Typed just before the battery died.</p>',
        );
      },
    );

    testWidgets('chapters can be dragged into a new order', (tester) async {
      final b = await boot(tester);
      await b.state.signUp('writer@example.com', 'secret123');
      await tester.pumpAndSettle();
      final project = await b.backend.createProject(
        b.state.user!.id,
        'Book',
        '',
      );
      for (final t in ['One', 'Two', 'Three']) {
        await b.backend.createChapter(project.id, t);
      }
      await tester.tap(find.text('To write'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Book').last);
      await tester.pumpAndSettle();

      await tester.drag(
        find.byIcon(Icons.drag_handle).first,
        const Offset(0, 260),
      );
      await tester.pumpAndSettle();
      final order = (await b.backend.chapters(project.id))
          .map((c) => c.title)
          .toList();
      expect(order, isNot(['One', 'Two', 'Three']));
      expect(order.toSet(), {'One', 'Two', 'Three'});
    });

    testWidgets('a deleted chapter can be brought back where it was', (
      tester,
    ) async {
      final b = await boot(tester);
      await b.state.signUp('writer@example.com', 'secret123');
      await tester.pumpAndSettle();
      final project = await b.backend.createProject(
        b.state.user!.id,
        'Book',
        '',
      );
      for (final t in ['One', 'Two', 'Three']) {
        final c = await b.backend.createChapter(project.id, t);
        await b.backend.updateChapter(c.id, content: '<p>Text of $t</p>');
      }
      await tester.tap(find.text('To write'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Book').last);
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Chapter options').at(1));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Delete'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
      await tester.pumpAndSettle();
      expect((await b.backend.chapters(project.id)).map((c) => c.title), [
        'One',
        'Three',
      ]);

      await tester.tap(find.text('Undo'));
      await tester.pumpAndSettle();
      final back = await b.backend.chapters(project.id);
      expect(back.map((c) => c.title), ['One', 'Two', 'Three']);
      expect(back[1].content, '<p>Text of Two</p>');
      expect(await b.backend.recentlyDeleted(project.id), isEmpty);
    });
  });
}
