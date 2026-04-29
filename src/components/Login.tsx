import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Map, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      await signIn();
    } catch (err: any) {
      console.error('Login error:', err);
      
      if (err.code === 'auth/popup-blocked') {
        setError('O pop-up de login foi bloqueado. Por favor, permita os pop-ups ou abra o app em uma nova aba.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Este domínio não está autorizado no Firebase. Por favor, abra o app em uma nova aba.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('O login foi cancelado. Tente novamente.');
      } else if (err.message && err.message.includes('missing initial state')) {
        setError('Erro de sessão (missing initial state). Por favor, CLIQUE NO ÍCONE NO CANTO SUPERIOR DIREITO para abrir em uma nova aba e fazer login.');
      } else {
        setError(`Erro ao fazer login: ${err.message || 'Tente novamente.'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden p-4">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-xl p-8 relative z-10 flex flex-col items-center">
        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-6 border border-primary/30">
          <Map size={32} className="text-primary" />
        </div>
        
        <h1 className="text-2xl font-bold text-text-main mb-2 text-center">Território Pro</h1>
        <p className="text-text-dim text-center mb-8 text-sm">
          Acesse para gerenciar seus territórios e compartilhar com sua equipe.
        </p>

        {error && (
          <div className="w-full bg-error/10 text-error text-sm p-3 rounded-lg border border-error/20 mb-6 text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-primary hover:bg-primary-hover text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-lg shadow-primary/20 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          <span>Entrar com o Google</span>
        </button>

        <p className="mt-6 text-xs text-text-dim text-center">
          Dificuldades para fazer login? <br/>
          Tente abrir o aplicativo em uma <strong>nova guia</strong> do navegador clicando no ícone no topo direito.
        </p>
      </div>
    </div>
  );
};
