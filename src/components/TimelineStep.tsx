import { motion } from "framer-motion";

type Props = { index: number; title: string; text: string };

export default function TimelineStep({ index, title, text }: Props) {
  const left = index % 2 === 0;
  return (
    <motion.li
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className={`relative pl-14 md:w-1/2 md:pl-0 ${left ? "md:pr-14 md:text-right" : "md:ml-auto md:pl-14"}`}
    >
      <span
        className={`absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-[#E9C349] bg-[#0A0A0A] font-[Montserrat] text-sm font-bold text-[#E9C349] shadow-[0_0_20px_#E9C34966] md:left-auto ${
          left ? "md:-right-[18px]" : "md:-left-[18px]"
        }`}
      >
        {index + 1}
      </span>
      <h3 className="font-[Montserrat] text-xl font-bold text-[#E9C349]">{title}</h3>
      <p className="mt-1 font-[Inter] text-[#F5F5F5]/75">{text}</p>
    </motion.li>
  );
}
