import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/backend.dart';
import '../data/models.dart';
import '../theme.dart';
import 'daily_words.dart';

/// What the person came here to do. It only decides where the app opens; both spaces are always one tap away.
enum UseMode { read, write, both }

class ReadingProgress {
  const ReadingProgress({required this.chapterIndex, required this.at});
  final int chapterIndex;
  final int at; // ms since the epoch

  Map<String, dynamic> toJson() => {'c': chapterIndex, 'at': at};
  factory ReadingProgress.fromJson(Map<String, dynamic> j) => ReadingProgress(
    chapterIndex: (j['c'] as num).toInt(),
    at: (j['at'] as num).toInt(),
  );
}

/// Who is signed in, how the app looks, and what has been read or saved on this phone.
class AppState extends ChangeNotifier {
  AppState({required this.backend, required this.prefs})
    : dailyWords = DailyWords(prefs) {
    _theme = themeById(prefs.getString('theme') ?? 'studio');
    _proseFont = prefs.getString('prose_font') ?? 'lora';
    _fontScale = prefs.getDouble('font_scale') ?? 1.0;
    _saved = (prefs.getStringList('saved') ?? []).toSet();
    final rawProgress = prefs.getString('progress');
    if (rawProgress != null) {
      try {
        _progress = (jsonDecode(rawProgress) as Map<String, dynamic>).map(
          (k, v) =>
              MapEntry(k, ReadingProgress.fromJson(v as Map<String, dynamic>)),
        );
      } catch (_) {
        _progress = {};
      }
    }
  }

  final Backend backend;
  final SharedPreferences prefs;
  final DailyWords dailyWords;

  bool booting = true;

  /// Reading without an account
  bool guest = false;
  AppUser? user;
  Profile? profile;
  UseMode? _mode;

  late ThemeOption _theme;
  late String _proseFont;
  late double _fontScale;
  Set<String> _saved = {};
  Map<String, ReadingProgress> _progress = {};

  // People this person has blocked: their novels are not shown. The names are only for the list in Me.
  Set<String> _blocked = {};
  Map<String, String> _blockedNames = {};

  // ---- reading preferences ----
  ThemeOption get theme => _theme;
  String get proseFontId => _proseFont;
  double get fontScale => _fontScale;
  Set<String> get saved => _saved;
  UseMode? get mode => _mode;
  bool get signedIn => user != null;

  bool isBlocked(String userId) => _blocked.contains(userId);

  /// Who is blocked, as (id, name) pairs
  List<MapEntry<String, String>> get blockedPeople => [
    for (final id in _blocked) MapEntry(id, _blockedNames[id] ?? 'Someone'),
  ];

  /// Past the front door: signed in, or browsing as a guest
  bool get inApp => signedIn || guest;

  void browseAsGuest() {
    guest = true;
    notifyListeners();
  }

  String get authorName {
    final name = profile?.displayName.trim() ?? '';
    if (name.isNotEmpty) return name;
    final email = user?.email ?? '';
    return email.contains('@') ? email.split('@').first : 'Author';
  }

  Future<void> init() async {
    try {
      user = await backend.restoreSession();
      if (user != null) await _loadAccount();
    } catch (_) {
      // opens signed out; signing in again will say what is wrong
    }
    booting = false;
    notifyListeners();
  }

  Future<void> _loadAccount() async {
    final u = user;
    if (u == null) return;
    // The answer follows the account to any phone; this phone's own copy is the fallback
    final m = u.mode ?? prefs.getString('mode_${u.id}');
    _mode = UseMode.values.where((x) => x.name == m).firstOrNull;
    // An answer given here before it was kept on the account is offered to the account once
    if (u.mode == null && _mode != null)
      unawaited(backend.saveUseMode(_mode!.name));
    try {
      _blocked = await backend.blockedUsers(u.id);
      final names = prefs.getString('blocked_names_${u.id}');
      _blockedNames = names == null
          ? {}
          : (jsonDecode(names) as Map<String, dynamic>).map(
              (k, v) => MapEntry(k, v.toString()),
            );
    } catch (_) {
      _blocked = {};
      _blockedNames = {};
    }
    try {
      profile = await backend.profile(u.id);
    } catch (_) {
      profile = Profile(
        id: u.id,
      ); // offline: the goal falls back to the default until it can be loaded
    }
  }

  Future<void> signIn(String email, String password) async {
    user = await backend.signIn(email, password);
    guest = false;
    await _loadAccount();
    notifyListeners();
  }

  /// Returns false when the email still has to be confirmed
  Future<bool> signUp(String email, String password) async {
    final u = await backend.signUp(email, password);
    if (u == null) return false;
    user = u;
    guest = false;
    await _loadAccount();
    notifyListeners();
    return true;
  }

  Future<void> signOut() async {
    await backend.signOut();
    user = null;
    profile = null;
    _mode = null;
    _blocked = {};
    _blockedNames = {};
    guest = false;
    notifyListeners();
  }

