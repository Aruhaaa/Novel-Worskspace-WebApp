import React, { useState } from 'react';
import { useT } from '../../i18n';
import { answerLanguage, usePendingLanguageQuestion } from '../../lib/languagePrompt';
import { defaultNovelLanguage } from '../../lib/novelLanguage';
import type { Project } from '../../services/types';
import { Dialog } from './Dialog';
import { LanguageSelect } from './LanguageSelect';

const Ask: React.FC<{ project: Project }> = ({ project }) => {
  const t = useT();
  const [code, setCode] = useState(defaultNovelLanguage());
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        answerLanguage(code);
      }}
    >
      <p className="eyebrow">{t('BEFORE YOU PUBLISH')}</p>
      <h2 id="pl-h">{t('Which language is this version in?')}</h2>
      <p>
        {t('“{title}” has no language yet. Readers choose novels by language, so say which one this is. Have the same story in another language? Make it a separate novel and publish each version on its own.', { title: project.title })}
      </p>
      <label htmlFor="pl-lang">{t('Language of this novel')}</label>
      <LanguageSelect id="pl-lang" value={code} onChange={setCode} style={{ marginTop: 8 }} />
      <div className="dialog-actions">
        <button type="button" className="button button-outline button-small" onClick={() => answerLanguage(null)}>
          {t('Cancel')}
        </button>
        <button className="button button-primary button-small" disabled={!code}>
          {t('Publish')}
        </button>
      </div>
    </form>
  );
};

/** The one question asked before a novel with no language is published (see lib/languagePrompt.ts) */
export const PublishLanguageDialog: React.FC = () => {
  const project = usePendingLanguageQuestion();
  return (
    <Dialog open={!!project} onClose={() => answerLanguage(null)} labelledBy="pl-h">
      {project && <Ask key={project.id} project={project} />}
    </Dialog>
  );
};
