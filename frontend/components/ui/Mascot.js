import Image from "next/image";

export default function Mascot({ image, className = "", sizes = "200px" }) {
  if (!image?.src) return null;
  return (
    <div className={`relative ${className}`.trim()}>
      <Image
        src={image.src}
        alt={image.alt || ""}
        width={image.width || 320}
        height={image.height || 320}
        className="h-full w-full object-contain object-bottom drop-shadow-[0_12px_28px_rgba(0,179,65,0.28)]"
        sizes={sizes}
      />
    </div>
  );
}
