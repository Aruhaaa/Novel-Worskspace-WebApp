import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Lock, LogIn } from 'lucide-react';

interface GuestGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export const GuestGateModal: React.FC<GuestGateModalProps> = ({ 
  isOpen, 
  onClose, 
  title = "Authentication Required", 
  message = "Please log in or create an account to use this feature." 
}) => {
  const navigate = useNavigate();
  const { logout } = useApp();

  if (!isOpen) return null;

  const handleLogin = async () => {
    // We log out the guest state and navigate to login
    await logout();
    navigate('/login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden relative z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4 border border-indigo-500/20">
            <Lock className="w-6 h-6 text-indigo-400" />
          </div>
          
          <h2 className="text-xl font-bold text-slate-100 mb-2">
            {title}
          </h2>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            {message}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/20 transition-all"
            >
              <LogIn className="w-4 h-4" />
              Log In to Continue
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
