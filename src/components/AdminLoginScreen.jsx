import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import yatraHeroImage from '../assets/HG Pranavanand Das Prabhuji_Yatra.jpg';

export default function AdminLoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuth();

  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setErrorMessage('');

    const result = await login(adminId, password);
    if (result.success) {
      // Navigate to attempted route or dashboard
      const targetPath = location.state?.from?.pathname || '/dashboard';
      navigate(targetPath, { replace: true });
    } else {
      setErrorMessage(result.error || 'Invalid admin credentials. Please try again.');
    }
  };

  return (
    <div className="relative w-full h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between select-none font-['Poppins',sans-serif]">
      
      {/* Full Screen Background Image - 100% Clarity, Zero Dimming */}
      <div className="fixed inset-0 w-full h-full z-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <img
          src={yatraHeroImage}
          alt="HG Pranavanand Das Prabhuji - Yatra Seva"
          className="w-full h-full object-cover origin-center"
          style={{
            objectPosition: 'center top',
            transform: 'translate(var(--hero-image-translate-x, 25px), var(--hero-image-translate-y, -70px)) scale(var(--hero-image-scale, 1.15))',
          }}
          onError={(e) => {
            e.currentTarget.src = '/image.png';
          }}
        />
      </div>

      {/* Top Navigation & Devotional Header - Identical h-16, padding, and h-9 badge alignment */}
      <header className="relative z-10 w-full h-16 pt-5 md:pt-6 px-6 md:px-12 flex items-center justify-between shrink-0">
        <button
          onClick={() => navigate('/welcome-page')}
          className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/30 shadow-lg flex items-center justify-center text-white hover:text-amber-300 hover:bg-black/70 active:scale-95 transition-all cursor-pointer shrink-0"
          aria-label="Return to Welcome screen"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* "YATRA SEVA" Badge - Exactly identical position and size as in WelcomeScreen */}
        <div className="inline-flex items-center px-4 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/30 text-white shadow-lg shrink-0">
          <span className="text-[12px] font-semibold text-amber-100 tracking-widest uppercase">
            YATRA SEVA
          </span>
        </div>
      </header>

      {/* Flexible Spacer */}
      <div className="relative z-10 flex-1 min-h-[40px] sm:min-h-[80px] pointer-events-none"></div>

      {/* Bottom Sheet Card Form - Instant Clean Presentation */}
      <div className="relative z-20 w-full rounded-t-[32px] md:rounded-t-[40px] rounded-b-none bg-white/95 backdrop-blur-xl border-t border-white/80 shadow-[0_-15px_50px_rgba(0,0,0,0.3)] px-6 md:px-10 pt-7 pb-8 md:pt-8 md:pb-10 flex flex-col shrink-0">
        {/* Centered Form Wrapper */}
        <div className="w-full max-w-xl mx-auto flex flex-col">
          
          {/* Header Titles */}
          <div className="mb-5 text-center">
            <h1 className="text-[24px] sm:text-[28px] font-medium text-stone-900 tracking-tight">
              Welcome Back
            </h1>
            <p className="mt-1 text-[14px] text-stone-600 font-medium">
              Sign in to the Seva Portal
            </p>
          </div>

          {/* Error Message Display */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[12px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          {/* Form - Strictly TWO Fields */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Field 1: Email / Admin ID */}
            <div>
              <label className="block text-[12px] font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                Email / Admin ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  value={adminId}
                  onChange={(e) => {
                    setAdminId(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="admin@yatra.demo"
                  className="w-full h-12 pl-10 pr-4 text-[14px] bg-stone-50 hover:bg-stone-50/80 focus:bg-white text-stone-900 placeholder:text-stone-400 rounded-2xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                  required
                />
              </div>
            </div>

            {/* Field 2: Password */}
            <div>
              <label className="block text-[12px] font-semibold text-stone-700 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="••••••••"
                  className="w-full h-12 pl-10 pr-11 text-[14px] bg-stone-50 hover:bg-stone-50/80 focus:bg-white text-stone-900 placeholder:text-stone-400 rounded-2xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-700 cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Primary Login Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-13 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-[0.985] text-white font-semibold text-[16px] rounded-2xl shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-70 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <span>Login</span>
                )}
              </button>
            </div>
          </form>

          {/* Authorized Admins & Volunteers Only Notice */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-stone-600 text-[12px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-stone-600 shrink-0" />
            <span>Authorized admins and volunteers only</span>
          </div>

        </div>

      </div>
    </div>
  );
}
