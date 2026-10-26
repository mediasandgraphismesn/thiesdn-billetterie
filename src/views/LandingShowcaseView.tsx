import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import {
  Ticket, ShieldCheck, Handshake, BarChart3, Printer, Badge, QrCode, WifiOff,
  Tag, Clock, Share2, Map, Wallet, Smartphone, CheckCircle2,
} from "lucide-react";
import ShaderBackground from "../components/ShaderBackground";
import LoadingIntro from "../components/LoadingIntro";
import FeatureCard from "../components/FeatureCard";
import TimelineStep from "../components/TimelineStep";

const SEEN_KEY = "thiesdn_intro_seen";

const fadeIn = {
  initial: { opacity: 0, y: 50 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7 },
};

function Typewriter({ text, className = "" }: { text: string; className?: string }) {
  return (
    <motion.h2
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      variants={{ show: { transition: { staggerChildren: 0.035 } } }}
      aria-label={text}
    >
      {text.split("").map((c, i) => (
        <motion.span key={i} aria-hidden variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>
          {c}
        </motion.span>
      ))}
    </motion.h2>
  );
}

const pillars = [
  { icon: Ticket, title: "Billetterie Digitale & Physique", text: "Vendez en ligne via Wave ou imprimez vos billets avec QR Codes sécurisés." },
  { icon: ShieldCheck, title: "Anti-Fraude & Scan Sécurisé", text: "Double scan bloqué, mode hors-ligne, photo du titulaire à l'entrée." },
  { icon: Handshake, title: "Transparence Co-Production", text: "Partagez les revenus avec vos artistes en temps réel." },
  { icon: BarChart3, title: "Dashboard Analytics", text: "Suivez vos ventes, scans et revenus en direct." },
];

const steps = [
  { title: "Création", text: "Créez votre événement en 5 minutes (affiche, tarifs, Wave)." },
  { title: "Validation CGV", text: "Signature électronique des conditions de vente." },
  { title: "Modération", text: "Notre équipe approuve votre événement sous 24h." },
  { title: "Vente", text: "Vos clients achètent en ligne ou en point de vente physique." },
  { title: "Contrôle", text: "Vos agents scannent les billets avec photo et nom." },
  { title: "Reversement", text: "Recevez 90% des recettes directement sur votre compte." },
];

const artistCards = [
  { icon: Wallet, title: "Ma Part en Direct", text: "Voyez combien vous rapportez à chaque billet vendu." },
  { icon: Smartphone, title: "Ma Guest List", text: "Gérez vos invitations VIP depuis votre téléphone." },
  { icon: CheckCircle2, title: "Validation du Décompte", text: "Signez numériquement le bilan de la soirée." },
];

const features = [
  { icon: Printer, title: "Billets Physiques", text: "Génération PDF 300 DPI avec QR Code + Code-barres." },
  { icon: Badge, title: "Accréditations", text: "Badges Staff, Presse et Invités VIP." },
  { icon: QrCode, title: "Multi-Postes Scan", text: "Créez plusieurs entrées avec des liens uniques." },
  { icon: WifiOff, title: "Mode Hors-Ligne", text: "Le scan continue même sans réseau." },
  { icon: Tag, title: "Codes Promo", text: "Boostez vos ventes avec des réductions flash." },
  { icon: Clock, title: "Compte à Rebours", text: "Créez l'urgence avant l'ouverture des ventes." },
  { icon: Share2, title: "Aperçu WhatsApp", text: "Vos liens affichent l'affiche automatiquement." },
  { icon: Map, title: "Carte Interactive", text: "Vos événements géolocalisés au Sénégal." },
];

