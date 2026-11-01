# Security

Markdown and includes are untrusted content. The editor does not execute raw HTML,
load remote scripts, make telemetry requests or authenticate to cloud services.
Webviews restrict script execution with a nonce-based CSP and block network connections.
Imports must resolve to local `.md` files within an allowed workspace root,
including after symlink resolution. No shell commands are constructed from Markdown.

Do not post private documents or credentials in public reports. If a repository
is published, use its private vulnerability reporting channel for security issues.

The extension is a local development release. Re-run dependency audits before
publication; development/build dependencies are not bundled into the VSIX.
