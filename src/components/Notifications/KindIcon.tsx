import React from 'react';
import { Link2, Mail, MessageCircle, Star, UserPlus, Users } from 'lucide-react';
import type { NotificationKind } from '../../lib/notifications';

const ICONS: Record<NotificationKind, React.ComponentType> = {
  follow: UserPlus,
  comment: MessageCircle,
  review: Star,
  message: Mail,
  share_comment: Link2,
  collab: Users,
};

/** A small round icon for each kind of notification. */
export const KindIcon: React.FC<{ kind: NotificationKind }> = ({ kind }) => {
  const Icon = ICONS[kind];
  return (
    <span className={`notif-icon kind-${kind}`} aria-hidden="true">
      <Icon />
    </span>
  );
};
