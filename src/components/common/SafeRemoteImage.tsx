"use client";

/* eslint-disable @next/next/no-img-element */

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

interface SafeRemoteImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  width?: number;
  quality?: number;
}

const isSafeImageSource = (src: string): boolean =>
  src.startsWith("/") || /^https?:\/\//i.test(src) || /^data:image\//i.test(src);

const buildProxiedImageSource = (src: string, width: number, quality: number): string => {
  if (!/^https?:\/\//i.test(src)) {
    return src;
  }

  return `/_next/image?url=${encodeURIComponent(src)}&w=${encodeURIComponent(
    String(width),
  )}&q=${encodeURIComponent(String(quality))}`;
};

export const SafeRemoteImage = ({
  src,
  alt,
  className,
  fill = false,
  priority = false,
  sizes,
  width = 1200,
  quality = 75,
}: SafeRemoteImageProps) => {
  const normalizedSrc = typeof src === "string" ? src.trim() : "";
  const safeSrc = useMemo(() => {
    if (!normalizedSrc || !isSafeImageSource(normalizedSrc)) {
      return "";
    }
    return buildProxiedImageSource(normalizedSrc, width, quality);
  }, [normalizedSrc, quality, width]);
  const [failedSrc, setFailedSrc] = useState("");
  const hasError = Boolean(safeSrc && failedSrc === safeSrc);

  if (!safeSrc || hasError) {
    return null;
  }

  return (
    <img
      src={safeSrc}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      sizes={sizes}
      className={cn(fill ? "absolute inset-0 h-full w-full" : "", className)}
      onError={() => setFailedSrc(safeSrc)}
    />
  );
};
