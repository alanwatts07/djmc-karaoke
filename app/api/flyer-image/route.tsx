import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getFlyerStats } from "@/lib/flyer-stats";

// Venue-pitch flyer: "why book DJ MC karaoke", with live numbers pulled from
// the archived nights. Letter-size portrait (8.5×11 @ 150dpi) so it prints
// cleanly and still reads fine when texted/emailed to a bar owner.
export const dynamic = "force-dynamic";

const DJ_NAME = process.env.NEXT_PUBLIC_DJ_NAME ?? "DJ MC";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "kara.ftrai.uk").replace(
  /^https?:\/\//,
  "",
);
const INSTAGRAM = process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE;
// Booking phone — override with NEXT_PUBLIC_BOOKING_PHONE in Vercel.
const PHONE = process.env.NEXT_PUBLIC_BOOKING_PHONE ?? "(978) 801-1106";
const SIZE = { width: 1275, height: 1650 };

const PINK = "#f0abfc";
const GOLD = "#f5b642";

const PITCH: { icon: string; title: string; body: string }[] = [
  {
    icon: "🎤",
    title: "A crowd that follows the show",
    body: "Regulars who come back week after week and bring friends.",
  },
  {
    icon: "📱",
    title: "Scan, sign up, sing",
    body: "Guests join the list from a QR code. Their phone tells them when they're up. No paper slips, no crowding the DJ booth.",
  },
  {
    icon: "🔁",
    title: "Fair rotation keeps people staying",
    body: "Everyone gets their turn, so they hang around (and keep ordering) instead of leaving.",
  },
  {
    icon: "📣",
    title: "Promotion included",
    body: "Ready-to-post show graphics for your socials every week, plus a live schedule online.",
  },
  {
    icon: "🎃",
    title: "Theme nights & events",
    body: "Costume parties, birthdays, pop-ups. Something to talk about besides another Tuesday.",
  },
];

async function dataUri(relPath: string): Promise<string> {
  const buf = await readFile(join(process.cwd(), relPath));
  return `data:image/png;base64,${buf.toString("base64")}`;
}

export async function GET() {
  const [stats, logo] = await Promise.all([
    getFlyerStats(),
    dataUri("public/djmc-logo.png"),
  ]);

  const tiles: { value: string; label: string }[] = [
    { value: stats.performances.toLocaleString(), label: "songs sung" },
    { value: String(stats.uniqueSingers), label: "different singers" },
    { value: String(stats.regulars), label: "regulars (3+ nights)" },
    { value: String(stats.avgSignups), label: "avg sign-ups / night" },
    { value: String(stats.bestNight), label: "sign-ups, best night" },
    { value: `${stats.avgHours} hrs`, label: "of singing per night" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background:
            "radial-gradient(120% 70% at 50% 0%, #9d178f 0%, #46106e 40%, #0a0510 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: "60px 80px 50px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} width={170} height={170} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 28,
                letterSpacing: 10,
                textTransform: "uppercase",
                color: PINK,
              }}
            >
              Live karaoke for your bar
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 100,
                fontWeight: 900,
                letterSpacing: -3,
                lineHeight: 1,
              }}
            >
              {DJ_NAME} Karaoke
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 42,
            fontWeight: 700,
            color: GOLD,
            marginTop: 26,
            textAlign: "center",
          }}
        >
          Fill the room. Keep them singing. Bring them back.
        </div>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            fontSize: 24,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: PINK,
            marginTop: 36,
          }}
        >
          By the numbers · {stats.nights} nights tracked
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 22,
            marginTop: 18,
            width: "100%",
          }}
        >
          {tiles.map((t) => (
            <div
              key={t.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                width: 352,
                height: 150,
                flexShrink: 0,
                borderRadius: 26,
                background: "rgba(255,255,255,0.08)",
                border: "2px solid rgba(255,255,255,0.16)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 68,
                  fontWeight: 900,
                  lineHeight: 1,
                }}
              >
                {t.value}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  color: "#f5d0fe",
                  marginTop: 10,
                }}
              >
                {t.label}
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "#f5d0fe",
            marginTop: 16,
          }}
        >
          Proven every week at The Nerve, Haverhill · since {stats.since}
        </div>

        {/* Pitch */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 36,
            width: "100%",
          }}
        >
          {PITCH.map((p) => (
            <div key={p.title} style={{ display: "flex", gap: 24 }}>
              <div style={{ display: "flex", fontSize: 46, width: 60 }}>
                {p.icon}
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", flex: 1 }}
              >
                <div style={{ display: "flex", fontSize: 31, fontWeight: 800 }}>
                  {p.title}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 25,
                    color: "#e9d5ff",
                    lineHeight: 1.3,
                  }}
                >
                  {p.body}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Booking callout */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 34,
            width: "100%",
            padding: "26px 34px",
            borderRadius: 26,
            background: `${GOLD}22`,
            border: `3px solid ${GOLD}88`,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 40,
              fontWeight: 900,
              color: GOLD,
            }}
          >
            Got a slow night? Let&apos;s make it karaoke night.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "#fde68a",
              marginTop: 8,
            }}
          >
            Now booking weeknights, weekends and private events.
          </div>
        </div>

        {/* Footer / contact */}
        <div
          style={{
            display: "flex",
            gap: 40,
            marginTop: "auto",
            fontSize: 38,
            fontWeight: 800,
            color: PINK,
          }}
        >
          <div style={{ display: "flex" }}>Book: {SITE}</div>
          <div style={{ display: "flex" }}>Call/Text: {PHONE}</div>
          {INSTAGRAM && <div style={{ display: "flex" }}>@{INSTAGRAM}</div>}
        </div>
      </div>
    ),
    { ...SIZE, headers: { "Cache-Control": "public, max-age=600" } },
  );
}
