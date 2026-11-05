import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Check } from 'lucide-react';
import { THEMES, applyTheme, loadTheme, type ThemeOption } from '../../lib/themes';
import { EDITOR_FONTS, loadEditorFont, saveEditorFont, getEditorFontFamily } from '../../lib/editorFonts';
import { loadSpellPrefs, saveSpellPrefs, SPELL_LANGUAGES } from '../../lib/spell';
import { loadLiveEditing, loadLookupAllowed, loadTypewriter, saveLiveEditing, saveLookupAllowed, saveTypewriter } from '../../lib/writingTools';
import { errorReportsEnabled, setErrorReportsEnabled } from '../../lib/errorReporter';
import { desktopBridge } from '../../lib/desktop';
import { DesktopUpdatesSection } from '../Desktop/DesktopUpdatesSection';
import { PageHead } from '../ui/PageHead';
import { ModeOptions } from '../Auth/ModeOptions';
import { AccountSection } from './AccountSection';
import { NotificationSettingsSection } from '../Notifications/NotificationSettingsSection';
import { useApp } from '../../context/AppContext';
import { isSampleLibraryOn, sampleNovelCount, setSampleLibraryOn } from '../../lib/bundledLibrary';
import { LANGUAGES, getLang, setLang, tp, useT, type Lang } from '../../i18n';

// A small page drawn in the theme's own colours, so people pick by seeing it
const ThemePreview: React.FC<{ theme: ThemeOption }> = ({ theme }) => {
  const t = useT();
  const p = theme.preview;
  return (
    <div className="theme-preview" aria-hidden="true" style={{ background: p.canvas, border: `1px solid ${p.border}` }}>
      <div className="tp-side" style={{ background: p.surface }}>
        <i style={{ background: p.ink, width: '70%' }} />
        <i style={{ background: p.muted, opacity: 0.5 }} />
        <i style={{ background: p.muted, opacity: 0.5, width: '60%' }} />
      </div>
      <div className="tp-main">
        <b style={{ color: p.ink }}>{t('Chapter One')}</b>
        <i style={{ background: p.muted, opacity: 0.5 }} />
        <i style={{ background: p.muted, opacity: 0.5, width: '80%' }} />
        <span className="tp-btn" style={{ background: p.accent }} />
      </div>
    </div>
  );
};

