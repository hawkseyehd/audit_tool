import { createHash } from "node:crypto";
import { auditFindingSchema } from "../../core/schemas.js";
import type { AuditFinding, FindingCategory, FindingSeverity } from "../../core/types.js";
import type { AuditScanner, ScannerContext } from "../types.js";
import type { SecurityPageSnapshot, SecurityScanInput } from "./types.js";

interface Details {
  ruleId: string;
  url: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  metric: string;
  value: string | number;
  expected: string | number;
}
export function createSecurityScanner(): AuditScanner<SecurityScanInput> {
  return {
    name: "security",
    scan: (input, context) => Promise.resolve(scanSecurity(input, context)),
  };
}
export function scanSecurity(input: SecurityScanInput, context: ScannerContext): AuditFinding[] {
  return [...input.pages]
    .sort((a, b) => a.url.localeCompare(b.url))
    .flatMap((page) => scanPage(page, context));
}

function scanPage(page: SecurityPageSnapshot, context: ScannerContext): AuditFinding[] {
  const findings: AuditFinding[] = [];
  if (!page.isHttps)
    findings.push(
      finding(context, {
        ruleId: "https-missing",
        url: page.url,
        category: "security",
        severity: "high",
        title: "Page is not served over HTTPS",
        description: "The observed final page URL uses HTTP.",
        impact:
          "Traffic can be intercepted or altered, undermining visitor trust and confidentiality.",
        recommendation:
          "Serve the site over HTTPS and redirect public HTTP requests to the canonical HTTPS origin.",
        metric: "final protocol",
        value: "http",
        expected: "https",
      }),
    );
  if (page.httpRedirectsToHttps === false)
    findings.push(
      finding(context, {
        ruleId: "http-redirect-missing",
        url: page.url,
        category: "security",
        severity: "high",
        title: "HTTP did not redirect to HTTPS",
        description: "The optional HTTP probe did not reach an HTTPS URL.",
        impact: "Visitors using an HTTP link may remain on an unencrypted connection.",
        recommendation: "Configure a permanent, in-scope redirect from HTTP to HTTPS.",
        metric: "HTTP upgrade",
        value: "not observed",
        expected: "HTTPS redirect",
      }),
    );
  if (page.mixedContentCount > 0)
    findings.push(
      finding(context, {
        ruleId: "mixed-content",
        url: page.url,
        category: "security",
        severity: "high",
        title: "HTTPS page references insecure resources",
        description: `${String(page.mixedContentCount)} absolute HTTP resource references were detected.`,
        impact:
          "Browsers may block content or expose resources to interception, causing broken experiences and weaker security.",
        recommendation: "Load every page resource over HTTPS or remove the reference.",
        metric: "mixed-content references",
        value: page.mixedContentCount,
        expected: 0,
      }),
    );
  const headerRules = [
    ["strict-transport-security", "hsts-missing", "Strict-Transport-Security is missing", "medium"],
    ["content-security-policy", "csp-missing", "Content-Security-Policy is missing", "medium"],
    [
      "x-content-type-options",
      "content-type-options-missing",
      "X-Content-Type-Options is missing",
      "low",
    ],
    ["referrer-policy", "referrer-policy-missing", "Referrer-Policy is missing", "low"],
    ["permissions-policy", "permissions-policy-missing", "Permissions-Policy is missing", "low"],
  ] as const;
  for (const [header, ruleId, title, severity] of headerRules)
    if (page.headers[header] === undefined)
      findings.push(
        finding(context, {
          ruleId,
          url: page.url,
          category: "security",
          severity,
          title,
          description: `The ${header} response header was not observed.`,
          impact:
            "The browser receives less explicit protection and information-exposure guidance.",
          recommendation: `Define and test an appropriate ${header} policy for the application.`,
          metric: "response header",
          value: "missing",
          expected: header,
        }),
      );
  const csp = page.headers["content-security-policy"]?.toLowerCase() ?? "";
  if (page.headers["x-frame-options"] === undefined && !/\bframe-ancestors\b/u.test(csp))
    findings.push(
      finding(context, {
        ruleId: "frame-protection-missing",
        url: page.url,
        category: "security",
        severity: "medium",
        title: "Frame embedding protection is missing",
        description: "Neither X-Frame-Options nor a CSP frame-ancestors directive was observed.",
        impact: "The page may be embeddable by another site, increasing clickjacking risk.",
        recommendation:
          "Set CSP frame-ancestors or X-Frame-Options according to legitimate embedding needs.",
        metric: "frame protection",
        value: "missing",
        expected: "frame-ancestors or X-Frame-Options",
      }),
    );
  for (const cookie of page.cookies) {
    if (!cookie.secure)
      findings.push(
        cookieFinding(
          context,
          page.url,
          cookie.name,
          "cookie-secure-missing",
          "Cookie lacks the Secure flag",
          "Secure",
        ),
      );
    if (!cookie.httpOnly)
      findings.push(
        cookieFinding(
          context,
          page.url,
          cookie.name,
          "cookie-httponly-missing",
          "Cookie lacks the HttpOnly flag",
          "HttpOnly",
        ),
      );
    if (cookie.sameSite === undefined)
      findings.push(
        cookieFinding(
          context,
          page.url,
          cookie.name,
          "cookie-samesite-missing",
          "Cookie lacks an explicit SameSite attribute",
          "SameSite",
        ),
      );
  }
  if (!page.hasPrivacyPolicyLink)
    findings.push(
      finding(context, {
        ruleId: "privacy-policy-not-detected",
        url: page.url,
        category: "privacy",
        severity: "medium",
        title: "Privacy policy link was not detected",
        description:
          "No link with a privacy-oriented destination was found in the static page markup.",
        impact: "Visitors may have difficulty understanding how personal data is handled.",
        recommendation:
          "Provide a clearly named, accessible privacy-policy link and have its content reviewed by qualified counsel.",
        metric: "privacy-policy link",
        value: "not detected",
        expected: "Visible policy link",
      }),
    );
  if (page.cookies.length > 0 && !page.hasCookieConsentSignal)
    findings.push(
      finding(context, {
        ruleId: "cookie-consent-not-detected",
        url: page.url,
        category: "privacy",
        severity: "info",
        title: "Cookie consent interface was not detected",
        description:
          "Cookies were observed, but common static consent-interface signals were not. Consent may be loaded dynamically or may not be required for every cookie.",
        impact: "Visitor controls may be unclear where optional tracking cookies are used.",
        recommendation:
          "Review cookie purpose and regional requirements, then verify any required consent controls manually.",
        metric: "consent signal",
        value: "not detected",
        expected: "Manual applicability review",
      }),
    );
  return findings;
}

