"use client";

import { useCallback } from "react";

function buildVenmoUrl(handle: string, singerName?: string): string {
  const note = singerName ? `Karaoke tip — ${singerName}` : "Karaoke tip";
  const params = new URLSearchParams({
    txn: "pay",
    audience: "public",
    recipients: handle,
    note,
  });
  return `https://venmo.com/?${params.toString()}`;
}

export default function TipButton({
  venmoHandle,
  singerName,
  readNameFromInput,
}: {
  venmoHandle: string;
  singerName?: string;
  // When true and singerName is unset, the click handler reads the value of
  // the page's <input name="stage_name"> and uses that in the memo. If the
  // input is empty, focuses it and stops the navigation.
  readNameFromInput?: boolean;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // If we already know the singer (server-side / cookie), just use that.
      if (singerName) return;

      if (readNameFromInput) {
        const input = document.querySelector<HTMLInputElement>(
          'input[name="stage_name"]',
        );
        const value = input?.value.trim() ?? "";
        if (!value) {
          e.preventDefault();
          input?.focus();
          input?.scrollIntoView({ behavior: "smooth", block: "center" });
          // Soft prompt via a temporary placeholder swap — friendlier than alert().
          if (input) {
            const original = input.placeholder;
            input.placeholder = "👋 add your name first so the DJ knows it's you";
            setTimeout(() => {
              input.placeholder = original;
            }, 4000);
          }
          return;
        }
        e.preventDefault();
        window.open(buildVenmoUrl(venmoHandle, value), "_blank", "noreferrer");
      }
    },
    [singerName, readNameFromInput, venmoHandle],
  );

  return (
    <div className="flex justify-center">
      <a
        href={buildVenmoUrl(venmoHandle, singerName)}
        onClick={handleClick}
        target="_blank"
        rel="noreferrer"
        style={{ backgroundColor: "#3D95CE" }}
        className="inline-flex items-center justify-center gap-2 rounded-full text-white font-semibold text-base px-8 py-3 shadow-lg shadow-black/30 hover:brightness-110 active:brightness-95 transition no-underline"
      >
        <span className="text-lg leading-none">💸</span>
        Tip the host on Venmo
      </a>
    </div>
  );
}
