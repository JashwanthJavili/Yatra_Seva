import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flashlight, FlashlightOff, QrCode, Sparkles, CheckCircle2, Search } from 'lucide-react';

export default function QRScanScreen() {
  const navigate = useNavigate();
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const handleSelectPass = (regId) => {
    navigate(`/registration/${regId}`);
  };

  const handleManualSubmit = (e) => {
    e?.preventDefault();
    if (!manualInput.trim()) return;
    navigate(`/registration/${manualInput.trim().toUpperCase()}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-stone-950 text-white select-none font-['Poppins',sans-serif]">
      
      {/* Top Header */}
      <header className="pt-4 px-6 flex items-center justify-between z-20 shrink-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="text-[16px] font-bold tracking-tight">QR Gate Scanner</h1>
          <p className="text-[12px] text-stone-400">Align code inside frame</p>
        </div>

        <button
          onClick={() => setFlashlightOn(!flashlightOn)}
          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
            flashlightOn
              ? 'bg-amber-400 text-stone-950 border-amber-300'
              : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
          }`}
          aria-label="Toggle flashlight"
        >
          {flashlightOn ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
        </button>
      </header>

      {/* Main Scanner Viewport Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center px-6 py-4 overflow-hidden">
        
        {/* Simulated Camera Dark Backdrop */}
        <div className="absolute inset-0 bg-stone-900 opacity-90"></div>

        {/* Viewfinder Reticle / Target Box */}
        <div className="relative w-64 sm:w-72 aspect-square rounded-3xl border-2 border-amber-400/80 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex items-center justify-center overflow-hidden bg-black/40 backdrop-blur-xs">
          
          {/* Corner Guides */}
          <div className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-xl"></div>
          <div className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-xl"></div>
          <div className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-xl"></div>
          <div className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-xl"></div>

          {/* Animated Scanning Laser Line */}
          <div className="absolute inset-x-4 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#F59E0B] animate-pulse"></div>

          {/* Center QR Watermark icon */}
          <QrCode className="w-24 h-24 text-white/20 stroke-1" />
        </div>

        <p className="relative z-10 mt-5 text-[12px] text-stone-300 text-center max-w-xs">
          Hold device steady over devotee pass QR code to scan automatically.
        </p>
      </div>

      {/* Bottom Sheet for Fast Test Selection & Manual Input */}
      <div className="relative z-20 bg-stone-900/95 backdrop-blur-lg border-t border-white/10 rounded-t-[32px] px-6 pt-5 pb-7 shrink-0 space-y-4">
        
        {/* Quick Simulation Trigger Buttons */}
        <div>
          <div className="text-[12px] font-semibold text-amber-300 uppercase tracking-wider mb-2">
            Simulate Scan (Tap to test):
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'YAT-00125', name: 'Gopal Das', status: 'Pending' },
              { id: 'YAT-00126', name: 'Radhika Dasi', status: 'Verified' },
              { id: 'YAT-00127', name: 'Sundar Govind', status: 'Pending' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectPass(item.id)}
                className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 border border-stone-700/80 text-left transition-all cursor-pointer"
              >
                <div className="font-mono text-[12px] font-bold text-amber-400">{item.id}</div>
                <div className="text-[12px] text-white truncate">{item.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Manual ID Input Fallback */}
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Or enter Pass ID manually..."
            className="flex-1 h-11 px-3.5 bg-stone-800 text-white placeholder:text-stone-500 rounded-xl border border-stone-700 text-[14px] font-mono uppercase outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            className="px-4 h-11 bg-amber-600 hover:bg-amber-500 text-white font-semibold text-[14px] rounded-xl transition-all cursor-pointer shrink-0"
          >
            Verify
          </button>
        </form>

      </div>

    </div>
  );
}
