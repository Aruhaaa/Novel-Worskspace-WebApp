import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config.dart';
import 'backend.dart';
import 'models.dart';

/// The cloud database: the same one the web app uses, so a novel is the same on both.
class SupabaseBackend implements Backend {
  SupabaseBackend(this._prefs) : _c = Supabase.instance.client;

  final SharedPreferences _prefs;
  final SupabaseClient _c;

  // Set once the optional tables (see supabase/migrations) are known not to exist; chapter notes then stay on the phone
  bool _notesMissing = false;

  @override
  bool get isCloud => true;

  // ---------------------------------------------------------------------------------------------
  // Errors, in words a writer can read
  // ---------------------------------------------------------------------------------------------

  static bool isMissingSchema(Object e) {
    if (e is PostgrestException) {
      if (const ['PGRST205', 'PGRST202', '42P01', '42883'].contains(e.code))
        return true;
      return RegExp(
        r'schema cache|does not exist|could not find the (table|function)',
        caseSensitive: false,
      ).hasMatch(e.message);
    }
    return false;
  }

  static bool isNetworkFailure(Object e) {
    if (e is TimeoutException || e is http.ClientException) return true;
    if (e is AuthRetryableFetchException) return true;
    final m = e.toString();
    return RegExp(
      r'SocketException|Failed host lookup|XMLHttpRequest error|Failed to fetch|Connection (refused|closed|reset)|NetworkException|Network is unreachable',
      caseSensitive: false,
    ).hasMatch(m);
  }

  Future<T> _run<T>(Future<T> Function() f) async {
    try {
      return await f();
    } on AuthException catch (e) {
      throw BackendException(e.message);
    } on PostgrestException catch (e) {
      throw BackendException(
        e.message.isEmpty ? 'The server could not do that.' : e.message,
      );
    } catch (e) {
      if (e is BackendException) rethrow;
      if (isNetworkFailure(e))
        throw BackendException('You seem to be offline.', offline: true);
      throw BackendException('Something went wrong. Please try again.');
    }
  }

