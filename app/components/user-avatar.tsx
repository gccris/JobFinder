"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

export function UserAvatar({ image, name, className }: { image?: string | null; name?: string | null; className?: string }) {
  const [showImage, setShowImage] = useState(Boolean(image));

  useEffect(() => setShowImage(Boolean(image)), [image]);

  const initials = (name || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <span className={cn("grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary", className)}>
      {showImage && image ? (
        <Image src={image} alt={`Foto de ${name || "usuário"}`} width={40} height={40} unoptimized referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={() => setShowImage(false)} />
      ) : initials}
    </span>
  );
}
