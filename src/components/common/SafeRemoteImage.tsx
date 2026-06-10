"use client";

/* eslint-disable @next/next/no-img-element */

import Image from "next/image";
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
  height?: number;
  quality?: number;
}

const isSafeImageSource = (src: string): boolean =>
  src.startsWith("/") || /^https?:\/\//i.test(src) || /^data:image\//i.test(src);

const isNativeImageSource = (src: string): boolean => /^data:image\//i.test(src);

export const SafeRemoteImage = ({
  src,
  alt,
  className,
  fill = false,
  priority = false,
  sizes,
  width = 1200,
  height = width,
  quality = 75,
}: SafeRemoteImageProps) => {
  const normalizedSrc = typeof src === "string" ? src.trim() : "";
  const safeSrc = useMemo(() => {
    if (!normalizedSrc || !isSafeImageSource(normalizedSrc)) {
      return "";
    }
    return normalizedSrc;
  }, [normalizedSrc]);
  const [failedSrc, setFailedSrc] = useState("");
  const hasError = Boolean(safeSrc && failedSrc === safeSrc);

  if (!safeSrc || hasError) {
    return null;
  }

  if (isNativeImageSource(safeSrc)) {
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
  }

  if (fill) {
    return (
      <Image
        src={safeSrc}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes ?? "100vw"}
        quality={quality}
        className={cn("absolute inset-0 h-full w-full", className)}
        onError={() => setFailedSrc(safeSrc)}
      />
    );
  }

  return (
    <Image
      src={safeSrc}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes={sizes}
      quality={quality}
      className={className}
      onError={() => setFailedSrc(safeSrc)}
    />
  );
};
