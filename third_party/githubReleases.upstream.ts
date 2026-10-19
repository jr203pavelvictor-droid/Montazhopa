// GitHub releases API client used by the PR Extension panel to detect updates.
// Genius Installer Manager has its own copy of this logic (genius-installer-manager repo, src/api/github.ts).
// They are intentionally not shared — both must work standalone.

const REPO_OWNER = "georg-itgclaudeAgent";
const REPO_NAME = "pr-extension";
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

const EXTENSION_TAG_PREFIX = "extension-v";
const VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

export interface ReleaseInfo {
  version: string;          // e.g. "1.2.0" (no prefix)
  tag: string;              // e.g. "extension-v1.2.0"
  notes: string;            // GitHub release body (markdown)
  htmlUrl: string;          // human URL to the release page
  publishedAt: string;      // ISO 8601
}

interface RawRelease {
  tag_name: string;
  body: string | null;
  html_url: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
}

function parseSemver(v: string): [number, number, number] | null {
  const m = v.match(VERSION_REGEX);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * Compare two semver strings.
 * Returns 1 if a > b, -1 if a < b, 0 if equal or unparseable.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

/**
 * Fetch the latest non-draft, non-prerelease `extension-v*` release.
 * Returns null if no matching release exists or the request fails.
 */
export async function fetchLatestExtensionRelease(): Promise<ReleaseInfo | null> {
  try {
    const resp = await fetch(`${API_BASE}/releases?per_page=30`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!resp.ok) {
      console.warn(`GitHub releases fetch failed: ${resp.status}`);
      return null;
    }
    const releases: RawRelease[] = await resp.json();
    const candidates = releases
      .filter((r) => !r.draft && !r.prerelease && r.tag_name.startsWith(EXTENSION_TAG_PREFIX))
      .map((r) => {
        const version = r.tag_name.slice(EXTENSION_TAG_PREFIX.length);
        return {
          version,
          tag: r.tag_name,
          notes: r.body || "",
          htmlUrl: r.html_url,
          publishedAt: r.published_at,
        };
      })
      .filter((r) => parseSemver(r.version) !== null)
      .sort((a, b) => compareSemver(b.version, a.version));
    return candidates[0] || null;
  } catch (e) {
    console.warn("GitHub releases fetch error:", e);
    return null;
  }
}

/**
 * Read the installed version from the extension's manifest.xml.
 * Returns null if the manifest can't be loaded or parsed.
 */
export async function fetchInstalledVersion(): Promise<string | null> {
  try {
    const resp = await fetch("./CSXS/manifest.xml");
    if (!resp.ok) return null;
    const xml = await resp.text();
    const match = xml.match(/ExtensionBundleVersion="([^"]+)"/);
    return match ? match[1] : null;
  } catch (e) {
    console.warn("manifest.xml fetch error:", e);
    return null;
  }
}
