import clsx from "clsx";
import Image from "next/image";

type DeboLogoProps = {
  className?: string;
  markClassName?: string;
  imageClassName?: string;
  showText?: boolean;
};

export function DeboLogo({
  className,
  markClassName,
  imageClassName,
  showText = true,
}: DeboLogoProps) {
  const alt = showText ? "DEBO" : "";

  return (
    <span
      className={clsx("inline-flex items-center gap-2", className)}
      aria-label={showText ? "DEBO" : undefined}
    >
      <Image
        src={showText ? "/assets/debo-logo.svg" : "/assets/favicon.svg"}
        width={showText ? 245 : 32}
        height={showText ? 64 : 32}
        alt={alt}
        unoptimized
        className={clsx(
          showText ? "h-8 w-auto" : "h-8 w-8 rounded-lg",
          showText ? imageClassName : markClassName,
        )}
      />
    </span>
  );
}
