"use client";

/**
 * 이미지가 없어도 레이아웃이 흔들리지 않는 이미지 슬롯.
 * 폴백을 먼저 깔고, <img> 가 실제로 로드되면 300ms 페이드로 그 위를 덮는다 (onError 면 폴백 유지).
 * public/idol 이 비어 있어도 게임이 완전히 동작해야 한다는 요구를 만족한다.
 * 래퍼는 <span>(display:block) 이라 버튼·문단 안에 넣어도 마크업이 유효하다.
 */

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

export function GameImage({
  src,
  alt,
  fallback,
  className = "",
  objectFit = "cover",
  objectPosition = "center",
}: {
  src: string;
  alt: string;
  fallback: ReactNode;
  className?: string;
  objectFit?: "cover" | "contain";
  objectPosition?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      <span className="absolute inset-0 block">{fallback}</span>
      {failed ? null : (
        // eslint-disable-next-line @next/next/no-img-element -- 사용자가 나중에 채우는 정적 에셋. 존재 여부를 빌드 시점에 검사하지 않는다.
        <img
          src={src}
          alt={alt}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full transition-opacity duration-300"
          style={{ objectFit, objectPosition, opacity: loaded ? 1 : 0 }}
        />
      )}
    </span>
  );
}
