import 'models.dart';

/// Something went wrong talking to the data source, in words a writer can read.
class BackendException implements Exception {
  BackendException(this.message, {this.offline = false});
  final String message;

  /// The server could not be reached at all
  final bool offline;

  @override
  String toString() => message;
}

/// Everything the app needs from its data. Two implementations: the cloud database (the same one the web app
/// uses) and the phone alone.
abstract class Backend {
  bool get isCloud;

  // --- accounts
  Future<AppUser?> restoreSession();
  Future<AppUser> signIn(String email, String password);

  /// Returns null when the email must be confirmed first
  Future<AppUser?> signUp(String email, String password);
  Future<void> signOut();
  Future<Profile> profile(String userId);
  Future<Profile> saveProfile(Profile profile);

  // --- the library
  Future<List<Project>> publishedProjects();
  Future<Project> toggleLike(String projectId, String userId);

  // --- the writer's projects
  Future<List<Project>> myProjects(String userId);
  Future<Project> createProject(
    String userId,
    String title,
    String description,
  );
  Future<Project> updateProject(
    String id, {
    String? title,
    String? description,
    String? genre,
  });
  Future<Project> setPublished(String id, bool published, String authorName);

  // --- chapters
  Future<List<Chapter>> chapters(String projectId);
  Future<Chapter> createChapter(String projectId, String title);
  Future<Chapter> updateChapter(
    String id, {
    String? title,
    String? content,
    int? position,
  });
  Future<void> deleteChapter(String id);

  /// Keep a copy of a chapter that is about to be deleted, so it can be restored
  Future<void> keepDeleted(Chapter chapter);
  Future<List<DeletedChapter>> recentlyDeleted(String projectId);
  Future<void> forgetDeleted(String id);

  // --- notebook
  Future<List<Entity>> entities(String projectId);
  Future<Entity> createEntity(
    String projectId,
    String name,
    EntityType type,
    String description,
  );
  Future<Entity> updateEntity(
    String id, {
    String? name,
    EntityType? type,
    String? description,
    Map<String, String>? content,
  });
  Future<void> deleteEntity(String id);

  // --- progress
  Future<List<WordLog>> wordLogs(String projectId);
  Future<void> logWords(String projectId, String date, int count);

  // --- chapter notes (status, synopsis, private notes)
  Future<Map<String, ChapterNote>> chapterNotes(String projectId);
  Future<void> saveChapterNote(
    String projectId,
    String chapterId,
    ChapterNote note,
  );

  // --- private reading links. Null / unsupported when there is no cloud.
  Future<SharedManuscript?> sharedManuscript(String token);
  Future<List<LinkComment>> myLinkComments(String token, String readerKey);
  Future<LinkComment> addLinkComment({
    required String token,
    required String readerKey,
    required String readerName,
    required String chapterId,
    required String quote,
    required String note,
  });
  Future<bool> deleteLinkComment(
    String token,
    String readerKey,
    String commentId,
  );
}
