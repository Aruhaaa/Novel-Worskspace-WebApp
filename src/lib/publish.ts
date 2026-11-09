import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/toastContext';
import type { Project } from '../services/types';
import { t, tp } from '../i18n';
import { askLanguage } from './languagePrompt';
import { supportsLanguage } from './novelLanguage';

/** Publish or unpublish a project under the author's display name. */
export const usePublishProject = () => {
  const { user, profile, publishProject, updateProjectSettings } = useApp();
  const { toast } = useToast();
  return async (project: Project) => {
    if (!user) return;
    const authorName = profile?.display_name || (user.email ? user.email.split('@')[0] : 'Anonymous');
    const publishing = !project.is_published;
    // A novel goes to readers under a language, so one that has none is asked first (and not published if the question is dismissed)
    if (publishing && !project.language && supportsLanguage(project)) {
      const code = await askLanguage(project);
      if (!code) return;
      await updateProjectSettings(project.id, { language: code });
    }
    await publishProject(project.id, publishing, authorName);
    toast({
      message: publishing ? t('“{title}” is now in the Public Library.', { title: project.title }) : t('“{title}” is no longer public.', { title: project.title }),
      actionLabel: t('Undo'),
      onAction: () => publishProject(project.id, !publishing, authorName),
    });
  };
};

/** Take chapters back to drafts, with a message that can undo it. (Publishing goes through PublishChapterDialog, which asks first.) */
export const useUnpublishChapters = () => {
  const { activeProject, chapters, publishChapters } = useApp();
  const { toast } = useToast();
  return async (chapterIds: string[]) => {
    if (!activeProject || chapterIds.length === 0) return;
    const ids = new Set(chapterIds);
    const left = chapters.filter((c) => c.published_at !== null && !ids.has(c.id)).length;
    const { error } = await publishChapters(chapterIds, false);
    if (error) {
      toast({ message: error });
      return;
    }
    toast({
      message:
        left === 0
          ? t('“{title}” is no longer in the Public Library, because none of its chapters is published.', { title: activeProject.title })
          : tp(chapterIds.length, '{n} chapter is a draft again.', '{n} chapters are drafts again.'),
      actionLabel: t('Undo'),
      onAction: () => {
        void publishChapters(chapterIds, true);
      },
    });
  };
};