export const PreferencesView: React.FC = () => {
  const t = useT();
  const location = useLocation();
  const { mode, setMode, isGuest, isSupabase, loadPublicProjects } = useApp();
  const [themeId, setThemeId] = useState(loadTheme);
  const [fontId, setFontId] = useState(loadEditorFont);
  const [spell, setSpell] = useState(loadSpellPrefs);
  const [samples, setSamples] = useState(isSampleLibraryOn);
  const [typewriter, setTypewriter] = useState(loadTypewriter);
  const [lookup, setLookup] = useState(loadLookupAllowed);
  const [liveEditing, setLiveEditing] = useState(loadLiveEditing);
  const [reports, setReports] = useState(errorReportsEnabled);
  const sampleCount = sampleNovelCount();

  // A link such as #/preferences#notifications scrolls to that section
  useEffect(() => {
    if (!location.hash) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) el.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  const changeSamples = (on: boolean) => {
    setSamples(on);
    setSampleLibraryOn(on);
    // The library the app is holding was loaded with the old choice
    void loadPublicProjects();
  };

  const changeSpell = (next: typeof spell) => {
    setSpell(next);
    saveSpellPrefs(next);
  };

  const chooseTheme = (id: string) => {
    setThemeId(id);
    applyTheme(id);
  };

  const chooseFont = (id: string) => {
    setFontId(id);
    saveEditorFont(id);
  };

  return (
    <div className="studio-view">
      <div className="page">
        <PageHead
          eyebrow={t('PREFERENCES')}
          title={
            <>
              {t('Make it')} <em>{t('yours.')}</em>
            </>
          }
          lead={t('Choose how Novelist Workspace looks. Your choice is saved on this device.')}
        />

        <section aria-labelledby="mode-h">
          <h2 className="section-title" id="mode-h">{t('What opens first')}</h2>
          <p className="section-note">
            {isGuest
              ? t('Guests open to the library. Make an account to choose.')
              : isSupabase
                ? t('Read and Write are always one tap apart in the header. This only decides where you land. Saved to your account, so it follows you to other devices.')
                : t('Read and Write are always one tap apart in the header. This only decides where you land. Saved on this device.')}
          </p>
          {!isGuest && <ModeOptions value={mode} onChange={setMode} labelledBy="mode-h" />}
        </section>

        <hr className="divider" />

        <section aria-labelledby="lang-h" id="language">
          <h2 className="section-title" id="lang-h">{t('Language')}</h2>
          <p className="section-note">{t('The language of menus and screens. Anything not translated yet stays in English. Saved on this device.')}</p>
          <label className="field" style={{ maxWidth: 320 }}>
            <span>{t('Show the app in')}</span>
            <select className="select" value={getLang()} onChange={(e) => void setLang(e.target.value as Lang)}>
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </label>
        </section>

        <hr className="divider" />

        <section aria-labelledby="theme-h">
          <h2 className="section-title" id="theme-h">{t('Theme')}</h2>
          <p className="section-note">{t('Applies to every screen except the novel reader, which keeps its own reading settings.')}</p>
          <div className="theme-grid" role="radiogroup" aria-labelledby="theme-h">
            {THEMES.map((theme) => (
              <button key={theme.id} className="theme-card" role="radio" aria-checked={theme.id === themeId} onClick={() => chooseTheme(theme.id)}>
                <ThemePreview theme={theme} />
                <div className="theme-meta">
                  <div>
                    <strong>{t(theme.name)}</strong>
                    <small>{t(theme.description)}</small>
                  </div>
                  <span className="tick"><Check /></span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <hr className="divider" />

        <section aria-labelledby="font-h">
          <h2 className="section-title" id="font-h">{t('Writing font')}</h2>
          <p className="section-note">{t("Only used inside the manuscript editor. Menus and headings keep the app's own type. Saved on this device.")}</p>
          <label className="field" style={{ maxWidth: 320 }}>
            <span>{t('Font')}</span>
            <select className="select" value={fontId} onChange={(e) => chooseFont(e.target.value)}>
              {EDITOR_FONTS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>
          <p className="font-sample" style={{ fontFamily: getEditorFontFamily(fontId) }}>
            {t('On the morning the sea disappeared, Ada was making tea.')}
          </p>
        </section>

        <hr className="divider" />

        <section aria-labelledby="tools-h">
          <h2 className="section-title" id="tools-h">{t('Writing tools')}</h2>
          <p className="section-note">{t('Both can also be switched on and off from the manuscript toolbar. Saved on this device.')}</p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={typewriter}
              onChange={(e) => {
                setTypewriter(e.target.checked);
                saveTypewriter(e.target.checked);
              }}
            />
            <span>{t('Typewriter scrolling: keep the line I am writing near the middle of the screen')}</span>
          </label>
          <label className="check-row" style={{ marginTop: 10 }}>
            <input
              type="checkbox"
              checked={lookup}
              onChange={(e) => {
                setLookup(e.target.checked);
                saveLookupAllowed(e.target.checked);
              }}
            />
            <span>{t('Word lookup: meanings and similar words (sends only the selected word to dictionaryapi.dev and Datamuse)')}</span>
          </label>
        </section>

        <hr className="divider" />

        <section aria-labelledby="together-h">
          <h2 className="section-title" id="together-h">{t('Writing together')}</h2>
          <p className="section-note">
            {t('In a project other people are on, a chapter that you and they have open is written together: you see each other’s cursors and changes as they are typed. Turn this off if it ever gets in your way. The chapter is then edited and saved on its own, as in a project nobody else is in, and changes made at the same time by different people can overwrite each other. Saved on this device.')}
          </p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={liveEditing}
              onChange={(e) => {
                setLiveEditing(e.target.checked);
                saveLiveEditing(e.target.checked);
              }}
            />
            <span>{t('Write shared chapters together live')}</span>
          </label>
        </section>

        <hr className="divider" />

        <section aria-labelledby="spell-h">
          <h2 className="section-title" id="spell-h">{t('Spelling')}</h2>
          <p className="section-note">
            {t("Your browser underlines misspelled words as you write. It does not know your characters' or places' names, so those may be marked too. Takes effect the next time you open a chapter. Saved on this device.")}
          </p>
          <label className="check-row">
            <input type="checkbox" checked={spell.check} onChange={(e) => changeSpell({ ...spell, check: e.target.checked })} />
            <span>{t('Check spelling as I write')}</span>
          </label>
          <label className="field" style={{ maxWidth: 320, marginTop: 14 }}>
            <span>{t('Language')}</span>
            <select className="select" value={spell.lang} disabled={!spell.check} onChange={(e) => changeSpell({ ...spell, lang: e.target.value })}>
              {SPELL_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.id === '' ? t("Browser's default") : l.label}</option>
              ))}
            </select>
            <small>{t('The browser needs that dictionary installed. Chrome and Edge download it on first use.')}</small>
          </label>
          <p className="section-note" style={{ marginTop: 14 }}>
            {t("Style notes are separate: open them with the pen-and-check button in the manuscript's formatting bar. They flag repeated words, adverbs, filler words, long sentences and repeated sentence openers, as gentle nudges only.")}
          </p>
        </section>

        {!isGuest && (
          <>
            <hr className="divider" />
            <NotificationSettingsSection />
          </>
        )}

        {desktopBridge() && (
          <>
            <hr className="divider" />
            <DesktopUpdatesSection />
          </>
        )}

        <hr className="divider" />

        <section aria-labelledby="reports-h" id="problem-reports">
          <h2 className="section-title" id="reports-h">{t('Help fix problems')}</h2>
          <p className="section-note">
            {t('When something breaks, a short note is sent so it can be fixed: what the error said, which screen was open and which version of the app this is. Never anything you wrote, and never your name or email. Saved on this device.')}
          </p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={reports}
              onChange={(e) => {
                setReports(e.target.checked);
                setErrorReportsEnabled(e.target.checked);
              }}
            />
            <span>{t('Send a note when something goes wrong')}</span>
          </label>
        </section>

        {sampleCount > 0 && (
          <>
            <hr className="divider" />
            <section aria-labelledby="samples-h">
              <h2 className="section-title" id="samples-h">{t('Sample novels')}</h2>
              <p className="section-note">
                {tp(
                  sampleCount,
                  'The library comes with {n} sample novel, written for this site under made-up pen names, so there is always something to read. Hide it to see only what people have published. Saved on this device.',
                  'The library comes with {n} sample novels, written for this site under made-up pen names, so there is always something to read. Hide them to see only what people have published. Saved on this device.'
                )}
              </p>
              <label className="check-row">
                <input type="checkbox" checked={samples} onChange={(e) => changeSamples(e.target.checked)} />
                <span>{t('Show the sample novels in the library')}</span>
              </label>
            </section>
          </>
        )}

        {!isGuest && (
          <>
            <hr className="divider" />
            <AccountSection />
          </>
        )}
      </div>
    </div>
  );
};
