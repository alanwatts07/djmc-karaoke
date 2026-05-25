import { ImageResponse } from "next/og";

// Next.js file convention: this overrides the openGraph.images in metadata
// and is automatically wired into the og:image tag at /opengraph-image.
// LinkedIn (and most platforms) want at least 1200×627 in landscape ratio
// — our /public/preview.png was 811×882, which LinkedIn silently refused.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Karaoke Night with DJ MC";

const DJ_NAME = process.env.NEXT_PUBLIC_DJ_NAME ?? "DJ MC";

export default async function OpengraphImage() {
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
            "linear-gradient(180deg, #581c87 0%, #86198f 50%, #000000 100%)",
          color: "white",
          fontFamily: "sans-serif",
          textAlign: "center",
          padding: "60px",
        }}
      >
        <div
          style={{
            fontSize: 28,
            opacity: 0.75,
            letterSpacing: 10,
            textTransform: "uppercase",
            color: "#f0abfc",
            display: "flex",
          }}
        >
          Karaoke Night
        </div>
        <div
          style={{
            fontSize: 130,
            fontWeight: 800,
            letterSpacing: -3,
            lineHeight: 1.05,
            marginTop: 24,
            display: "flex",
            gap: 24,
          }}
        >
          <span>with</span>
          <span style={{ color: "#e879f9" }}>{DJ_NAME}</span>
        </div>
        <div
          style={{
            fontSize: 36,
            opacity: 0.7,
            marginTop: 40,
            letterSpacing: 4,
            display: "flex",
            gap: 24,
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
    ),
    { ...size },
  );
}