function cookieFinding(
  context: ScannerContext,
  url: string,
  cookieName: string,
  ruleId: string,
  title: string,
  expected: string,
): AuditFinding {
  return finding(context, {
    ruleId,
    url,
    category: "security",
    severity: "medium",
    title,
    description: `Cookie ${cookieName} was observed without an explicit ${expected} attribute. Cookie values were not retained.`,
    impact:
      "The cookie may receive weaker browser protection depending on its purpose and context.",
    recommendation: `Confirm the cookie purpose and add ${expected} where compatible with the required behavior.`,
    metric: "cookie name",
    value: cookieName,
    expected,
  });
}
function finding(context: ScannerContext, details: Details): AuditFinding {
  const digest = createHash("sha256")
    .update(`${details.ruleId}|${details.url}|${String(details.value)}`)
    .digest("hex")
    .slice(0, 12);
  return auditFindingSchema.parse({
    id: `${details.category}-${details.ruleId}-${digest}`,
    ruleId: details.ruleId,
    url: details.url,
    category: details.category,
    severity: details.severity,
    title: details.title,
    description: details.description,
    impact: details.impact,
    recommendation: details.recommendation,
    scanner: "security",
    detectedAt: context.detectedAt,
    evidence: {
      metric: details.metric,
      value: details.value,
      expected: details.expected,
      source: "headers",
    },
  });
}
