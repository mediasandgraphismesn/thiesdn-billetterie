import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";

type Props = {
  icon: LucideIcon;
  title: string;
  text: string;
  index?: number;
  accent?: "violet" | "gold";
  compact?: boolean;
};

export default function FeatureCard({ icon: Icon, title, text, index = 0, accent = "violet", compact }: Props) {
  const color = accent === "gold" ? "#E9C349" : "#8A2BE2";
  return (
    <motion.article
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      whileHover={{ scale: compact ? 1.05 : 1.03, y: -5, boxShadow: `0 12px 40px ${color}55` }}
      className="rounded-2xl border border-white/10 bg-[#121118]/70 p-6 backdrop-blur-xl will-change-transform"
    >
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: `${color}22`, boxShadow: `0 0 24px ${color}44` }}
      >
        <Icon size={24} color={color} />
      </div>
      <h3 className="font-[Montserrat] text-lg font-bold text-[#F5F5F5]">{title}</h3>
      <p className="mt-2 font-[Inter] text-sm leading-relaxed text-[#F5F5F5]/70">{text}</p>
    </motion.article>
  );
}
