import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import yatraHeroImage from '../assets/HG Pranavanand Das Prabhuji_Yatra.jpg';

export default function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="relative w-full h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-between select-none font-['Poppins',sans-serif]">
      
      {/* =========================================================================
          FULL SCREEN HERO BACKGROUND IMAGE - 100% ORIGINAL CLARITY (ZERO DIMMING)
          Vertical position is controlled by the CSS variable `--hero-image-position-y`
          defined in `src/index.css` (Line 13).
          ========================================================================= */}
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

      {/* Top Devotional Header Bar - Fixed identical height & padding to match Login screen */}
      <header className="relative z-10 w-full h-16 pt-5 md:pt-6 px-6 md:px-12 flex items-center justify-between shrink-0">
        {/* "Hare Krishna" - Poppins 12px, clean, h-9 */}
        <div className="inline-flex items-center px-4 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/30 text-white shadow-lg">
          <span className="text-[12px] font-semibold text-amber-100 tracking-wider">
            HARE KRISHNA
          </span>
        </div>

        {/* "YATRA SEVA" - Poppins 12px, h-9 - exact pixel match with Login */}
        <div className="inline-flex items-center px-4 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/30 text-white shadow-lg">
          <span className="text-[12px] font-semibold text-amber-100 tracking-widest uppercase">
            YATRA SEVA
          </span>
        </div>
      </header>

      {/* Flexible Spacer for Visual Focus on Prabhuji & Deities */}
      <div className="relative z-10 flex-1 min-h-0 pointer-events-none"></div>

      {/* =========================================================================
          BOTTOM SHEET - CLEAN DIRECT NAVIGATION (NO ARTIFICIAL DELAY/ANIMATION)
          - Fixed strictly to bottom with 0 gap and 100% full width.
          - "A humble offering in the service of the devotees." in 12px.
          - "Verification Seva" in font-medium.
          - Clean 2-line break for Sri Guru and Gauranga description.
          - Exact matching ShieldCheck icon & text notice as Login screen.
          ========================================================================= */}
      <div className="relative z-20 w-full rounded-t-[32px] md:rounded-t-[40px] rounded-b-none bg-white/95 backdrop-blur-xl border-t border-white/80 shadow-[0_-15px_50px_rgba(0,0,0,0.3)] px-6 sm:px-8 md:px-12 pt-7 pb-8 md:pt-8 md:pb-10 flex flex-col shrink-0">
        
        {/* Centered Content Container */}
        <div className="w-full max-w-lg mx-auto flex flex-col items-center text-center">
          
          {/* 1. Humble Inscription - Poppins 12px */}
          <p className="text-[12px] font-medium text-amber-900/80 italic tracking-wide mb-2">
            &ldquo;A humble offering in the service of the devotees.&rdquo;
          </p>

          {/* 2. Main Title - Poppins 22px / 26px with font-medium */}
          <h1 className="text-[24px] sm:text-[24px] md:text-[26px] font-semibold text-stone-900 tracking-tight leading-tight mb-4">
            Yatra Seva &amp; Verification Portal
          </h1>

          {/* 3. Supporting Description Card with clean 2-line break */}
          <div className="w-full bg-[#FAF7F2] rounded-2xl py-3.5 px-4 sm:px-6 border border-amber-200/60 shadow-2xs mb-5">
            <p className="text-[14px] text-stone-700 leading-relaxed font-normal">
              <span className="block">By the mercy of Sri Guru and Gauranga,</span>
              <span className="block">we are preparing this system to assist in the service of the Yatra.</span>
            </p>
          </div>

          {/* 4. Primary Action Button */}
          <button
            onClick={() => navigate('/login-page')}
            className="w-full h-14 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 active:scale-[0.985] text-white font-semibold text-[16px] rounded-2xl shadow-lg shadow-amber-900/25 flex items-center justify-center gap-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 cursor-pointer mb-3"
          >
            <span>Continue to Seva</span>
            <ArrowRight className="w-5 h-5 animate-arrow-nudge" />
          </button>

          {/* 5. Authorized Notice - Exactly identical to AdminLoginScreen */}
          <div className="flex items-center justify-center gap-1.5 text-stone-600 text-[12px] font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-stone-600 shrink-0" />
            <span>Authorized admins and volunteers only</span>
          </div>

        </div>

      </div>

    </div>
  );
}
