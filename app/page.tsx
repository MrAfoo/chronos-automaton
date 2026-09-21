"use client";

import dynamic from "next/dynamic";

// Dynamically import the WebGL Canvas client component with SSR disabled
const MechanicalButterfly = dynamic(
  () => import("@/components/MechanicalButterfly"),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#04060a] text-white">
        <div className="relative flex items-center justify-center">
          {/* Outer rotating clockwork ring */}
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-amber-400/40 animate-spin" />
          {/* Inner pulsating core */}
          <div className="absolute w-8 h-8 rounded-full border border-teal-400/60 animate-ping" />
          <div className="absolute w-3 h-3 rounded-full bg-amber-400" />
        </div>
        <p className="mt-6 text-xs font-mono tracking-widest text-amber-300/80 uppercase">
          Assembling Escapement Mechanism...
        </p>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#04060a]">
      <MechanicalButterfly />
    </main>
  );
}
