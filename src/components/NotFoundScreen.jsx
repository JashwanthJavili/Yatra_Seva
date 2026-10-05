import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';

export default function NotFoundScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#FAF7F2] to-[#F3ECE0] px-6 text-center text-stone-800 select-none font-['Poppins',sans-serif]">
      
      <div className="w-16 h-16 rounded-3xl bg-amber-100/80 border border-amber-300 flex items-center justify-center text-amber-700 shadow-xs mb-4">
        <Compass className="w-8 h-8 text-amber-700 animate-spin" style={{ animationDuration: '12s' }} />
      </div>

      <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100/70 text-amber-900 text-[12px] font-bold tracking-wider mb-2 uppercase">
        Page Not Found (404)
      </div>

      <h1 className="text-[24px] sm:text-[28px] font-bold text-stone-900 tracking-tight">
        Seva Route Not Found
      </h1>

      <p className="mt-2 text-[14px] text-stone-600 max-w-xs leading-relaxed">
        The requested address does not exist or has been moved.
      </p>

      <button
        onClick={() => navigate('/welcome-page')}
        className="mt-6 px-6 h-13 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-[14px] rounded-2xl shadow-lg shadow-amber-900/25 flex items-center gap-2 transition-all cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Welcome Page</span>
      </button>

    </div>
  );
}
