import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const TAGLINE = "L'ÉCOSYSTÈME ÉVÉNEMENTIEL DU SÉNÉGAL";
const DURATION = 2500;

export default function LoadingIntro({ onDone }: { onDone?: () => void }) {
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const step = (DURATION - 700) / TAGLINE.length;
    const typer = setInterval(() => setTyped((n) => Math.min(n + 1, TAGLINE.length)), step);
    const end = setTimeout(() => {
      onDone?.();
    }, DURATION);
    return () => { clearInterval(typer); clearTimeout(end); };
  }, [onDone]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0A0A0A] px-6"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.6 } }}
    >
      <div className="relative select-none font-[Montserrat] text-5xl font-black tracking-tight text-[#F5F5F5] sm:text-7xl">
        <motion.span
          aria-hidden
          className="absolute inset-0 text-[#8A2BE2]"
          animate={{ x: [0, -6, 5, -3, 0, 0], opacity: [0.9, 0.9, 0.9, 0.9, 0.9, 0] }}
          transition={{ duration: 1.1, times: [0, 0.15, 0.3, 0.5, 0.7, 1] }}
          style={{ clipPath: "inset(20% 0 40% 0)" }}
        >
          Thiès dn.
        </motion.span>
        <motion.span
          initial={{ opacity: 0, filter: "blur(8px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.9 }}
        >
          Thiès <span className="text-[#E9C349]">dn.</span>
        </motion.span>
      </div>

      <p className="mt-8 h-5 text-center font-[Inter] text-xs tracking-[0.3em] text-[#F5F5F5]/80 sm:text-sm">
        {TAGLINE.slice(0, typed)}
        <span className="ml-0.5 inline-block w-px animate-pulse bg-[#E9C349]">&nbsp;</span>
      </p>

      <div className="absolute bottom-10 h-px w-48 overflow-hidden bg-white/10 sm:w-72">
        <motion.div
          className="h-full bg-[#E9C349] will-change-transform"
          style={{ transformOrigin: "left" }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: DURATION / 1000, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}
