"use client";

import { useState } from "react";

const LONGEST_SIDE = 2000;

/**
 * A photo or PDF. A phone photo is several megabytes and school data is dear,
 * so photos are redrawn to at most 2000 pixels as JPEG before they leave the
 * phone — still sharp enough to read a receipt. A browser that cannot decode
 * the photo (HEIC outside Safari) sends it as it is.
 */
export function FileInput({ name, required }: { name: string; required?: boolean }) {
  const [note, setNote] = useState<string | null>(null);

  async function shrink(input: HTMLInputElement) {
    const file = input.files?.[0];
    setNote(null);
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
      if (!blob || blob.size >= file.size) return;
      const smaller = new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      const list = new DataTransfer();
      list.items.add(smaller);
      input.files = list.files;
      setNote(`Photo reduced to ${Math.round(blob.size / 1024)} KB for upload.`);
    } catch {
      // Sent as it is; the server refuses it only if it is over the limit.
    }
  }

  return (
    <>
      <input
        type="file" name={name} required={required}
        accept="image/*,application/pdf"
        onChange={(e) => shrink(e.currentTarget)}
      />
      {note && <span className="note">{note}</span>}
    </>
  );
}
