# Security

Markdown and includes are untrusted content. Scripts, event-handler attributes, styles
and dangerous URL schemes are removed from raw HTML using a conservative allowlist.
The editor does not load remote scripts, make telemetry requests or authenticate to
cloud services. Webviews restrict script execution with a nonce-based CSP; remote images
load only from `http`/`https` image URLs, and PDF export downloads those images so the
result can be self-contained. Imports must resolve to local `.md` files within an
allowed workspace root, including after symlink resolution. No shell commands are
constructed from Markdown.

Do not post private documents or credentials in public reports. If a repository
is published, use its private vulnerability reporting channel for security issues.

The extension is a local development release. Re-run dependency audits before
publication; development/build dependencies are not bundled into the VSIX.
