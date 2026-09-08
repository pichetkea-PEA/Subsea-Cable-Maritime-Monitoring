import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Anchor, Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, AlertCircle, Radio } from 'lucide-react';
import { googleSignIn } from '../lib/firebase';

interface LoginPageProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setIsGoogleLoading(true);
    try {
      const result = await googleSignIn();
      if (result) {
        const { user } = result;
        const profile: UserProfile = {
          name: user.displayName || 'Pichet Kea',
          email: user.email || 'pichet.kea@gmail.com',
          role: user.email?.toLowerCase() === 'pichet.kea@gmail.com' ? 'admin' : 'operator',
          department: 'Subsea Maritime Operations & Protection',
          avatarUrl: user.photoURL || undefined,
        };
        onLoginSuccess(profile);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    setTimeout(() => {
      const trimmedUser = username.trim().toLowerCase();
      const trimmedPass = password.trim();

      // Verify credentials: pichet.kea@gmail.com / TigerWued*1992
      if (trimmedUser === 'pichet.kea@gmail.com' && trimmedPass === 'TigerWued*1992') {
        const adminUser: UserProfile = {
          name: 'Pichet Kea',
          email: 'pichet.kea@gmail.com',
          role: 'admin',
          department: 'Subsea Maritime Operations & Protection',
        };
        onLoginSuccess(adminUser);
      } else {
        setErrorMsg('Invalid username or password. Please verify your credentials.');
        setIsLoading(false);
      }
    }, 400);
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-cyan-600 selection:text-white">
      {/* Background nautical grid & atmospheric gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none" 
        style={{
          backgroundImage: `radial-gradient(#38bdf8 1px, transparent 1px)`,
          backgroundSize: '32px 32px'
        }} 
      />

      {/* Login Card */}
      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-md rounded-2xl shadow-2xl p-6 sm:p-8 z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 p-0.5 shadow-lg shadow-cyan-500/20 mb-3 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-cyan-400">
              <Anchor className="w-7 h-7" />
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            Subsea Cable Maritime Monitoring
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Secure Operations Portal</span>
          </p>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="mb-5 p-3 rounded-xl bg-rose-950/60 border border-rose-600/50 flex items-start gap-2.5 text-rose-200 text-xs animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username / Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="input-username">
              Username or Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="Enter your email"
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="input-password">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="input-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="btn-login-submit"
            type="submit"
            disabled={isLoading || isGoogleLoading}
            className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition duration-200 cursor-pointer disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to Maritime Portal</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-3 text-slate-500">Or continue with</span>
          </div>
        </div>

        {/* Google Sign-In Button */}
        <button
          id="btn-google-signin"
          type="button"
          disabled={isLoading || isGoogleLoading}
          onClick={handleGoogleLogin}
          className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2.5 transition duration-200 cursor-pointer disabled:opacity-60 shadow-md"
        >
          {isGoogleLoading ? (
            <div className="w-4 h-4 border-2 border-slate-400/30 border-t-slate-200 rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
          )}
          <span>Sign In with Google Account</span>
        </button>

        {/* Optional Open in New Tab Button */}
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={() => window.open(window.location.href, '_blank')}
            className="text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition cursor-pointer flex items-center justify-center gap-1 mx-auto"
          >
            <span>Open App in New Tab (Prevents Pop-up Blocks & PDF Export Restrictions)</span>
          </button>
        </div>


        {/* Security Footer Notice */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Encrypted Subsea Infrastructure Access</span>
        </div>
      </div>
    </div>
  );
};
