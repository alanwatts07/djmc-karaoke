import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getUpcomingEvents,
  formatEventDate,
  formatEventStart,
} from "@/lib/schedule";

// Next.js file convention: this becomes the og:image at /opengraph-image.
// Dynamic so each scrape renders the CURRENT upcoming shows (dates update
// themselves). 1200×630 landscape — the ratio Facebook/LinkedIn want.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Karaoke Night with DJ MC — upcoming shows";
export const dynamic = "force-dynamic";

const DJ_NAME = process.env.NEXT_PUBLIC_DJ_NAME ?? "DJ MC";

export default async function OpengraphImage() {
  const logoBuffer = await readFile(join(process.cwd(), "public/djmc-logo.png"));
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  const events = getUpcomingEvents(3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #2e0b52 0%, #86198f 55%, #0a0510 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: "48px 56px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoSrc}
            width={120}
            height={120}
            alt=""
            style={{ filter: "drop-shadow(0 8px 24px rgba(236,72,153,0.45))" }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 24,
                letterSpacing: 7,
                textTransform: "uppercase",
                color: "#f0abfc",
                display: "flex",
              }}
            >
              Karaoke Night
            </div>
            <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2, lineHeight: 1, display: "flex" }}>
              with <span style={{ color: "#e879f9", marginLeft: 16 }}>{DJ_NAME}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 24,
            letterSpacing: 9,
            textTransform: "uppercase",
            color: "#f5b642",
            margin: "28px 0 16px",
            display: "flex",
          }}
        >
          Upcoming Shows
        </div>

        {/* Event rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
          {events.map((e, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 16,
                padding: "16px 24px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, opacity: e.postponed ? 0.6 : 1 }}>
                  {formatEventDate(e.start)}
                  {e.postponed ? "  ·  POSTPONED" : ""}
                </span>
                <span style={{ fontSize: 24, color: "#d8b4fe", display: "flex" }}>
                  {e.venue} · {e.city}
                </span>
              </div>
              {!e.postponed && (
                <span style={{ fontSize: 28, color: "#f5b642", fontWeight: 700 }}>
                  {formatEventStart(e.start)}–{e.endLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
