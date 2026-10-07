import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/backend.dart';
import '../state/daily_words.dart';
import 'html_codec.dart';

enum SaveState { saved, pending, saving, error }

class Draft {
  const Draft({required this.title, required this.html});
  final String title;
  final String html;
}

/// Saves the open chapter without losing a word, the same way the web app does:
/// - every change is copied to the phone at once and kept until the save is confirmed
/// - saves run one at a time and in order, so an old slow save can never overwrite a newer one
/// - pending changes are sent when the chapter closes or the app goes to the background
/// - a failed save is reported honestly, kept, and tried again
class Autosave extends ChangeNotifier {
  Autosave({
    required this.backend,
    required this.prefs,
    required this.dailyWords,
    required this.projectId,
    required this.chapterId,
    required this.currentTitle,
    required this.currentHtml,
    this.debounce = const Duration(seconds: 1),
    this.retryEvery = const Duration(seconds: 10),
  });

  final Backend backend;
  final SharedPreferences prefs;
  final DailyWords dailyWords;
  final String projectId;
  final String chapterId;
  final String Function() currentTitle;
  final String Function() currentHtml;
  final Duration debounce;
  final Duration retryEvery;

  SaveState state = SaveState.saved;
  String? lastError;

  bool _dirty = false;
  int _revision = 0;
  Timer? _timer;
  Timer? _retry;
  Future<void> _chain = Future.value();
  bool _disposed = false;

  static String _key(String chapterId) => 'draft_$chapterId';

  static Draft? readDraft(SharedPreferences prefs, String chapterId) {
    final raw = prefs.getString(_key(chapterId));
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      return Draft(
        title: (j['title'] ?? '') as String,
        html: (j['html'] ?? '') as String,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _clearDraft() => prefs.remove(_key(chapterId));

  /// Treat what was recovered from a safety copy as unsaved work
  void markRecovered() {
    _dirty = true;
    _set(SaveState.pending);
    _schedule(const Duration(milliseconds: 300));
  }

  void changed() {
    _revision++;
    _dirty = true;
    // The copy on the phone is written before anything else, so a crash or a dead battery loses nothing
    prefs.setString(
      _key(chapterId),
      jsonEncode({'title': currentTitle(), 'html': currentHtml()}),
    );
    _set(SaveState.pending);
    _schedule(debounce);
  }

  void _schedule(Duration d) {
    _timer?.cancel();
    _timer = Timer(d, () => unawaited(flush()));
  }

  void _set(SaveState s) {
    state = s;
    if (!_disposed) notifyListeners();
  }

  /// Send any pending change now. Safe to call at any time.
  Future<void> flush() {
    _chain = _chain.then((_) => _save());
    return _chain;
  }

  Future<void> _save() async {
    if (!_dirty) return;
    _timer?.cancel();
    _retry?.cancel();
    final title = currentTitle();
    final html = currentHtml();
    final revision = _revision;
    _dirty = false;
    _set(SaveState.saving);
    try {
      await backend.updateChapter(chapterId, title: title, content: html);
      lastError = null;
      // Only drop the safety copy if nothing newer was typed while this ran
      if (revision == _revision) {
        await _clearDraft();
        _set(SaveState.saved);
      } else {
        _set(SaveState.pending);
      }
      try {
        final total = await dailyWords.noteWords(
          projectId,
          chapterId,
          HtmlCodec.countWords(html),
        );
        if (total != null)
          await backend.logWords(projectId, localDate(), total);
      } catch (_) {
        // the word log is a nicety; it never blocks saving
      }
    } catch (e) {
      _dirty = true;
      lastError = e is BackendException ? e.message : 'Could not save.';
      _set(SaveState.error);
      if (!_disposed) _retry = Timer(retryEvery, () => unawaited(flush()));
    }
  }

  @override
  void dispose() {
    // Do not leave unsaved words behind when the chapter closes
    if (_dirty) unawaited(flush());
    _disposed = true;
    _timer?.cancel();
    _retry?.cancel();
    super.dispose();
  }
}