  Future<void> chooseMode(UseMode mode) async {
    _mode = mode;
    final u = user;
    if (u != null) {
      await prefs.setString('mode_${u.id}', mode.name);
      user = u.withMode(mode.name);
      await backend.saveUseMode(mode.name);
    }
    notifyListeners();
  }

  // ---- passwords and leaving ----
  Future<void> changePassword(String current, String next) {
    final u = user;
    if (u == null) throw BackendException('Sign in first.');
    return backend.changePassword(u.email, current, next);
  }

  /// Remove the account and everything in it, and forget what this phone kept for it.
  Future<void> deleteAccount(String password) async {
    final u = user;
    if (u == null) return;
    // What this phone holds for the account's novels, worked out before they are gone
    var projectIds = <String>[];
    try {
      projectIds = (await backend.myProjects(u.id)).map((p) => p.id).toList();
    } catch (_) {
      // still removed from the account; the phone's copies of a novel it cannot list are not reachable anyway
    }
    await backend.deleteAccount(u.id, u.email, password);
    for (final k in prefs.getKeys().toList()) {
      final mine =
          k == 'mode_${u.id}' ||
          k == 'blocks_${u.id}' ||
          k == 'blocked_names_${u.id}' ||
          projectIds.any(k.endsWith);
      if (mine) await prefs.remove(k);
    }
    user = null;
    profile = null;
    _mode = null;
    _blocked = {};
    _blockedNames = {};
    guest = false;
    notifyListeners();
  }

  // ---- reporting and blocking ----
  Future<void> reportNovel(Project project, String reason, String details) {
    final u = user;
    if (u == null) throw BackendException('Sign in to send a report.');
    return backend.reportNovel(u.id, project, reason, details);
  }

  /// Hide a writer's novels. Returns false when it could only be kept on this phone, not on the account.
  Future<bool> blockAuthor(String authorId, String name) async {
    final u = user;
    if (u == null) return false;
    _blocked = {..._blocked, authorId};
    _blockedNames = {
      ..._blockedNames,
      authorId: name.trim().isEmpty ? 'Someone' : name.trim(),
    };
    await prefs.setString('blocked_names_${u.id}', jsonEncode(_blockedNames));
    notifyListeners();
    return backend.blockUser(u.id, authorId);
  }

  Future<bool> unblockAuthor(String authorId) async {
    final u = user;
    if (u == null) return false;
    _blocked = {..._blocked}..remove(authorId);
    _blockedNames = {..._blockedNames}..remove(authorId);
    await prefs.setString('blocked_names_${u.id}', jsonEncode(_blockedNames));
    notifyListeners();
    return backend.unblockUser(u.id, authorId);
  }

  Future<void> saveProfile({String? displayName, int? dailyWordGoal}) async {
    final p = profile;
    if (p == null) return;
    profile = await backend.saveProfile(
      p.copyWith(displayName: displayName, dailyWordGoal: dailyWordGoal),
    );
    notifyListeners();
  }

  // ---- looks ----
  Future<void> setTheme(String id) async {
    _theme = themeById(id);
    await prefs.setString('theme', id);
    notifyListeners();
  }

  Future<void> setProseFont(String id) async {
    _proseFont = id;
    await prefs.setString('prose_font', id);
    notifyListeners();
  }

  Future<void> setFontScale(double scale) async {
    _fontScale = scale.clamp(0.8, 1.6);
    await prefs.setDouble('font_scale', _fontScale);
    notifyListeners();
  }

  // ---- saved novels and reading progress (kept on this phone) ----
  bool isSaved(String projectId) => _saved.contains(projectId);

  Future<void> toggleSaved(String projectId) async {
    _saved = _saved.contains(projectId)
        ? ({..._saved}..remove(projectId))
        : {..._saved, projectId};
    await prefs.setStringList('saved', _saved.toList());
    notifyListeners();
  }

  ReadingProgress? progressFor(String projectId) => _progress[projectId];

  /// Novels the reader has started, most recently read first
  List<String> get continueReading {
    final entries = _progress.entries.toList()
      ..sort((a, b) => b.value.at.compareTo(a.value.at));
    return entries.map((e) => e.key).toList();
  }

  Future<void> setProgress(String projectId, int chapterIndex) async {
    // Strictly later than every earlier place, so the most recently read always comes first
    final latest = _progress.values.fold<int>(0, (m, p) => p.at > m ? p.at : m);
    final now = DateTime.now().millisecondsSinceEpoch;
    _progress = {
      ..._progress,
      projectId: ReadingProgress(
        chapterIndex: chapterIndex,
        at: now > latest ? now : latest + 1,
      ),
    };
    await prefs.setString(
      'progress',
      jsonEncode(_progress.map((k, v) => MapEntry(k, v.toJson()))),
    );
    notifyListeners();
  }
}
