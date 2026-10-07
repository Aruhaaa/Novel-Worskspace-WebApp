import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Brand } from '../Brand';
import { ModeOptions } from './ModeOptions';
import { openingPath, type UseMode } from '../../lib/mode';
import landscape from '../../assets/quiet-landscape.svg';

/** Shown once after signing in, when this device has not heard the answer yet. */
export const ModeChooser: React.FC = () => {
  const { setMode } = useApp();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<UseMode | null>(null);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (!choice) return;
    setMode(choice);
    navigate(openingPath(choice), { replace: true });
  };

  return (
    <div className="auth-wrap">
      <section className="auth-art" aria-hidden="true">
        <Brand to="#/" />
        <h2>
          Two rooms,
          <br />
          one <em>door.</em>
        </h2>
        <p>Read what others have written. Write your own. Move between them whenever you like.</p>
        <img src={landscape} alt="" width="380" height="430" />
      </section>

      <section className="auth-form">
        <form className="auth-card" onSubmit={go}>
          <h1 id="mode-h">What brings you here?</h1>
          <p className="lead">This only decides what opens first. You can read and write either way, and change it any time in Preferences.</p>
          <ModeOptions value={choice} onChange={setChoice} labelledBy="mode-h" />
          <button className="button button-primary" style={{ width: '100%' }} disabled={!choice}>
            Continue
          </button>
        </form>
      </section>
    </div>
  );
};
