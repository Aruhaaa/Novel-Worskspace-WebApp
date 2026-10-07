// The same shapes as the web app's database rows, so both apps read and write the same data.

DateTime _date(dynamic v) =>
    v is String ? (DateTime.tryParse(v) ?? DateTime.now()) : DateTime.now();
List<String> _strings(dynamic v) =>
    v is List ? v.map((e) => e.toString()).toList() : <String>[];

class AppUser {
  const AppUser({required this.id, required this.email});
  final String id;
  final String email;
}

class Profile {
  const Profile({
    required this.id,
    this.displayName = '',
    this.bio = '',
    this.dailyWordGoal = 1000,
    this.following = const [],
  });
  final String id;
  final String displayName;
  final String bio;
  final int dailyWordGoal;
  final List<String> following;

  factory Profile.fromJson(Map<String, dynamic> j) => Profile(
    id: j['id'].toString(),
    displayName: (j['display_name'] ?? '') as String,
    bio: (j['bio'] ?? '') as String,
    dailyWordGoal: (j['daily_word_goal'] as num?)?.toInt() ?? 1000,
    following: _strings(j['following']),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'display_name': displayName,
    'bio': bio,
    'daily_word_goal': dailyWordGoal,
    'following': following,
  };

  Profile copyWith({String? displayName, String? bio, int? dailyWordGoal}) =>
      Profile(
        id: id,
        displayName: displayName ?? this.displayName,
        bio: bio ?? this.bio,
        dailyWordGoal: dailyWordGoal ?? this.dailyWordGoal,
        following: following,
      );
}

