import type React from 'react';
import type { ImportDialog as FullImportDialog } from './ImportDialog';
import { lazyDialog } from '../ui/lazyDialog';

/** The import dialog, downloaded only when someone first imports a manuscript. */
export const ImportDialog = lazyDialog<React.ComponentProps<typeof FullImportDialog>>(
  () => import('./ImportDialog').then((m) => ({ default: m.ImportDialog })),
  (props) => props.open
);
