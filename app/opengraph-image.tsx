import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Next.js file convention: this overrides the openGraph.images in metadata
// and is automatically wired into the og:image tag at /opengraph-image.
// LinkedIn (and most platforms) want at least 1200×627 in landscape ratio.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Karaoke Night with DJ MC";

const DJ_NAME = process.env.NEXT_PUBLIC_DJ_NAME ?? "DJ MC";

export default async function OpengraphImage() {
  // Inline the logo as a base64 data URL. Satori can't fetch http(s) URLs
  // reliably at build time, but it handles data URLs fine.
  const logoBuffer = await readFile(
    join(process.cwd(), "public/djmc-logo.png"),
  );
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #581c87 0%, #86198f 60%, #000000 100%)",
          color: "white",
          fontFamily: "sans-serif",
          padding: "60px 80px",
          gap: "60px",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          width={420}
          height={420}
          alt=""
          style={{
            filter: "drop-shadow(0 12px 32px rgba(236, 72, 153, 0.45))",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 26,
              opacity: 0.75,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "#f0abfc",
              display: "flex",
            }}
          >
            Karaoke Night
          </div>
          <div
            style={{
              fontSize: 110,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1,
              marginTop: 18,
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            <span>with</span>
            <span style={{ color: "#e879f9" }}>{DJ_NAME}</span>
          </div>
          <div
            style={{
              fontSize: 30,
              opacity: 0.7,
              marginTop: 32,
              letterSpacing: 3,
              display: "flex",
              gap: 20,
              alignItems: "center",
            }}
          >
            <span>Scan</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Sign up</span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span>Sing</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
