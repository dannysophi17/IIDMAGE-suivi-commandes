import React, { useState, useRef } from 'react';
import Router from 'next/router';

export default function Login() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const [mounted, setMounted] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Placeholder pour 2FA futur
  const [show2FA, setShow2FA] = useState(false);
  const [code2FA, setCode2FA] = useState('');
  // Forgot password modal
  const [showForgot, setShowForgot] = useState(false);
  const [forgotName, setForgotName] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState(''); // '', 'sending', 'sent', 'error'
  const forgotInputRef = useRef(null);
  // Forgot password handler
  async function handleForgot(e) {
    e.preventDefault();
    setForgotStatus('sending');
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: forgotName, email: forgotEmail })
      });
      if (!res.ok) throw new Error();
      setForgotStatus('sent');
    } catch {
      setForgotStatus('error');
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    // Simulation de 2FA futur
    if (show2FA) {
      setLoading(false);
      setError('Code 2FA incorrect. (Démo)');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      setLoading(false);
      if (!res.ok) {
        setError('Identifiants incorrects. Veuillez réessayer.');
        return;
      }
      const j = await res.json();
      // Remember me: persist token + email.
      if (remember) {
        try {
          sessionStorage.removeItem('token');
        } catch {
          // ignore
        }
        localStorage.setItem('token', j.token);
        localStorage.setItem('iidmage_login_email', email);
        localStorage.setItem('iidmage_login_remember', '1');
      } else {
        try {
          localStorage.removeItem('token');
        } catch {
          // ignore
        }
        sessionStorage.setItem('token', j.token);
        localStorage.removeItem('iidmage_login_email');
        localStorage.setItem('iidmage_login_remember', '0');
      }
      setRedirecting(true);
      Router.push('/dashboard');
    } catch {
      setLoading(false);
      setError('Le serveur est temporairement indisponible.');
    }
  }

  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  // If already authenticated, don't show login again.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const rememberEnabled = localStorage.getItem('iidmage_login_remember') === '1';
      const sessionToken = sessionStorage.getItem('token');
      const localToken = localStorage.getItem('token');

      if (sessionToken) {
        setRedirecting(true);
        Router.replace('/dashboard');
        return;
      }

      if (localToken) {
        if (rememberEnabled) {
          setRedirecting(true);
          Router.replace('/dashboard');
          return;
        }
        // Respect "not remembered" setting.
        localStorage.removeItem('token');
      }
    } catch {
      // ignore
    }
  }, []);

  // Restore remembered email/setting (if any)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const enabled = localStorage.getItem('iidmage_login_remember') === '1';
      setRemember(enabled);
      if (enabled) {
        const savedEmail = localStorage.getItem('iidmage_login_email');
        if (savedEmail) setEmail(savedEmail);
      }
    } catch {
      // ignore
    }
  }, []);

  // Focus input when modal opens
  React.useEffect(() => {
    if (showForgot && forgotInputRef.current) {
      forgotInputRef.current.focus();
    }
  }, [showForgot]);

  return (
    <div className="h-screen overflow-hidden flex flex-col md:flex-row bg-[color:var(--brand-ink)] relative">
      {/* Lado izquierdo: abstracto, corporativo, sin iconos */}
      <div className={`hidden md:flex md:w-2/5 flex-col justify-between p-10 relative bg-white/5 backdrop-blur-sm transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}>
        <div className="absolute inset-0 opacity-[0.08] iidmage-login-left-pattern" aria-hidden />
        <div className="flex flex-col h-full justify-center">
          <div className="text-3xl font-extrabold tracking-tight mb-2 text-white transition-all duration-700">iiDmage</div>
          <div className="text-lg font-medium mb-4 text-white/80">Plateforme interne sécurisée</div>
          <div className="text-base text-white/70 mb-8 max-w-xs transition-all duration-700">
            Bienvenue sur votre espace professionnel.<br/>
            Accédez à vos outils, données et projets en toute confidentialité.<br/>
            <span className="inline-block mt-4 text-white/50 italic">« L'efficacité commence ici. »</span>
          </div>
        </div>
      </div>
      {/* Lado derecho: login */}
      <div className="flex-1 flex items-center justify-center bg-[color:var(--color-bg)] overflow-hidden md:rounded-l-3xl">
        <div className="w-full max-w-md mx-auto px-4 py-8 sm:px-7">
          <div className={`md:hidden mb-6 transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
            <div className="text-2xl font-extrabold tracking-tight text-gray-900">iiDmage</div>
            <div className="text-sm text-gray-600 mt-1">Plateforme interne sécurisée</div>
          </div>

          <div className={`w-full p-7 sm:p-8 shadow-2xl rounded-2xl border border-gray-200 bg-white transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0 anim-page-in' : 'opacity-0 translate-y-2'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">Connexion</h1>
                <p className="text-gray-600 mt-1">Accédez à votre espace de gestion</p>
              </div>
            </div>
          {error && (
            <div className="flex items-center bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 mb-4 text-sm">
              <svg className="w-4 h-4 mr-2 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" /></svg>
              {error}
            </div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-gray-700 font-medium mb-1">Adresse e-mail</label>
              <input
                id="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/30 bg-gray-50 transition-all duration-200"
                value={email}
                onChange={e=>setEmail(e.target.value)}
                placeholder="nom@entreprise.com"
                title="Adresse e-mail"
                autoComplete="email"
                type="email"
                required
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="block text-gray-700 font-medium mb-1">Mot de passe</label>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/30 bg-gray-50 pr-12 transition-all duration-200"
                value={password}
                onChange={e=>setPassword(e.target.value)}
                placeholder="••••••••"
                title="Mot de passe"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                tabIndex={-1}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute right-3 top-[70%] -translate-y-1/2 focus:outline-none transition-colors duration-200 flex items-center justify-center w-7 h-7"
                onClick={()=>setShowPassword(v=>!v)}
              >
                {showPassword ? (
                  <svg className="w-4.5 h-4.5 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-4-9-7s4-7 9-7c1.02 0 2.01.15 2.875.425M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.07 4.93l-14.14 14.14" /></svg>
                ) : (
                  <svg className="w-4.5 h-4.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-.274.857-.676 1.664-1.186 2.393" /></svg>
                )}
              </button>
            </div>
            {/* 2FA futur */}
            {show2FA && (
              <div>
                <label htmlFor="code2fa" className="block text-gray-700 font-medium mb-1">Code 2FA</label>
                <input
                  id="code2fa"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/30 bg-gray-50"
                  value={code2FA}
                  onChange={e=>setCode2FA(e.target.value)}
                  placeholder="Code reçu"
                  title="Code 2FA"
                  autoComplete="one-time-code"
                />
              </div>
            )}
            <div className="flex items-center justify-between text-xs mt-2">
              <label className="flex items-center select-none cursor-pointer transition-all duration-200 gap-2">
                <span className="relative inline-flex items-center">
                  <input
                    type="checkbox"
                    className="peer appearance-none h-5 w-5 border border-gray-300 rounded-md focus:outline-none transition-all duration-200"
                    checked={remember}
                    onChange={e => {
                      const checked = e.target.checked;
                      setRemember(checked);
                      if (!checked && typeof window !== 'undefined') {
                        try {
                          localStorage.removeItem('iidmage_login_email');
                          localStorage.setItem('iidmage_login_remember', '0');
                        } catch {
                          // ignore
                        }
                      }
                    }}
                  />
                  <span className="absolute left-0 top-0 h-5 w-5 flex items-center justify-center pointer-events-none">
                    {remember && (
                      <svg className="w-5 h-5 text-gray-900 transition-opacity duration-200" viewBox="0 0 20 20" fill="none">
                        <path d="M6 10l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                </span>
                <span className="text-gray-700">Se souvenir de moi</span>
              </label>

              <button
                type="button"
                className="text-gray-700 hover:text-gray-900 hover:underline font-medium transition-all duration-200 inline-flex items-center gap-2"
                title="Mot de passe oublié ?"
                aria-label="Mot de passe oublié ?"
                onClick={() => {
                  setShowForgot(true);
                  setForgotName('');
                  setForgotEmail(email);
                  setForgotStatus('');
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 17h.01" />
                  <path d="M9.09 9a3 3 0 115.82 1c0 2-3 2-3 4" />
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">Mot de passe oublié ?</span>
              </button>
            </div>

            {/* Modal de récupération de mot de passe */}
            {showForgot && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm relative border border-transparent">
                  <button
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold focus:outline-none"
                    onClick={() => setShowForgot(false)}
                    aria-label="Fermer"
                    tabIndex={0}
                  >×</button>
                  <h2 className="text-lg font-bold mb-2 text-gray-900">Demander une réinitialisation</h2>
                  <form onSubmit={handleForgot} className="space-y-4">
                    <div>
                      <label htmlFor="forgot-name" className="block text-gray-700 text-sm mb-1">Nom</label>
                      <input
                        id="forgot-name"
                        ref={forgotInputRef}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/30 bg-gray-50"
                        value={forgotName}
                        onChange={e=>setForgotName(e.target.value)}
                        placeholder="Votre nom"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="forgot-email" className="block text-gray-700 text-sm mb-1">Adresse e-mail</label>
                      <input
                        id="forgot-email"
                        type="email"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/30 bg-gray-50"
                        value={forgotEmail}
                        onChange={e=>setForgotEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      Une notification sera envoyée au OWNER pour traiter votre demande.
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 px-4 rounded-lg shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:ring-offset-2 disabled:opacity-60 mt-2 text-base tracking-wide active:scale-95 bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
                      disabled={forgotStatus==='sending' || !forgotEmail || !forgotName}
                    >
                      {forgotStatus==='sending' ? 'Envoi en cours...' : 'Envoyer la demande'}
                    </button>
                    {forgotStatus==='sent' && <div className="text-green-700 text-sm mt-2">Demande envoyée au OWNER.</div>}
                    {forgotStatus==='error' && <div className="text-red-600 text-sm mt-2">Erreur lors de l’envoi. Réessayez plus tard.</div>}
                  </form>
                </div>
              </div>
            )}
            <button
              className="w-full py-2.5 px-4 rounded-lg shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-focus)] focus:ring-offset-2 disabled:opacity-60 mt-2 text-lg tracking-wide active:scale-95 bg-[color:var(--brand-btn-bg)] hover:bg-[color:var(--brand-btn-hover)] text-[color:var(--brand-btn-fg)] border border-[color:var(--brand-btn-border)]"
              disabled={loading || !email || !password}
              type="submit"
              tabIndex={0}
              title="Se connecter"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2 animate-pulse">
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeOpacity=".25" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" /></svg>
                  Connexion…
                </span>
              ) : 'Se connecter'}
            </button>
          </form>
          <div className="mt-8 text-xs text-gray-400 text-center select-none">
            Accès réservé au personnel autorisé
          </div>
          </div>
        </div>
      </div>

      {redirecting && (
        <div className="fixed inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center anim-overlay-in">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-[color:var(--brand-accent-border)] shadow-2xl">
            <span className="inline-flex h-2 w-2 rounded-full bg-[color:var(--brand-accent)]" aria-hidden />
            <svg className="w-5 h-5 animate-spin text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-9-9" /></svg>
            <div className="text-sm font-semibold text-gray-900">Ouverture du dashboard…</div>
          </div>
        </div>
      )}
      {/* Animaciones Tailwind personalizadas */}
      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 1s ease; }
        @keyframes fade-in-slow { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in-slow { animation: fade-in-slow 2s ease; }
        @keyframes fade-slide-in { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-slide-in { animation: fade-slide-in 1.1s cubic-bezier(.4,1,.6,1); }
        @keyframes slide-down { from { transform: translateY(-24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-down { animation: slide-down 0.7s cubic-bezier(.4,2,.6,1); }
        @keyframes shake { 10%, 90% { transform: translateX(-1px); } 20%, 80% { transform: translateX(2px); } 30%, 50%, 70% { transform: translateX(-4px); } 40%, 60% { transform: translateX(4px); } }
        .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }

      `}</style>
    </div>
  );
}
