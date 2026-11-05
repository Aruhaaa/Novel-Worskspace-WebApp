import type React from 'react';
import type { ExportDialog as FullExportDialog } from './ExportDialog';
import { lazyDialog } from '../ui/lazyDialog';

/** The export dialog, downloaded (with the Word and e-book writers it uses) only when someone first exports. */
export const ExportDialog = lazyDialog<React.ComponentProps<typeof FullExportDialog>>(
  () => import('./ExportDialog').then((m) => ({ default: m.ExportDialog })),
  (props) => !!props.project
);
