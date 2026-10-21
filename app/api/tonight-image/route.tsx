import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  getUpcomingEvents,
  formatEventDate,
  formatEventStart,
  KIND_META,
} from "@/lib/schedule";

// A bold, always-current hero graphic for TONIGHT'S show (or the next one up),
// built straight from getUpcomingEvents(). Meant to be posted to Instagram and
// reposted by the venue, so it leads with the bar's own logo.
//   • square  (1080×1080) — IG feed / FB  → default
//   • story   (1080×1920) — IG/FB stories → ?format=story
// This route is self-contained: it does NOT touch the home page or the existing
// /api/schedule-image graphic.
export const dynamic = "force-dynamic";

const DJ_NAME = process.env.NEXT_PUBLIC_DJ_NAME ?? "DJ MC";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "kara.ftrai.uk").replace(
  /^https?:\/\//,
  "",
);

// Which venue logo to stamp on the hero. Matched by substring so one-off venue
// spellings ("The Vault", "Vault 77 Lounge") still resolve.
function venueLogoFile(venue: string): string {
  const v = venue.toLowerCase();
  if (v.includes("nerve")) return "public/nerve-logo.png";
  return "public/vault-77-logo.png"; // Vault 77 / The Vault
}

async function dataUri(relPath: string): Promise<string> {
  const buf = await readFile(join(process.cwd(), relPath));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const story = searchParams.get("format") === "story";
  const SIZE = story
    ? { width: 1080, height: 1920 }
    : { width: 1080, height: 1080 };

  const event = getUpcomingEvents(1)[0];

  // No upcoming show on the books — render a graceful fallback card.
  if (!event) {
    const logo = await dataUri("public/djmc-logo.png");
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
            background:
              "radial-gradient(130% 90% at 50% 0%, #86198f 0%, #2e0b52 45%, #0a0510 100%)",
            color: "white",
            fontFamily: "sans-serif",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={200} height={200} alt="" />
          <div style={{ fontSize: 54, fontWeight: 800, display: "flex" }}>
            No show on the books
          </div>
          <div style={{ fontSize: 30, color: "#f0abfc", display: "flex" }}>
            {SITE}
          </div>
        </div>
      ),
      { ...SIZE, headers: { "Cache-Control": "public, max-age=120" } },
    );
  }

  const kind = KIND_META[event.kind];
  const postponed = !!event.postponed;
  const dateLabel = formatEventDate(event.start); // "Tonight" when it's today
  const isTonight = dateLabel === "Tonight";
  const headline = isTonight ? "TONIGHT" : dateLabel.toUpperCase();
  const POSTPONED_ACCENT = "#fbbf24";

  const venueLogo = await dataUri(venueLogoFile(event.venue));

  // Logo badge scales with canvas; story mode gets a bit more room.
  const badge = story ? 440 : 400;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(120% 80% at 50% 0%, #9d178f 0%, #46106e 42%, #0a0510 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: story ? "140px 90px" : "80px 80px",
          position: "relative",
        }}
      >
        {/* Accent glow bar behind the headline */}
        <div
          style={{
            position: "absolute",
            top: story ? 470 : 250,
            width: 760,
            height: 300,
            background: `${postponed ? POSTPONED_ACCENT : kind.accent}55`,
            filter: "blur(120px)",
            display: "flex",
          }}
        />

        {/* Eyebrow */}
        <div
          style={{
            display: "flex",
            fontSize: story ? 30 : 28,
            letterSpacing: 10,
            textTransform: "uppercase",
            color: "#f0abfc",
            marginBottom: story ? 36 : 24,
          }}
        >
          Karaoke Night · {DJ_NAME}
        </div>

        {/* Venue logo on a clean white badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: badge,
            height: badge,
            borderRadius: 999,
            background: "#000000",
            border: "6px solid rgba(255,255,255,0.18)",
            boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={venueLogo}
            width={badge - 90}
            height={badge - 90}
            alt=""
            style={{ objectFit: "contain" }}
          />
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            fontSize: headline.length > 8 ? (story ? 150 : 128) : story ? 210 : 180,
            fontWeight: 900,
            letterSpacing: -4,
            lineHeight: 1,
            marginTop: story ? 70 : 48,
            textShadow: `0 0 60px ${kind.accent}aa`,
          }}
        >
          {headline}
        </div>

        {/* Kind badge (or POSTPONED banner) */}
        <div
          style={{
            display: "flex",
            fontSize: story ? 34 : 30,
            fontWeight: 800,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: postponed ? POSTPONED_ACCENT : kind.accent,
            border: `3px solid ${postponed ? POSTPONED_ACCENT : kind.accent}88`,
            background: `${postponed ? POSTPONED_ACCENT : kind.accent}22`,
            borderRadius: 999,
            padding: "10px 30px",
            marginTop: story ? 40 : 28,
          }}
        >
          {postponed ? "Postponed" : kind.label}
        </div>

        {/* Optional special-event title */}
        {event.title && (
          <div
            style={{
              display: "flex",
              textAlign: "center",
              fontSize: story ? 48 : 42,
              fontWeight: 700,
              color: "#ffffff",
              marginTop: story ? 44 : 30,
              maxWidth: 860,
            }}
          >
            {event.title}
          </div>
        )}

        {/* Venue + city */}
        <div
          style={{
            display: "flex",
            fontSize: story ? 56 : 48,
            fontWeight: 700,
            color: "#f5d0fe",
            marginTop: story ? 40 : 26,
          }}
        >
          {event.venue} · {event.city}
        </div>

        {/* Time — or the postponement reason */}
        {postponed ? (
          <div
            style={{
              display: "flex",
              textAlign: "center",
              fontSize: story ? 44 : 38,
              fontWeight: 600,
              lineHeight: 1.3,
              color: "#fcd34d",
              marginTop: story ? 30 : 20,
              maxWidth: story ? 880 : 900,
            }}
          >
            {event.note}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              fontSize: story ? 72 : 60,
              fontWeight: 900,
              color: "#f5b642",
              marginTop: story ? 24 : 14,
            }}
          >
            {formatEventStart(event.start)}–{event.endLabel}
          </div>
        )}

        {/* Footer URL */}
        <div
          style={{
            display: "flex",
            fontSize: story ? 40 : 34,
            fontWeight: 700,
            letterSpacing: 2,
            color: "#f0abfc",
            marginTop: story ? 70 : 46,
          }}
        >
          {SITE}
        </div>
      </div>
    ),
    { ...SIZE, headers: { "Cache-Control": "public, max-age=120" } },
  );
}
