import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Dialog } from '../ui/Dialog';

interface GuestGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export const GuestGateModal: React.FC<GuestGateModalProps> = ({
  isOpen,
  onClose,
  title = 'Keep your work safe.',
  message = 'Please log in or create an account to use this feature.',
}) => {
  const navigate = useNavigate();
  const { logout } = useApp();

  const handleLogin = async () => {
    // Leave guest mode and go to the sign-in screen
    await logout();
    navigate('/login');
  };

  return (
    <Dialog open={isOpen} onClose={onClose} labelledBy="gate-h">
      <p className="eyebrow">ACCOUNT REQUIRED</p>
      <h2 id="gate-h">{title}</h2>
      <p>{message}</p>
      <div className="dialog-actions">
        <button className="button button-outline button-small" onClick={onClose}>
          Maybe later
        </button>
        <button className="button button-primary button-small" onClick={handleLogin}>
          Log in to continue
        </button>
      </div>
    </Dialog>
  );
};