  // ---------------------------------------------------------------------------------------------
  // A copy of what was last loaded, so a book you have opened still opens with no signal
  // ---------------------------------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> _cached(
    String key,
    Future<List<Map<String, dynamic>>> Function() load,
  ) async {
    try {
      final rows = await load();
      await _prefs.setString('cache_$key', jsonEncode(rows));
      return rows;
    } catch (e) {
      if (isNetworkFailure(e)) {
        final raw = _prefs.getString('cache_$key');
        if (raw != null)
          return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
      }
      rethrow;
    }
  }

  Future<void> clearCache() async {
    for (final k
        in _prefs
            .getKeys()
            .where(
              (k) => k.startsWith('cache_') || k.startsWith('notes_local_'),
            )
            .toList()) {
      await _prefs.remove(k);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Accounts
  // ---------------------------------------------------------------------------------------------

  @override
  Future<AppUser?> restoreSession() async {
    // The session is kept on the phone, so this works with no signal
    final u = _c.auth.currentUser;
    if (u == null || u.email == null) return null;
    return _userOf(u.id, u.email!, u.userMetadata);
  }

  static AppUser _userOf(String id, String email, Map<String, dynamic>? meta) {
    final m = meta?['use_mode'];
    return AppUser(
      id: id,
      email: email,
      mode: m == 'read' || m == 'write' || m == 'both' ? m as String : null,
    );
  }

  @override
  Future<AppUser> signIn(String email, String password) => _run(() async {
    final res = await _c.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
    final u = res.user;
    if (u == null || u.email == null)
      throw BackendException('Could not sign in.');
    return _userOf(u.id, u.email!, u.userMetadata);
  });

  @override
  Future<AppUser?> signUp(String email, String password) => _run(() async {
    final res = await _c.auth.signUp(email: email.trim(), password: password);
    if (res.session == null) return null; // the email has to be confirmed first
    final u = res.user;
    if (u == null || u.email == null) return null;
    return _userOf(u.id, u.email!, u.userMetadata);
  });

  @override
  Future<void> signOut() async {
    // Do not leave a signed-out writer's manuscript behind on a shared phone
    await clearCache();
    try {
      await _c.auth.signOut();
    } catch (_) {
      // signed out on this phone either way
    }
  }

  @override
  Future<void> requestPasswordReset(String email) => _run(() async {
    try {
      await _c.auth.resetPasswordForEmail(
        email.trim(),
        redirectTo: Config.publicAppUrl,
      );
    } on AuthException catch (e) {
      // Too many requests is worth saying; anything else is kept vague so this cannot show who has an account
      if (e.statusCode == '429' ||
          RegExp(r'rate|seconds', caseSensitive: false).hasMatch(e.message)) {
        throw BackendException(
          'Too many requests. Please wait a minute and try again.',
        );
      }
    }
  });

  /// Signs in again to prove it is the owner at the keyboard, without changing who is signed in
  Future<void> _confirmPassword(String email, String password) async {
    try {
      await _c.auth.signInWithPassword(email: email.trim(), password: password);
    } on AuthException {
      throw BackendException('That password is not right.');
    }
  }

  @override
  Future<void> changePassword(
    String email,
    String currentPassword,
    String newPassword,
  ) => _run(() async {
    await _confirmPassword(email, currentPassword);
    await _c.auth.updateUser(UserAttributes(password: newPassword));
  });

  @override
  Future<void> saveUseMode(String mode) async {
    try {
      await _c.auth.updateUser(UserAttributes(data: {'use_mode': mode}));
    } catch (_) {
      // Still kept on this phone; it is offered to the account again next time
    }
  }

  @override
  Future<void> deleteAccount(String userId, String email, String password) =>
      _run(() async {
        await _confirmPassword(email, password);
        try {
          await _c.rpc('delete_my_account');
        } on PostgrestException catch (e) {
          if (isMissingSchema(e)) {
            throw BackendException(
              'Deleting accounts is not switched on for this site yet. Please tell the site owner.',
            );
          }
          rethrow;
        }
        await clearCache();
        try {
          // The account is gone on the server, so only this phone's copy of the sign-in is left to remove
          await _c.auth.signOut(scope: SignOutScope.local);
        } catch (_) {
          // signed out on this phone either way
        }
      });

  // ---- reporting and blocking. The tables and functions come from supabase/setup_scripts/20261008_account_safety.sql.

  @override
  Future<void> reportNovel(
    String reporterId,
    Project project,
    String reason,
    String details,
  ) => _run(() async {
    try {
      await _c.rpc(
        'submit_report',
        params: {
          'p_type': 'novel',
          'p_target_id': project.id,
          'p_reason': reason,
          'p_details': details.trim(),
        },
      );
    } on PostgrestException catch (e) {
      if (isMissingSchema(e)) {
        throw BackendException(
          'Reporting is not switched on for this site yet. Please tell the site owner.',
        );
      }
      rethrow;
    }
  });

  List<String> _blocksOnPhone(String userId) =>
      _prefs.getStringList('blocks_$userId') ?? <String>[];

  @override
  Future<Set<String>> blockedUsers(String userId) async {
    try {
      final rows = await _c
          .from('user_blocks')
          .select('blocked_id')
          .eq('blocker_id', userId);
      final ids = rows.map((r) => r['blocked_id'].toString()).toSet();
      await _prefs.setStringList('blocks_$userId', ids.toList());
      return ids;
    } catch (_) {
      // Not set up yet, or no signal: this phone's copy is the answer
      return _blocksOnPhone(userId).toSet();
    }
  }

  @override
  Future<bool> blockUser(String userId, String blockedId) async {
    final now = _blocksOnPhone(userId);
    if (!now.contains(blockedId)) {
      await _prefs.setStringList('blocks_$userId', [...now, blockedId]);
    }
    try {
      await _c
          .from('user_blocks')
          .upsert(
            {'blocker_id': userId, 'blocked_id': blockedId},
            onConflict: 'blocker_id,blocked_id',
            ignoreDuplicates: true,
          );
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> unblockUser(String userId, String blockedId) async {
    await _prefs.setStringList(
      'blocks_$userId',
      _blocksOnPhone(userId).where((id) => id != blockedId).toList(),
    );
    try {
      await _c
          .from('user_blocks')
          .delete()
          .eq('blocker_id', userId)
          .eq('blocked_id', blockedId);
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<Profile> profile(String userId) => _run(() async {
    final rows = await _cached('profile_$userId', () async {
      final row = await _c
          .from('profiles')
          .select()
          .eq('id', userId)
          .maybeSingle();
      return row == null ? <Map<String, dynamic>>[] : [row];
    });
    if (rows.isNotEmpty) return Profile.fromJson(rows.first);
    // Only a confirmed "no profile" creates one, never a failure to reach the server
    final created = Profile(id: userId);
    await _c.from('profiles').upsert(created.toJson());
    return created;
  });

  @override
  Future<Profile> saveProfile(Profile profile) => _run(() async {
    await _c.from('profiles').upsert(profile.toJson());
    return profile;
  });

  // ---------------------------------------------------------------------------------------------
  // Library
  // ---------------------------------------------------------------------------------------------

  @override
  Future<List<Project>> publishedProjects() => _run(() async {
    final rows = await _cached(
      'published',
      () async =>
          (await _c
                  .from('projects')
                  .select()
                  .eq('is_published', true)
                  .order('updated_at', ascending: false))
              .cast<Map<String, dynamic>>(),
    );
    return rows.map(Project.fromJson).toList();
  });

  @override
  Future<Project> toggleLike(String projectId, String userId) => _run(() async {
    final row = await _c
        .from('projects')
        .select('likes')
        .eq('id', projectId)
        .single();
    final likes = ((row['likes'] as List?) ?? [])
        .map((e) => e.toString())
        .toList();
    likes.contains(userId) ? likes.remove(userId) : likes.add(userId);
    final updated = await _c
        .from('projects')
        .update({'likes': likes})
        .eq('id', projectId)
        .select()
        .single();
    return Project.fromJson(updated);
  });

  // ---------------------------------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------------------------------

  @override
  Future<List<Project>> myProjects(String userId) => _run(() async {
    final rows = await _cached(
      'projects_$userId',
      () async =>
          (await _c
                  .from('projects')
                  .select()
                  .eq('user_id', userId)
                  .order('updated_at', ascending: false))
              .cast<Map<String, dynamic>>(),
    );
    return rows.map(Project.fromJson).toList();
  });

  @override
  Future<Project> createProject(
    String userId,
    String title,
    String description,
  ) => _run(() async {
    final row = await _c
        .from('projects')
        .insert({'user_id': userId, 'title': title, 'description': description})
        .select()
        .single();
    return Project.fromJson(row);
  });

  @override
  Future<Project> updateProject(
    String id, {
    String? title,
    String? description,
    String? genre,
  }) => _run(() async {
    final fields = <String, dynamic>{
      'updated_at': DateTime.now().toIso8601String(),
    };
    if (title != null) fields['title'] = title;
    if (description != null) fields['description'] = description;
    if (genre != null) fields['genre'] = genre;
    return Project.fromJson(
      await _c.from('projects').update(fields).eq('id', id).select().single(),
    );
  });

  @override
  Future<Project> setPublished(String id, bool published, String authorName) =>
      _run(() async {
        final fields = <String, dynamic>{
          'is_published': published,
          'updated_at': DateTime.now().toIso8601String(),
        };
        if (published) fields['author_name'] = authorName;
        return Project.fromJson(
          await _c
              .from('projects')
              .update(fields)
              .eq('id', id)
              .select()
              .single(),
        );
      });

  // ---------------------------------------------------------------------------------------------
  // Chapters
  // ---------------------------------------------------------------------------------------------

  @override
  Future<List<Chapter>> chapters(String projectId) => _run(() async {
    final rows = await _cached(
      'chapters_$projectId',
      () async =>
          (await _c
                  .from('chapters')
                  .select()
                  .eq('project_id', projectId)
                  .order('position', ascending: true))
              .cast<Map<String, dynamic>>(),
    );
    return rows.map(Chapter.fromJson).toList();
  });

  @override
  Future<Chapter> createChapter(String projectId, String title) =>
      _run(() async {
        final existing = await _c
            .from('chapters')
            .select('id')
            .eq('project_id', projectId);
        final row = await _c
            .from('chapters')
            .insert({
              'project_id': projectId,
              'title': title,
              'content': '',
              'position': existing.length,
            })
            .select()
            .single();
        return Chapter.fromJson(row);
      });

  @override
  Future<Chapter> updateChapter(
    String id, {
    String? title,
    String? content,
    int? position,
  }) => _run(() async {
    final fields = <String, dynamic>{
      'updated_at': DateTime.now().toIso8601String(),
    };
    if (title != null) fields['title'] = title;
    if (content != null) fields['content'] = content;
    if (position != null) fields['position'] = position;
    return Chapter.fromJson(
      await _c.from('chapters').update(fields).eq('id', id).select().single(),
    );
  });

  @override
  Future<void> deleteChapter(String id) => _run(() async {
    await _c.from('chapters').delete().eq('id', id);
  });

  // A copy of a deleted chapter is kept in the cloud when the deleted_chapters table exists (see supabase/migrations),
  // otherwise on this phone.
  bool _binMissing = false;

  List<Map<String, dynamic>> _localBin(String projectId) {
    final raw = _prefs.getString('bin_local_$projectId');
    if (raw == null) return [];
    try {
      return (jsonDecode(raw) as List).cast<Map<String, dynamic>>();
    } catch (_) {
      return [];
    }
  }

  Future<void> _writeLocalBin(
    String projectId,
    List<Map<String, dynamic>> rows,
  ) => _prefs.setString('bin_local_$projectId', jsonEncode(rows));

  @override
  Future<void> keepDeleted(Chapter chapter) async {
    final row = {
      'project_id': chapter.projectId,
      'title': chapter.title,
      'content': chapter.content,
      'position': chapter.position,
      'deleted_at': DateTime.now().toIso8601String(),
    };
    if (!_binMissing) {
      try {
        await _c.from('deleted_chapters').insert(row);
        return;
      } catch (e) {
        if (isMissingSchema(e)) _binMissing = true;
      }
    }
    final rows = _localBin(chapter.projectId)
      ..add({...row, 'id': 'local-${DateTime.now().microsecondsSinceEpoch}'});
    await _writeLocalBin(chapter.projectId, rows);
  }

  @override
  Future<List<DeletedChapter>> recentlyDeleted(String projectId) async {
    final list = _localBin(projectId).map(DeletedChapter.fromJson).toList();
    if (!_binMissing) {
      try {
        final rows =
            (await _c
                    .from('deleted_chapters')
                    .select()
                    .eq('project_id', projectId)
                    .order('deleted_at', ascending: false))
                .cast<Map<String, dynamic>>();
        list.addAll(rows.map(DeletedChapter.fromJson));
      } catch (e) {
        if (isMissingSchema(e)) _binMissing = true;
      }
    }
    list.sort((a, b) => b.deletedAt.compareTo(a.deletedAt));
    return list;
  }

  @override
  Future<void> forgetDeleted(String id) async {
    for (final key
        in _prefs.getKeys().where((k) => k.startsWith('bin_local_')).toList()) {
      final projectId = key.substring('bin_local_'.length);
      final rows = _localBin(projectId);
      if (rows.any((r) => r['id'] == id)) {
        await _writeLocalBin(
          projectId,
          rows.where((r) => r['id'] != id).toList(),
        );
        return;
      }
    }
    if (!_binMissing) {
      try {
        await _c.from('deleted_chapters').delete().eq('id', id);
      } catch (e) {
        if (isMissingSchema(e)) _binMissing = true;
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Notebook
  // ---------------------------------------------------------------------------------------------

  @override
  Future<List<Entity>> entities(String projectId) => _run(() async {
    final rows = await _cached(
      'entities_$projectId',
      () async =>
          (await _c
                  .from('entities')
                  .select()
                  .eq('project_id', projectId)
                  .order('name', ascending: true))
              .cast<Map<String, dynamic>>(),
    );
    return rows.map(Entity.fromJson).toList();
  });

  @override
  Future<Entity> createEntity(
    String projectId,
    String name,
    EntityType type,
    String description,
  ) => _run(() async {
    final row = await _c
        .from('entities')
        .insert({
          'project_id': projectId,
          'name': name,
          'type': type.name,
          'description': description,
          'content': <String, String>{},
        })
        .select()
        .single();
    return Entity.fromJson(row);
  });

  @override
  Future<Entity> updateEntity(
    String id, {
    String? name,
    EntityType? type,
    String? description,
    Map<String, String>? content,
  }) => _run(() async {
    final fields = <String, dynamic>{
      'updated_at': DateTime.now().toIso8601String(),
    };
    if (name != null) fields['name'] = name;
    if (type != null) fields['type'] = type.name;
    if (description != null) fields['description'] = description;
    if (content != null) fields['content'] = content;
    return Entity.fromJson(
      await _c.from('entities').update(fields).eq('id', id).select().single(),
    );
  });

  @override
  Future<void> deleteEntity(String id) => _run(() async {
    await _c.from('entities').delete().eq('id', id);
  });

  // ---------------------------------------------------------------------------------------------
  // Progress
  // ---------------------------------------------------------------------------------------------

  @override
  Future<List<WordLog>> wordLogs(String projectId) => _run(() async {
    final rows = await _cached(
      'logs_$projectId',
      () async =>
          (await _c
                  .from('word_count_logs')
                  .select()
                  .eq('project_id', projectId)
                  .order('date', ascending: true))
              .cast<Map<String, dynamic>>(),
    );
    return rows
        .map(
          (r) => WordLog(
            date: r['date'].toString(),
            count: (r['word_count'] as num).toInt(),
          ),
        )
        .toList();
  });

  @override
  Future<void> logWords(String projectId, String date, int count) =>
      _run(() async {
        final existing = await _c
            .from('word_count_logs')
            .select('id')
            .eq('project_id', projectId)
            .eq('date', date)
            .maybeSingle();
        final now = DateTime.now().toIso8601String();
        if (existing != null) {
          await _c
              .from('word_count_logs')
              .update({'word_count': count, 'updated_at': now})
              .eq('id', existing['id']);
        } else {
          await _c.from('word_count_logs').insert({
            'project_id': projectId,
            'date': date,
            'word_count': count,
          });
        }
      });

  // ---------------------------------------------------------------------------------------------
  // Chapter notes. Kept on the phone first; sent to the cloud when it has the table. Newer edit wins.
  // ---------------------------------------------------------------------------------------------

  Map<String, ChapterNote> _localNotes(String projectId) {
    final raw = _prefs.getString('notes_local_$projectId');
    if (raw == null) return {};
    try {
      return (jsonDecode(raw) as Map<String, dynamic>).map(
        (k, v) => MapEntry(k, ChapterNote.fromJson(v as Map<String, dynamic>)),
      );
    } catch (_) {
      return {};
    }
  }

  Future<void> _writeLocalNotes(
    String projectId,
    Map<String, ChapterNote> notes,
  ) => _prefs.setString(
    'notes_local_$projectId',
    jsonEncode(notes.map((k, v) => MapEntry(k, v.toJson()))),
  );

  Map<String, dynamic> _noteRow(
    String projectId,
    String chapterId,
    ChapterNote n,
  ) => {
    'chapter_id': chapterId,
    'project_id': projectId,
    'status': n.status.name,
    'synopsis': n.synopsis,
    'notes': n.notes,
    'updated_at': DateTime.fromMillisecondsSinceEpoch(
      n.updatedAt == 0 ? DateTime.now().millisecondsSinceEpoch : n.updatedAt,
      isUtc: true,
    ).toIso8601String(),
  };

  @override
  Future<Map<String, ChapterNote>> chapterNotes(String projectId) async {
    final local = _localNotes(projectId);
    if (_notesMissing) return local;
    try {
      final rows =
          (await _c
                  .from('chapter_notes')
                  .select('chapter_id, status, synopsis, notes, updated_at')
                  .eq('project_id', projectId))
              .cast<Map<String, dynamic>>();
      final merged = Map<String, ChapterNote>.of(local);
      final remote = {for (final r in rows) r['chapter_id'].toString(): r};
      final toSend = <Map<String, dynamic>>[];
      for (final id in {...local.keys, ...remote.keys}) {
        final mine = local[id];
        final theirs = remote[id];
        final theirTime = theirs == null
            ? 0
            : (DateTime.tryParse(theirs['updated_at'].toString())
                      ?.millisecondsSinceEpoch ??
                  0);
        final mineTime = mine?.updatedAt ?? 0;
        if (theirs != null && (mine == null || mineTime <= theirTime)) {
          merged[id] = ChapterNote.fromJson({
            ...theirs,
            'updatedAt': theirTime,
          });
        } else if (mine != null &&
            (theirs != null ? mineTime > theirTime : !mine.isDefault)) {
          toSend.add(_noteRow(projectId, id, mine));
        }
      }
      if (toSend.isNotEmpty)
        await _c.from('chapter_notes').upsert(toSend, onConflict: 'chapter_id');
      await _writeLocalNotes(projectId, merged);
      return merged;
    } catch (e) {
      if (isMissingSchema(e)) _notesMissing = true;
      return local; // not set up yet, or no signal: the phone's copy is the truth for now
    }
  }

  @override
  Future<void> saveChapterNote(
    String projectId,
    String chapterId,
    ChapterNote note,
  ) async {
    final local = _localNotes(projectId)..[chapterId] = note;
    await _writeLocalNotes(projectId, local);
    if (_notesMissing) return;
    try {
      await _c
          .from('chapter_notes')
          .upsert(
            _noteRow(projectId, chapterId, note),
            onConflict: 'chapter_id',
          );
    } catch (e) {
      if (isMissingSchema(e))
        _notesMissing =
            true; // otherwise it is sent the next time they are loaded
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Private reading links
  // ---------------------------------------------------------------------------------------------

  Future<T> _rpc<T>(Future<T> Function() f) async {
    try {
      return await f();
    } on PostgrestException catch (e) {
      if (isMissingSchema(e))
        throw BackendException(
          'Reading links are not switched on for this site yet.',
        );
      // The function's own messages ("Please add your name first.") are written for the reader
      throw BackendException(
        e.message.isEmpty || e.message.length > 200
            ? 'That did not work. Please try again.'
            : e.message,
      );
    } catch (e) {
      if (isNetworkFailure(e))
        throw BackendException('You seem to be offline.', offline: true);
      throw BackendException('That did not work. Please try again.');
    }
  }

  @override
  Future<SharedManuscript?> sharedManuscript(String token) => _rpc(() async {
    final res = await _c.rpc(
      'get_shared_manuscript',
      params: {'p_token': token},
    );
    if (res == null) return null;
    final m = Map<String, dynamic>.from(res as Map);
    final p = Map<String, dynamic>.from(m['project'] as Map);
    final chapters = (m['chapters'] as List)
        .map(
          (c) => SharedChapter(
            id: c['id'].toString(),
            title: (c['title'] ?? '') as String,
            html: (c['content'] ?? '') as String,
          ),
        )
        .toList();
    return SharedManuscript(
      projectId: p['id'].toString(),
      title: (p['title'] ?? '') as String,
      authorName: (p['author_name'] ?? '') as String,
      description: (p['description'] ?? '') as String,
      chapters: chapters,
    );
  });

  @override
  Future<List<LinkComment>> myLinkComments(String token, String readerKey) =>
      _rpc(() async {
        final res = await _c.rpc(
          'list_share_comments',
          params: {'p_token': token, 'p_reader_key': readerKey},
        );
        return (res as List)
            .map(
              (j) => LinkComment.fromJson(Map<String, dynamic>.from(j as Map)),
            )
            .toList();
      });

  @override
  Future<LinkComment> addLinkComment({
    required String token,
    required String readerKey,
    required String readerName,
    required String chapterId,
    required String quote,
    required String note,
  }) => _rpc(() async {
    final res = await _c.rpc(
      'add_share_comment',
      params: {
        'p_token': token,
        'p_reader_key': readerKey,
        'p_reader_name': readerName,
        'p_chapter_id': chapterId,
        'p_quote': quote,
        'p_note': note,
      },
    );
    return LinkComment.fromJson(Map<String, dynamic>.from(res as Map));
  });

  @override
  Future<bool> deleteLinkComment(
    String token,
    String readerKey,
    String commentId,
  ) => _rpc(() async {
    final res = await _c.rpc(
      'delete_share_comment',
      params: {
        'p_token': token,
        'p_reader_key': readerKey,
        'p_comment_id': commentId,
      },
    );
    return res == true;
  });

  // ---------------------------------------------------------------------------------------------
  // Notifications and error monitoring
  // ---------------------------------------------------------------------------------------------

  @override
  Future<List<AppNotification>?> notifications(String userId) => _run(() async {
    try {
      final rows = await _c
          .from('notifications')
          .select()
          .eq('user_id', userId)
          .order('created_at', ascending: false)
          .limit(60);
      return [for (final r in rows) AppNotification.fromRow(r)];
    } on PostgrestException catch (e) {
      // The site's setup step has not been run yet
      if (isMissingSchema(e)) return null;
      rethrow;
    }
  });

  @override
  Future<void> markNotificationsRead(String userId, {List<String>? ids}) =>
      _run(() async {
        if (ids != null && ids.isEmpty) return;
        var q = _c
            .from('notifications')
            .update({'read_at': DateTime.now().toUtc().toIso8601String()})
            .eq('user_id', userId)
            .filter('read_at', 'is', null);
        if (ids != null) q = q.inFilter('id', ids);
        await q;
      });

  @override
  Future<NotificationSettings> notificationSettings(String userId) async {
    try {
      final row = await _c
          .from('notification_settings')
          .select()
          .eq('user_id', userId)
          .maybeSingle();
      if (row == null) return const NotificationSettings();
      Set<String> kinds(Object? v) =>
          v is List ? v.map((e) => e.toString()).toSet() : <String>{};
      return NotificationSettings(
        muted: kinds(row['muted_kinds']),
        email: kinds(row['email_kinds']),
      );
    } catch (_) {
      // Not set up yet, or no signal: nothing is muted
      return const NotificationSettings();
    }
  }

  @override
  Future<void> saveNotificationSettings(
    String userId,
    NotificationSettings settings,
  ) => _run(() async {
    await _c.from('notification_settings').upsert({
      'user_id': userId,
      'muted_kinds': settings.muted.toList(),
      'email_kinds': settings.email.toList(),
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    });
  });

  @override
  Future<void> reportError(Map<String, String> report) async {
    try {
      await _c.rpc(
        'report_client_error',
        params: {
          'p_fingerprint': report['fingerprint'] ?? '',
          'p_message': report['message'] ?? '',
          'p_stack': report['stack'] ?? '',
          'p_source': 'phone',
          'p_version': report['version'] ?? '',
          'p_url': report['where'] ?? '',
          'p_ua': report['device'] ?? '',
          'p_extra': {'where': report['where'] ?? ''},
        },
      );
    } catch (_) {
      // Reporting must never be the thing that breaks
    }
  }
}
