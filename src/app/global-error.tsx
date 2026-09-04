"use client";

import { useEffect } from "react";

// Last-resort boundary for errors thrown by the root layout itself — must
// render its own <html>/<body> and avoid depending on app CSS/components.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 17, fontWeight: 600 }}>Something went wrong</p>
          <button
            onClick={reset}
            style={{ marginTop: 12, padding: "8px 20px", borderRadius: 999, background: "#0071e3", color: "#fff", border: "none", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
