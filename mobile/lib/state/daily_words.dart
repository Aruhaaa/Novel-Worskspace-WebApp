import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

String localDate([DateTime? d]) {
  final t = d ?? DateTime.now();
  return '${t.year.toString().padLeft(4, '0')}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')}';
}

/// "Words written today": how much longer the manuscript is than it was this morning, added up over every chapter.
/// The same rule as the web app. Deleting text never lowers today's count, and a chapter that already existed is
/// not counted as written today. Kept on the phone.
class DailyWords {
  DailyWords(this._prefs, {String Function()? today})
    : _today = today ?? localDate;

  final SharedPreferences _prefs;
  final String Function() _today;

  String _key(String projectId) => 'day_$projectId';

  Map<String, dynamic>? _read(String projectId) {
    final raw = _prefs.getString(_key(projectId));
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  Future<void> _write(String projectId, Map<String, dynamic> rec) =>
      _prefs.setString(_key(projectId), jsonEncode(rec));

  Map<String, dynamic> _fresh(Map<String, int> words) => {
    'date': _today(),
    'base': Map<String, int>.of(words),
    'last': Map<String, int>.of(words),
    'logged': 0,
  };

  Map<String, int> _ints(dynamic m) =>
      (m as Map).map((k, v) => MapEntry(k.toString(), (v as num).toInt()));

  /// Call when a project's chapters load: starts a new day, or adds chapters that arrived from another device.
  Future<void> startDay(String projectId, Map<String, int> words) async {
    final rec = _read(projectId);
    if (rec == null || rec['date'] != _today()) {
      await _write(projectId, _fresh(words));
      return;
    }
    final base = _ints(rec['base']);
    final last = _ints(rec['last']);
    var changed = false;
    words.forEach((id, n) {
      if (!last.containsKey(id)) {
        base[id] = n;
        last[id] = n;
        changed = true;
      }
    });
    if (changed) await _write(projectId, {...rec, 'base': base, 'last': last});
  }

  /// A chapter that already had its words (a new one made from a template, an import) is not "written today".
  Future<void> markExisting(
    String projectId,
    String chapterId,
    int words,
  ) async {
    final rec = _read(projectId) ?? _fresh({});
    final base = _ints(rec['base'])..[chapterId] = words;
    final last = _ints(rec['last'])..[chapterId] = words;
    await _write(projectId, {...rec, 'base': base, 'last': last});
  }

  Future<void> forget(String projectId, String chapterId) async {
    final rec = _read(projectId);
    if (rec == null) return;
    final base = _ints(rec['base'])..remove(chapterId);
    final last = _ints(rec['last'])..remove(chapterId);
    await _write(projectId, {...rec, 'base': base, 'last': last});
  }

  /// Words written today so far, without changing anything
  int writtenToday(String projectId) {
    final rec = _read(projectId);
    if (rec == null || rec['date'] != _today()) return 0;
    return (rec['logged'] as num?)?.toInt() ?? 0;
  }

  /// Record a saved chapter's length. Returns today's total to log, or null if there is nothing new to log.
  Future<int?> noteWords(String projectId, String chapterId, int words) async {
    var rec = _read(projectId) ?? _fresh({});
    if (rec['date'] != _today()) {
      // The day rolled over while the app stayed open: yesterday's last lengths are this morning's start
      final last = _ints(rec['last']);
      rec = {
        'date': _today(),
        'base': Map<String, int>.of(last),
        'last': Map<String, int>.of(last),
        'logged': 0,
      };
    }
    final base = _ints(rec['base']);
    final last = _ints(rec['last'])..[chapterId] = words;
    var net = 0;
    last.forEach((id, n) => net += n - (base[id] ?? 0));
    if (net < 0) net = 0;
    final logged = (rec['logged'] as num).toInt();
    final next = net > logged ? net : logged;
    await _write(projectId, {
      'date': rec['date'],
      'base': base,
      'last': last,
      'logged': next,
    });
    return next > logged ? next : null;
  }
}
