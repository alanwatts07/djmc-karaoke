import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getUpcomingEvents,
  formatEventDate,
  formatEventStart,
} from "@/lib/schedule";

// A live, always-current 1080×1080 (Instagram square) graphic of the upcoming
// shows — read straight from getUpcomingEvents(). Use it three ways:
//   • manual: open, save, post to IG with a caption
//   • third-party scheduler: point it at this URL
//   • Meta Graph API: pass this as the image_url when auto-posting
export const dynamic = "force-dynamic";

const DJ_NAME = process.env.NEXT_PUBLIC_DJ_NAME ?? "DJ MC";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "kara.ftrai.uk").replace(
  /^https?:\/\//,
  "",
);
const SIZE = { width: 1080, height: 1080 };

export async function GET() {
  const events = getUpcomingEvents(4);
  const logo = await readFile(join(process.cwd(), "public/djmc-logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(150deg, #2e0b52 0%, #86198f 55%, #0a0510 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: "72px 72px 60px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={132} height={132} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 26,
                letterSpacing: 8,
                textTransform: "uppercase",
                color: "#f0abfc",
                display: "flex",
              }}
            >
              Karaoke Night
            </div>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2, lineHeight: 1, display: "flex" }}>
              with <span style={{ color: "#e879f9", marginLeft: 16 }}>{DJ_NAME}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: 30,
            letterSpacing: 10,
            textTransform: "uppercase",
            color: "#f5b642",
            marginTop: 56,
            display: "flex",
          }}
        >
          Upcoming Shows
        </div>

        {/* Events */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 28, flex: 1 }}>
          {events.map((e, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 22,
                padding: "24px 30px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 46, fontWeight: 800, letterSpacing: -1 }}>
                  {formatEventDate(e.start)}
                </span>
                <span style={{ fontSize: 34, color: "#f5b642", fontWeight: 700 }}>
                  {formatEventStart(e.start)}–{e.endLabel}
                </span>
              </div>
              <span style={{ fontSize: 30, color: "#d8b4fe", marginTop: 6, display: "flex" }}>
                {e.venue} · {e.city}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: 2,
            color: "#f0abfc",
            marginTop: 20,
          }}
        >
          {SITE}
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: { "Cache-Control": "public, max-age=300" },
    },
  );
}
