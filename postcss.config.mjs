// Kerdion styles are plain CSS (src/app/globals.css), so no PostCSS plugins are needed.
// This file must exist all the same: without it Next.js searches parent folders for a
// PostCSS config and would use whatever it finds outside the project, which breaks the build.
/** @type {import('postcss-load-config').Config} */
const config = { plugins: {} };

export default config;