export default function LandingShowcaseView() {
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(() => {
    try { return !sessionStorage.getItem(SEEN_KEY); } catch { return true; }
  });
  const finishIntro = useCallback(() => {
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* stockage indisponible */ }
    setShowIntro(false);
  }, []);

  const { scrollY } = useScroll();
  const shaderY = useTransform(scrollY, [0, 800], [0, 120]);

  const timelineRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: timelineRef, offset: ["start 0.7", "end 0.6"] });

  return (
    <main className="min-h-screen bg-[#0A0A0A] font-[Inter] text-[#F5F5F5]">
      <AnimatePresence>{showIntro && <LoadingIntro onDone={finishIntro} />}</AnimatePresence>

      {/* HERO */}
      <section className="relative flex min-h-screen items-center overflow-hidden px-6">
        <motion.div className="absolute inset-0 will-change-transform" style={{ y: shaderY }}>
          <ShaderBackground />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/40 via-transparent to-[#0A0A0A]" />
        <div className="relative z-10 mx-auto w-full max-w-6xl py-24">
          <h1 className="font-[Montserrat] text-5xl font-black leading-[0.95] sm:text-7xl lg:text-8xl">
            {[
              ["BILLETTERIE", "text-[#F5F5F5]"],
              ["ÉVÉNEMENTIELLE", "text-[#8A2BE2]"],
              ["PREMIUM", "text-[#E9C349]"],
            ].map(([w, c], i) => (
              <span key={w} className="block overflow-hidden">
                <motion.span
                  className={`block ${c}`}
                  initial={{ y: "110%" }}
                  animate={{ y: showIntro ? "110%" : 0 }}
                  transition={{ duration: 0.8, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] }}
                >
                  {w}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className="mt-8 max-w-xl text-lg text-[#F5F5F5]/80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: showIntro ? 0 : 1, y: showIntro ? 20 : 0 }}
            transition={{ delay: 0.7, duration: 0.7 }}
          >
            Vendez, gérez et contrôlez vos événements avec la plateforme la plus avancée du Sénégal.
          </motion.p>
          <motion.div
            className="mt-10 flex flex-col gap-4 sm:flex-row"
            initial={{ opacity: 0 }}
            animate={{ opacity: showIntro ? 0 : 1 }}
            transition={{ delay: 0.9 }}
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 0 40px #8A2BE2aa" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/register?role=promoteur")}
              className="rounded-full bg-[#8A2BE2] px-8 py-4 font-[Montserrat] font-bold text-white"
            >
              Je suis Promoteur
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 0 40px #E9C349aa" }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate("/register?role=artiste")}
              className="rounded-full bg-[#E9C349] px-8 py-4 font-[Montserrat] font-bold text-[#0A0A0A]"
            >
              Je suis Artiste
            </motion.button>
          </motion.div>
        </div>
      </section>

      {/* PILIERS */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <motion.h2 {...fadeIn} className="mb-12 font-[Montserrat] text-3xl font-black text-[#E9C349] sm:text-4xl">
          Quatre raisons de nous confier votre salle
        </motion.h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => <FeatureCard key={p.title} {...p} index={i} />)}
        </div>
      </section>

      {/* PARCOURS PROMOTEUR */}
      <section className="mx-auto max-w-5xl px-6 py-24">
        <Typewriter text="Votre Événement, de A à Z" className="mb-16 font-[Montserrat] text-3xl font-black text-[#F5F5F5] sm:text-5xl" />
        <div ref={timelineRef} className="relative">
          <div className="absolute bottom-0 left-[18px] top-0 w-px bg-white/10 md:left-1/2" />
          <motion.div
            className="absolute bottom-0 left-[18px] top-0 w-px bg-[#E9C349] shadow-[0_0_12px_#E9C349] will-change-transform md:left-1/2"
            style={{ scaleY: scrollYProgress, transformOrigin: "top" }}
          />
          <ol className="relative space-y-14">
            {steps.map((s, i) => <TimelineStep key={s.title} index={i} {...s} />)}
          </ol>
        </div>
      </section>

      {/* ARTISTE */}
      <section className="bg-[#121118] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.h2 {...fadeIn} className="max-w-3xl font-[Montserrat] text-3xl font-black text-[#8A2BE2] sm:text-5xl">
            Ne Soyez Plus Jamais Aveugle sur Vos Ventes
          </motion.h2>
          <motion.p {...fadeIn} className="mt-6 max-w-2xl text-lg text-[#F5F5F5]/75">
            En co-production ? Accédez aux chiffres réels, à votre part de recettes et à votre Guest List en temps réel.
          </motion.p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {artistCards.map((c, i) => <FeatureCard key={c.title} {...c} index={i} accent="gold" />)}
          </div>
        </div>
      </section>

      {/* FONCTIONNALITÉS */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <motion.h2 {...fadeIn} className="mb-12 font-[Montserrat] text-3xl font-black sm:text-4xl">
          Huit outils pour une soirée sans accroc
        </motion.h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => <FeatureCard key={f.title} {...f} index={i} compact />)}
        </div>
      </section>

      {/* CITATION */}
      <section className="bg-gradient-to-br from-[#8A2BE2] via-[#4b1a82] to-[#0A0A0A] px-6 py-28">
        <motion.blockquote {...fadeIn} className="mx-auto max-w-3xl text-center">
          <p className="font-[Montserrat] text-2xl font-bold leading-snug sm:text-4xl">
            Thièsdn Billetterie n'est pas un simple outil. C'est le partenaire de confiance des professionnels de l'événementiel au Sénégal.
          </p>
          <footer className="mt-8 text-[#E9C349]">— Mbaye Gueye, Fondateur &amp; Promoteur depuis 2009</footer>
        </motion.blockquote>
      </section>

      {/* CTA FINAL */}
      <section className="relative overflow-hidden px-6 py-32 text-center">
        <div className="absolute inset-0 opacity-70"><ShaderBackground /></div>
        <div className="relative z-10">
          <motion.h2 {...fadeIn} className="font-[Montserrat] text-3xl font-black text-[#E9C349] sm:text-5xl">
            Prêt à Passer au Niveau Supérieur ?
          </motion.h2>
          <motion.button
            animate={{ boxShadow: ["0 0 10px #8A2BE244", "0 0 45px #8A2BE2cc", "0 0 10px #8A2BE244"] }}
            transition={{ duration: 2, repeat: Infinity }}
            whileHover={{ scale: 1.05 }}
            onClick={() => navigate("/register?role=promoteur")}
            className="mt-10 rounded-full bg-[#8A2BE2] px-10 py-4 font-[Montserrat] font-bold text-white"
          >
            Créer Mon Compte Promoteur
          </motion.button>
          <p className="mt-6 text-[#F5F5F5]/70">Rejoignez les professionnels qui nous font confiance.</p>
        </div>
      </section>
    </main>
  );
}
