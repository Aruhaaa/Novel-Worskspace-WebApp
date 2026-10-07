import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import 'backend.dart';
import 'models.dart';

/// The app running on the phone alone: everything is kept in the phone's storage, nothing leaves it.
/// A few sample novels are included so the library has something to read before a cloud is connected.
class LocalBackend implements Backend {
  /// For tests that need to add to what this can do
  LocalBackend.withData(this._prefs, this._db);

  static const _key = 'novelist_local_db_v1';
  static const _sessionKey = 'novelist_local_session';
  static const _uuid = Uuid();

  final SharedPreferences _prefs;
  final Map<String, dynamic> _db;

  static Future<LocalBackend> open(SharedPreferences prefs) async {
    final raw = prefs.getString(_key);
    Map<String, dynamic> db;
    try {
      db = raw == null ? _seed() : (jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      db = _seed();
    }
    final backend = LocalBackend.withData(prefs, db);
    if (raw == null) await backend._save();
    return backend;
  }

  Future<void> _save() => _prefs.setString(_key, jsonEncode(_db));

  List<Map<String, dynamic>> _table(String name) =>
      ((_db[name] ??= <Map<String, dynamic>>[]) as List)
          .cast<Map<String, dynamic>>();

  static String _now() => DateTime.now().toIso8601String();

  @override
  bool get isCloud => false;

  // ---- accounts. There is no server: any email and a password of six letters or more will do. ----

  @override
  Future<AppUser?> restoreSession() async {
    final raw = _prefs.getString(_sessionKey);
    if (raw == null) return null;
    final j = jsonDecode(raw) as Map<String, dynamic>;
    return AppUser(id: j['id'] as String, email: j['email'] as String);
  }

  Future<AppUser> _signedIn(String email) async {
    final user = AppUser(
      id: 'local-${email.toLowerCase().trim()}',
      email: email.trim(),
    );
    await _prefs.setString(
      _sessionKey,
      jsonEncode({'id': user.id, 'email': user.email}),
    );
    return user;
  }

  @override
  Future<AppUser> signIn(String email, String password) async {
    if (email.trim().isEmpty || password.length < 6)
      throw BackendException(
        'Enter an email and a password of at least 6 characters.',
      );
    return _signedIn(email);
  }

  @override
  Future<AppUser?> signUp(String email, String password) =>
      signIn(email, password);

  @override
  Future<void> signOut() async => _prefs.remove(_sessionKey);

  @override
  Future<Profile> profile(String userId) async {
    final found = _table('profiles').where((p) => p['id'] == userId);
    if (found.isNotEmpty) return Profile.fromJson(found.first);
    final fresh = Profile(id: userId);
    _table('profiles').add(fresh.toJson());
    await _save();
    return fresh;
  }

  @override
  Future<Profile> saveProfile(Profile profile) async {
    final rows = _table('profiles');
    rows.removeWhere((p) => p['id'] == profile.id);
    rows.add(profile.toJson());
    await _save();
    return profile;
  }

  // ---- library ----

  @override
  Future<List<Project>> publishedProjects() async {
    final list = _table('projects')
        .map(Project.fromJson)
        .where((p) => p.isPublished)
        .toList();
    list.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return list;
  }

  @override
  Future<Project> toggleLike(String projectId, String userId) async {
    final row = _table('projects').firstWhere((p) => p['id'] == projectId);
    final likes = ((row['likes'] as List?) ?? [])
        .map((e) => e.toString())
        .toList();
    likes.contains(userId) ? likes.remove(userId) : likes.add(userId);
    row['likes'] = likes;
    await _save();
    return Project.fromJson(row);
  }

  // ---- projects ----

  @override
  Future<List<Project>> myProjects(String userId) async {
    final list = _table('projects')
        .map(Project.fromJson)
        .where((p) => p.userId == userId)
        .toList();
    list.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return list;
  }

  @override
  Future<Project> createProject(
    String userId,
    String title,
    String description,
  ) async {
    final now = _now();
    final row = {
      'id': _uuid.v4(),
      'user_id': userId,
      'title': title,
      'description': description,
      'is_published': false,
      'author_name': '',
      'genre': '',
      'cover_url': '',
      'likes': <String>[],
      'views': <String>[],
      'created_at': now,
      'updated_at': now,
    };
    _table('projects').add(row);
    await _save();
    return Project.fromJson(row);
  }

  @override
  Future<Project> updateProject(
    String id, {
    String? title,
    String? description,
    String? genre,
  }) async {
    final row = _table('projects').firstWhere((p) => p['id'] == id);
    if (title != null) row['title'] = title;
    if (description != null) row['description'] = description;
    if (genre != null) row['genre'] = genre;
    row['updated_at'] = _now();
    await _save();
    return Project.fromJson(row);
  }

  @override
  Future<Project> setPublished(
    String id,
    bool published,
    String authorName,
  ) async {
    final row = _table('projects').firstWhere((p) => p['id'] == id);
    row['is_published'] = published;
    if (published) row['author_name'] = authorName;
    row['updated_at'] = _now();
    await _save();
    return Project.fromJson(row);
  }

  // ---- chapters ----

  @override
  Future<List<Chapter>> chapters(String projectId) async {
    final list = _table('chapters')
        .where((c) => c['project_id'] == projectId)
        .map(Chapter.fromJson)
        .toList();
    list.sort((a, b) => a.position.compareTo(b.position));
    return list;
  }

  @override
  Future<Chapter> createChapter(String projectId, String title) async {
    final now = _now();
    final position = _table('chapters')
        .where((c) => c['project_id'] == projectId)
        .length;
    final row = {
      'id': _uuid.v4(),
      'project_id': projectId,
      'title': title,
      'content': '',
      'position': position,
      'created_at': now,
      'updated_at': now,
    };
    _table('chapters').add(row);
    await _save();
    return Chapter.fromJson(row);
  }

  @override
  Future<Chapter> updateChapter(
    String id, {
    String? title,
    String? content,
    int? position,
  }) async {
    final row = _table('chapters').firstWhere(
      (c) => c['id'] == id,
      orElse: () => throw BackendException('That chapter no longer exists.'),
    );
    if (title != null) row['title'] = title;
    if (content != null) row['content'] = content;
    if (position != null) row['position'] = position;
    row['updated_at'] = _now();
    await _save();
    return Chapter.fromJson(row);
  }

  @override
  Future<void> deleteChapter(String id) async {
    _table('chapters').removeWhere((c) => c['id'] == id);
    (_db['notes'] as Map).remove(id);
    await _save();
  }

  @override
  Future<void> keepDeleted(Chapter chapter) async {
    _table('bin').add({
      'id': _uuid.v4(),
      'project_id': chapter.projectId,
      'title': chapter.title,
      'content': chapter.content,
      'position': chapter.position,
      'deleted_at': _now(),
    });
    await _save();
  }

  @override
  Future<List<DeletedChapter>> recentlyDeleted(String projectId) async {
    final list = _table('bin')
        .where((r) => r['project_id'] == projectId)
        .map(DeletedChapter.fromJson)
        .toList();
    list.sort((a, b) => b.deletedAt.compareTo(a.deletedAt));
    return list;
  }

  @override
  Future<void> forgetDeleted(String id) async {
    _table('bin').removeWhere((r) => r['id'] == id);
    await _save();
  }

  // ---- notebook ----

  @override
  Future<List<Entity>> entities(String projectId) async {
    final list = _table('entities')
        .where((e) => e['project_id'] == projectId)
        .map(Entity.fromJson)
        .toList();
    list.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    return list;
  }

  @override
  Future<Entity> createEntity(
    String projectId,
    String name,
    EntityType type,
    String description,
  ) async {
    final row = {
      'id': _uuid.v4(),
      'project_id': projectId,
      'name': name,
      'type': type.name,
      'description': description,
      'content': <String, String>{},
      'image_url': '',
    };
    _table('entities').add(row);
    await _save();
    return Entity.fromJson(row);
  }

  @override
  Future<Entity> updateEntity(
    String id, {
    String? name,
    EntityType? type,
    String? description,
    Map<String, String>? content,
  }) async {
    final row = _table('entities').firstWhere((e) => e['id'] == id);
    if (name != null) row['name'] = name;
    if (type != null) row['type'] = type.name;
    if (description != null) row['description'] = description;
    if (content != null) row['content'] = content;
    await _save();
    return Entity.fromJson(row);
  }

  @override
  Future<void> deleteEntity(String id) async {
    _table('entities').removeWhere((e) => e['id'] == id);
    await _save();
  }

  // ---- progress ----

  @override
  Future<List<WordLog>> wordLogs(String projectId) async {
    final list = _table('logs')
        .where((l) => l['project_id'] == projectId)
        .map(
          (l) => WordLog(
            date: l['date'] as String,
            count: (l['count'] as num).toInt(),
          ),
        )
        .toList();
    list.sort((a, b) => a.date.compareTo(b.date));
    return list;
  }

  @override
  Future<void> logWords(String projectId, String date, int count) async {
    final rows = _table('logs');
    final hit = rows.where(
      (l) => l['project_id'] == projectId && l['date'] == date,
    );
    if (hit.isNotEmpty) {
      hit.first['count'] = count;
    } else {
      rows.add({'project_id': projectId, 'date': date, 'count': count});
    }
    await _save();
  }

  // ---- chapter notes ----

  @override
  Future<Map<String, ChapterNote>> chapterNotes(String projectId) async {
    final chapterIds = _table('chapters')
        .where((c) => c['project_id'] == projectId)
        .map((c) => c['id'])
        .toSet();
    final notes = (_db['notes'] as Map).cast<String, dynamic>();
    return {
      for (final e in notes.entries)
        if (chapterIds.contains(e.key))
          e.key: ChapterNote.fromJson(e.value as Map<String, dynamic>),
    };
  }

  @override
  Future<void> saveChapterNote(
    String projectId,
    String chapterId,
    ChapterNote note,
  ) async {
    (_db['notes'] as Map)[chapterId] = note.toJson();
    await _save();
  }

  // ---- reading links need the cloud ----

  @override
  Future<SharedManuscript?> sharedManuscript(String token) async =>
      throw BackendException(
        'Reading links need the cloud database. This copy of the app is running on this phone only.',
      );

  @override
  Future<List<LinkComment>> myLinkComments(
    String token,
    String readerKey,
  ) async => const [];

  @override
  Future<LinkComment> addLinkComment({
    required String token,
    required String readerKey,
    required String readerName,
    required String chapterId,
    required String quote,
    required String note,
  }) async => throw BackendException('Reading links need the cloud database.');

  @override
  Future<bool> deleteLinkComment(
    String token,
    String readerKey,
    String commentId,
  ) async => false;

  // ---- sample novels ----

  static Map<String, dynamic> seed() => _seed();

  static Map<String, dynamic> _seed() {
    final now = DateTime.now();
    String iso(int daysAgo) =>
        now.subtract(Duration(days: daysAgo)).toIso8601String();
    final projects = <Map<String, dynamic>>[];
    final chapters = <Map<String, dynamic>>[];

    void novel(
      String id,
      String title,
      String author,
      String genre,
      String blurb,
      int daysAgo,
      List<(String, String)> parts,
    ) {
      projects.add({
        'id': id,
        'user_id': 'sample-author',
        'title': title,
        'description': blurb,
        'is_published': true,
        'author_name': author,
        'genre': genre,
        'cover_url': '',
        'likes': <String>[],
        'views': <String>[],
        'created_at': iso(daysAgo + 10),
        'updated_at': iso(daysAgo),
      });
      for (var i = 0; i < parts.length; i++) {
        chapters.add({
          'id': '$id-c$i',
          'project_id': id,
          'title': parts[i].$1,
          'content': parts[i].$2,
          'position': i,
          'created_at': iso(daysAgo + 10),
          'updated_at': iso(daysAgo),
        });
      }
    }

    novel(
      'sample-atlas',
      'The Atlas of Quiet Places',
      'Mira Okafor',
      'Fantasy',
      'A cartographer follows a sea that has gone quiet.',
      2,
      [
        (
          'The Sea Goes Quiet',
          '<p>On the morning the sea disappeared, Ada was making tea. She noticed the silence before she noticed the view: no gulls, no slap of water against the harbour wall, only a long grey plain where the bay had been.</p><p>Her grandmother\'s atlas lay open on the table. She had drawn this coast a hundred times from memory, and she did not need to look to know that none of her maps had a place for this.</p>',
        ),
        (
          'What the Tide Left',
          '<p>By noon the whole town was out on the sand, walking carefully, as if the ground might remember it was water.</p><p>Ada found the first door at the bottom of the harbour. It was small, painted blue, and it was open.</p><hr><p>She did not tell anyone. She took her pencil, and she began to draw.</p>',
        ),
      ],
    );
    novel(
      'sample-salt',
      'Salt and Static',
      'J. Reyes',
      'Mystery',
      'Radio operators on a drowned coast hear a broadcast that should not exist.',
      5,
      [
        (
          'Night Shift',
          '<p>Mara had worked the night radio for six winters, and in six winters nothing had ever answered back.</p><p>Then, at ten past three, a voice said her name.</p>',
        ),
        (
          'The Second Signal',
          '<p>The log said nothing had been transmitted from the old tower since 1971. Mara read the line twice and then went to find the key.</p>',
        ),
      ],
    );
    novel(
      'sample-garden',
      'A Season in the Orchard',
      'Lena Hartmann',
      'Contemporary',
      'Three generations, one harvest, and the argument nobody will have out loud.',
      9,
      [
        (
          'First Frost',
          '<p>The apples came in early that year, and so did the quarrel.</p><p>Her mother said nothing at breakfast, which was how Jo knew it was serious.</p>',
        ),
      ],
    );

    return {
      'projects': projects,
      'chapters': chapters,
      'entities': <Map<String, dynamic>>[],
      'logs': <Map<String, dynamic>>[],
      'bin': <Map<String, dynamic>>[],
      'profiles': <Map<String, dynamic>>[],
      'notes': <String, dynamic>{},
    };
  }
}
