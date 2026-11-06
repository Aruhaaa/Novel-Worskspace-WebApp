import 'package:flutter_test/flutter_test.dart';
import 'package:novelist_workspace/data/models.dart';

// Publishing a novel one chapter at a time (supabase/setup_scripts/20261106_chapter_publishing.sql): the phone's reader hides drafts.
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
      Chapter.fromJson(row({'published_at': '2026-11-02T00:00:00.000Z'})).isDraft,
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
}
