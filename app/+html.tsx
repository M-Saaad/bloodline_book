import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#a52f1a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Bloodline Book" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: webRootStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const webRootStyles = `
html,
body,
#root {
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
}
body {
  overflow: hidden;
  background-color: #f6f2ee;
}
#root {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
input,
textarea,
select {
  font-size: 16px;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #111827;
  }
}`;
