const variants = {
  flat: "border border-[var(--line)] bg-[var(--surface)]",
  elevated:
    "border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-lg)]",
  spotlight:
    "landing-spotlight border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)]",
};

export default function Card({ children, variant = "elevated", className = "", as: Tag = "article" }) {
  return (
    <Tag className={`rounded-[22px] transition duration-300 ${variants[variant] || variants.elevated} ${className}`.trim()}>
      {children}
    </Tag>
  );
}
