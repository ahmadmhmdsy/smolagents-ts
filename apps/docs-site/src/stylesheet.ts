/** The one stylesheet the site writes to `assets/site.css`. Modest on purpose: a reader. */
export const SITE_CSS = `:root {
  --bg: #ffffff;
  --fg: #1f2328;
  --muted: #59636e;
  --border: #d1d9e0;
  --accent: #0969da;
  --code-bg: #f6f8fa;
  --sidebar-bg: #f6f8fa;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  border-right: 1px solid var(--border);
  background: var(--sidebar-bg);
  padding: 1.25rem 1rem;
  position: sticky;
  top: 0;
  align-self: start;
  max-height: 100vh;
  overflow-y: auto;
  font-size: 0.9rem;
}

.site-title {
  display: block;
  font-weight: 700;
  font-size: 1rem;
  margin-bottom: 1rem;
  color: var(--fg);
  text-decoration: none;
}

.nav-group {
  margin: 1rem 0 0.35rem;
  color: var(--muted);
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
}

.nav-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-list li {
  margin: 0.15rem 0;
}

.nav-list a {
  color: var(--fg);
  text-decoration: none;
}

.nav-list a:hover {
  color: var(--accent);
  text-decoration: underline;
}

.nav-list a[aria-current="page"] {
  color: var(--accent);
  font-weight: 600;
}

.content {
  max-width: 52rem;
  padding: 2rem 2.5rem 4rem;
}

.content > :first-child {
  margin-top: 0;
}

a {
  color: var(--accent);
}

h1,
h2,
h3,
h4 {
  line-height: 1.25;
  margin: 1.6em 0 0.6em;
}

h1 {
  font-size: 1.9rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.3rem;
}

h2 {
  font-size: 1.4rem;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.25rem;
}

code {
  background: var(--code-bg);
  padding: 0.15em 0.35em;
  border-radius: 4px;
  font-size: 0.9em;
}

pre {
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1rem;
  overflow-x: auto;
}

pre code {
  background: none;
  padding: 0;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
  display: block;
  overflow-x: auto;
}

th,
td {
  border: 1px solid var(--border);
  padding: 0.4rem 0.6rem;
  text-align: left;
  vertical-align: top;
}

th {
  background: var(--code-bg);
}

blockquote {
  margin: 1rem 0;
  padding: 0 1rem;
  color: var(--muted);
  border-left: 4px solid var(--border);
}

img {
  max-width: 100%;
}

hr {
  border: 0;
  border-top: 1px solid var(--border);
}

@media (max-width: 800px) {
  body {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: static;
    max-height: none;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .content {
    padding: 1.5rem;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0d1117;
    --fg: #e6edf3;
    --muted: #9198a1;
    --border: #3d444d;
    --accent: #4493f8;
    --code-bg: #151b23;
    --sidebar-bg: #010409;
  }
}
`;
