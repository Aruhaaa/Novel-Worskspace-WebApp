import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/toastContext';
import type { Project } from '../services/types';
import { t } from '../i18n';

/** Publish or unpublish a project under the author's display name. */
export const usePublishProject = () => {
  const { user, profile, publishProject } = useApp();
  const { toast } = useToast();
  return async (project: Project) => {
    if (!user) return;
    const authorName = profile?.display_name || (user.email ? user.email.split('@')[0] : 'Anonymous');
    const publishing = !project.is_published;
    await publishProject(project.id, publishing, authorName);
    toast({
      message: publishing ? t('“{title}” is now in the Public Library.', { title: project.title }) : t('“{title}” is no longer public.', { title: project.title }),
      actionLabel: t('Undo'),
      onAction: () => publishProject(project.id, !publishing, authorName),
    });
  };
};