class Project {
  const Project({
    required this.id,
    required this.userId,
    required this.title,
    this.description = '',
    this.isPublished = false,
    this.authorName = '',
    this.genre = '',
    this.coverUrl = '',
    this.likes = const [],
    this.views = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String userId;
  final String title;
  final String description;
  final bool isPublished;
  final String authorName;
  final String genre;
  final String coverUrl;
  final List<String> likes;
  final List<String> views;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Project.fromJson(Map<String, dynamic> j) => Project(
    id: j['id'].toString(),
    userId: (j['user_id'] ?? '').toString(),
    title: (j['title'] ?? '') as String,
    description: (j['description'] ?? '') as String,
    isPublished: j['is_published'] == true,
    authorName: (j['author_name'] ?? '') as String,
    genre: (j['genre'] ?? '') as String,
    coverUrl: (j['cover_url'] ?? '') as String,
    likes: _strings(j['likes']),
    views: _strings(j['views']),
    createdAt: _date(j['created_at']),
    updatedAt: _date(j['updated_at']),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'user_id': userId,
    'title': title,
    'description': description,
    'is_published': isPublished,
    'author_name': authorName,
    'genre': genre,
    'cover_url': coverUrl,
    'likes': likes,
    'views': views,
    'created_at': createdAt.toIso8601String(),
    'updated_at': updatedAt.toIso8601String(),
  };
}

class Chapter {
  const Chapter({
    required this.id,
    required this.projectId,
    required this.title,
    required this.content,
    required this.position,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String projectId;
  final String title;

  /// HTML, in the same form the web editor writes
  final String content;
  final int position;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory Chapter.fromJson(Map<String, dynamic> j) => Chapter(
    id: j['id'].toString(),
    projectId: j['project_id'].toString(),
    title: (j['title'] ?? '') as String,
    content: (j['content'] ?? '') as String,
    position: (j['position'] as num?)?.toInt() ?? 0,
    createdAt: _date(j['created_at']),
    updatedAt: _date(j['updated_at']),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'project_id': projectId,
    'title': title,
    'content': content,
    'position': position,
    'created_at': createdAt.toIso8601String(),
    'updated_at': updatedAt.toIso8601String(),
  };

  Chapter copyWith({String? title, String? content, int? position}) => Chapter(
    id: id,
    projectId: projectId,
    title: title ?? this.title,
    content: content ?? this.content,
    position: position ?? this.position,
    createdAt: createdAt,
    updatedAt: DateTime.now(),
  );
}

enum EntityType { character, location, item, lore, scene }

class Entity {
  const Entity({
    required this.id,
    required this.projectId,
    required this.name,
    required this.type,
    this.description = '',
    this.content = const {},
    this.imageUrl = '',
  });

  final String id;
  final String projectId;
  final String name;
  final EntityType type;
  final String description;

  /// Attributes the writer typed, plus a few the app keeps under keys that start with an underscore
  final Map<String, String> content;
  final String imageUrl;

  factory Entity.fromJson(Map<String, dynamic> j) {
    final raw = j['content'];
    return Entity(
      id: j['id'].toString(),
      projectId: j['project_id'].toString(),
      name: (j['name'] ?? '') as String,
      type: EntityType.values.firstWhere(
        (t) => t.name == j['type'],
        orElse: () => EntityType.lore,
      ),
      description: (j['description'] ?? '') as String,
      content: raw is Map
          ? raw.map((k, v) => MapEntry(k.toString(), v.toString()))
          : const {},
      imageUrl: (j['image_url'] ?? '') as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'project_id': projectId,
    'name': name,
    'type': type.name,
    'description': description,
    'content': content,
    'image_url': imageUrl,
  };

  Entity copyWith({
    String? name,
    EntityType? type,
    String? description,
    Map<String, String>? content,
  }) => Entity(
    id: id,
    projectId: projectId,
    name: name ?? this.name,
    type: type ?? this.type,
    description: description ?? this.description,
    content: content ?? this.content,
    imageUrl: imageUrl,
  );

  /// Attributes a writer typed, hiding the ones the app manages itself
  List<MapEntry<String, String>> get typedAttributes {
    const board = {'lat', 'lng', 'status', 'order'};
    return content.entries
        .where((e) => !e.key.startsWith('_') && !board.contains(e.key))
        .toList();
  }

  List<String> get tags => (content['_tags'] ?? '')
      .split(',')
      .map((t) => t.trim())
      .where((t) => t.isNotEmpty)
      .toList();
}

class WordLog {
  const WordLog({required this.date, required this.count});
  final String date; // YYYY-MM-DD
  final int count;
}

enum ChapterStatus { draft, revising, done }

extension ChapterStatusLabel on ChapterStatus {
  String get label => switch (this) {
    ChapterStatus.draft => 'Drafting',
    ChapterStatus.revising => 'Revising',
    ChapterStatus.done => 'Done',
  };
}

/// A chapter's status, synopsis and private notes. Newer edit wins between this phone and the cloud.
class ChapterNote {
  const ChapterNote({
    this.status = ChapterStatus.draft,
    this.synopsis = '',
    this.notes = '',
    this.updatedAt = 0,
  });
  final ChapterStatus status;
  final String synopsis;
  final String notes;

  /// Milliseconds since the epoch of the last edit
  final int updatedAt;

  bool get isDefault =>
      status == ChapterStatus.draft && synopsis.isEmpty && notes.isEmpty;

  ChapterNote copyWith({
    ChapterStatus? status,
    String? synopsis,
    String? notes,
  }) => ChapterNote(
    status: status ?? this.status,
    synopsis: synopsis ?? this.synopsis,
    notes: notes ?? this.notes,
    updatedAt: DateTime.now().millisecondsSinceEpoch,
  );

  factory ChapterNote.fromJson(Map<String, dynamic> j) => ChapterNote(
    status: ChapterStatus.values.firstWhere(
      (s) => s.name == j['status'],
      orElse: () => ChapterStatus.draft,
    ),
    synopsis: (j['synopsis'] ?? '') as String,
    notes: (j['notes'] ?? '') as String,
    updatedAt: (j['updatedAt'] as num?)?.toInt() ?? 0,
  );

  Map<String, dynamic> toJson() => {
    'status': status.name,
    'synopsis': synopsis,
    'notes': notes,
    'updatedAt': updatedAt,
  };
}

/// What a reading link opens
class SharedManuscript {
  const SharedManuscript({
    required this.projectId,
    required this.title,
    required this.authorName,
    required this.description,
    required this.chapters,
  });
  final String projectId;
  final String title;
  final String authorName;
  final String description;
  final List<SharedChapter> chapters;
}

class SharedChapter {
  const SharedChapter({
    required this.id,
    required this.title,
    required this.html,
  });
  final String id;
  final String title;
  final String html;
}

class LinkComment {
  const LinkComment({
    required this.id,
    required this.chapterId,
    required this.quote,
    required this.note,
    required this.createdAt,
  });
  final String id;
  final String chapterId;
  final String quote;
  final String note;
  final DateTime createdAt;

  factory LinkComment.fromJson(Map<String, dynamic> j) => LinkComment(
    id: j['id'].toString(),
    chapterId: (j['chapter_id'] ?? '').toString(),
    quote: (j['quote'] ?? '') as String,
    note: (j['note'] ?? '') as String,
    createdAt: _date(j['created_at']),
  );
}

/// A chapter that was deleted but can still be brought back
class DeletedChapter {
  const DeletedChapter({
    required this.id,
    required this.projectId,
    required this.title,
    required this.content,
    required this.position,
    required this.deletedAt,
  });
  final String id;
  final String projectId;
  final String title;
  final String content;
  final int position;
  final DateTime deletedAt;

  factory DeletedChapter.fromJson(Map<String, dynamic> j) => DeletedChapter(
    id: j['id'].toString(),
    projectId: j['project_id'].toString(),
    title: (j['title'] ?? '') as String,
    content: (j['content'] ?? '') as String,
    position: (j['position'] as num?)?.toInt() ?? 0,
    deletedAt: _date(j['deleted_at']),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'project_id': projectId,
    'title': title,
    'content': content,
    'position': position,
    'deleted_at': deletedAt.toIso8601String(),
  };
}
