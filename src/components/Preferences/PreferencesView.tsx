import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { THEMES, applyTheme, loadTheme, type ThemeOption } from '../../lib/themes';
import { EDITOR_FONTS, loadEditorFont, saveEditorFont, getEditorFontFamily } from '../../lib/editorFonts';
import { loadSpellPrefs, saveSpellPrefs, SPELL_LANGUAGES } from '../../lib/spell';
import { PageHead } from '../ui/PageHead';
import { ModeOptions } from '../Auth/ModeOptions';
import { useApp } from '../../context/AppContext';

// A small page drawn in the theme's own colours, so people pick by seeing it
const ThemePreview: React.FC<{ theme: ThemeOption }> = ({ theme }) => {
  const p = theme.preview;
  return (
    <div className="theme-preview" aria-hidden="true" style={{ background: p.canvas, border: `1px solid ${p.border}` }}>
      <div className="tp-side" style={{ background: p.surface }}>
        <i style={{ background: p.ink, width: '70%' }} />
        <i style={{ background: p.muted, opacity: 0.5 }} />
        <i style={{ background: p.muted, opacity: 0.5, width: '60%' }} />
      </div>
      <div className="tp-main">
        <b style={{ color: p.ink }}>Chapter One</b>
        <i style={{ background: p.muted, opacity: 0.5 }} />
        <i style={{ background: p.muted, opacity: 0.5, width: '80%' }} />
        <span className="tp-btn" style={{ background: p.accent }} />
      </div>
    </div>
  );
};

export const PreferencesView: React.FC = () => {
  const { mode, setMode, isGuest } = useApp();
  const [themeId, setThemeId] = useState(loadTheme);
  const [fontId, setFontId] = useState(loadEditorFont);
  const [spell, setSpell] = useState(loadSpellPrefs);

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
          eyebrow="PREFERENCES"
          title={
            <>
              Make it <em>yours.</em>
            </>
          }
          lead="Choose how Novelist Workspace looks. Your choice is saved on this device."
        />

        <section aria-labelledby="mode-h">
          <h2 className="section-title" id="mode-h">What opens first</h2>
          <p className="section-note">
            {isGuest
              ? 'Guests open to the library. Make an account to choose.'
              : 'Read and Write are always one tap apart in the header. This only decides where you land. Saved on this device.'}
          </p>
          {!isGuest && <ModeOptions value={mode} onChange={setMode} labelledBy="mode-h" />}
        </section>

        <hr className="divider" />

        <section aria-labelledby="theme-h">
          <h2 className="section-title" id="theme-h">Theme</h2>
          <p className="section-note">Applies to every screen except the novel reader, which keeps its own reading settings.</p>
          <div className="theme-grid" role="radiogroup" aria-labelledby="theme-h">
            {THEMES.map((theme) => (
              <button key={theme.id} className="theme-card" role="radio" aria-checked={theme.id === themeId} onClick={() => chooseTheme(theme.id)}>
                <ThemePreview theme={theme} />
                <div className="theme-meta">
                  <div>
                    <strong>{theme.name}</strong>
                    <small>{theme.description}</small>
                  </div>
                  <span className="tick"><Check /></span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <hr className="divider" />

        <section aria-labelledby="font-h">
          <h2 className="section-title" id="font-h">Writing font</h2>
          <p className="section-note">Only used inside the manuscript editor. Menus and headings keep the app's own type. Saved on this device.</p>
          <label className="field" style={{ maxWidth: 320 }}>
            <span>Font</span>
            <select className="select" value={fontId} onChange={(e) => chooseFont(e.target.value)}>
              {EDITOR_FONTS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </label>
          <p className="font-sample" style={{ fontFamily: getEditorFontFamily(fontId) }}>
            On the morning the sea disappeared, Ada was making tea.
          </p>
        </section>

        <hr className="divider" />

        <section aria-labelledby="spell-h">
          <h2 className="section-title" id="spell-h">Spelling</h2>
          <p className="section-note">
            Your browser underlines misspelled words as you write. It does not know your characters' or places' names, so those may be marked too. Takes effect the next time you open a chapter. Saved on this device.
          </p>
          <label className="check-row">
            <input type="checkbox" checked={spell.check} onChange={(e) => changeSpell({ ...spell, check: e.target.checked })} />
            <span>Check spelling as I write</span>
          </label>
          <label className="field" style={{ maxWidth: 320, marginTop: 14 }}>
            <span>Language</span>
            <select className="select" value={spell.lang} disabled={!spell.check} onChange={(e) => changeSpell({ ...spell, lang: e.target.value })}>
              {SPELL_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
            <small>The browser needs that dictionary installed. Chrome and Edge download it on first use.</small>
          </label>
          <p className="section-note" style={{ marginTop: 14 }}>
            Style notes are separate: open them with the pen-and-check button in the manuscript's formatting bar. They flag repeated words, adverbs, filler words, long sentences and repeated sentence openers, as gentle nudges only.
          </p>
        </section>
      </div>
    </div>
  );
};
