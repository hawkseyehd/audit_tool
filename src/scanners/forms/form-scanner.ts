import { createHash } from "node:crypto";

import { auditFindingSchema } from "../../core/schemas.js";
import type { AuditFinding, FindingSeverity } from "../../core/types.js";
import type { AuditScanner, ScannerContext } from "../types.js";
import type { FormFact, FormPageSnapshot, FormScanInput } from "./types.js";

interface FindingDetails {
  readonly description: string;
  readonly expected?: string | number;
  readonly impact: string;
  readonly metric: string;
  readonly recommendation: string;
  readonly ruleId: string;
  readonly selector: string;
  readonly severity: FindingSeverity;
  readonly title: string;
  readonly url: string;
  readonly value: string | number;
}

export function createFormScanner(): AuditScanner<FormScanInput> {
  return {
    name: "forms",
    scan: (input, context) => Promise.resolve(scanForms(input, context)),
  };
}

export function scanForms(input: FormScanInput, context: ScannerContext): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const page of [...input.pages].sort((left, right) => left.url.localeCompare(right.url))) {
    findings.push(...scanPage(page, context));
  }
  return findings;
}

function scanPage(page: FormPageSnapshot, context: ScannerContext): AuditFinding[] {
  const findings: AuditFinding[] = [];
  if (page.totalOrphanFieldCount > 0) {
    findings.push(
      finding(context, {
        ruleId: "controls-outside-form",
        url: page.url,
        severity: "medium",
        title: "Form controls are outside a form element",
        description: `${String(page.totalOrphanFieldCount)} user-input controls are not contained by a native form element.`,
        impact:
          "Submission behavior, keyboard interaction, browser validation, and assistive-technology context may be inconsistent.",
        recommendation:
          "Place related controls in a semantic form with a clear submission action, or verify the custom form behavior manually.",
        selector: page.orphanFields[0]?.selector ?? "input, select, textarea",
        metric: "orphan controls",
        value: page.totalOrphanFieldCount,
        expected: 0,
      }),
    );
    findings.push(...scanFields(page.url, "orphan controls", page.orphanFields, context));
  }

  for (const form of page.forms) {
    findings.push(...scanForm(page.url, form, context));
  }
  return findings;
}

function scanForm(url: string, form: FormFact, context: ScannerContext): AuditFinding[] {
  const findings = scanFields(url, form.selector, form.fields, context);

  if (!form.hasSubmitControl && form.totalFieldCount > 0) {
    findings.push(
      finding(context, {
        ruleId: "submit-control-missing",
        url,
        severity: "high",
        title: "Form has no clear submit control",
        description: "No native submit button or submit input was detected in this form.",
        impact:
          "Visitors may not understand how to complete the flow, which can directly reduce enquiries, bookings, or signups.",
        recommendation:
          "Provide a clearly named native submit control and verify its accessible name and visual state.",
        selector: form.selector,
        metric: "submit controls",
        value: 0,
        expected: 1,
      }),
    );
  }

  if (form.bypassesNativeValidation && form.requiredFieldCount > 0) {
    findings.push(
      finding(context, {
        ruleId: "native-validation-bypassed",
        url,
        severity: "low",
        title: "Required fields bypass native browser validation",
        description: "The form uses novalidate while containing required fields.",
        impact:
          "Users may receive less consistent or less accessible feedback when required information is missing.",
        recommendation:
          "Confirm custom validation provides clear inline messages, focus management, and accessible error associations.",
        selector: form.selector,
        metric: "required fields with novalidate",
        value: form.requiredFieldCount,
        expected: 0,
      }),
    );
  }

  const needsPrivacySignal =
    form.kind === "contact" ||
    form.kind === "lead" ||
    form.kind === "signup" ||
    form.kind === "checkout";
  if (needsPrivacySignal && !form.hasPrivacySignal && form.totalFieldCount > 0) {
    findings.push(
      finding(context, {
        ruleId: "privacy-signal-missing",
        url,
        severity: "medium",
        title: "Sensitive form lacks a nearby privacy signal",
        description:
          "No privacy, consent, terms, or data-policy text was detected inside the form.",
        impact:
          "Visitors may hesitate to share personal information when its intended use is not clear.",
        recommendation:
          "Add concise, accurate privacy context and link to the applicable policy near submission; obtain legal review where required.",
        selector: form.selector,
        metric: "privacy signal",
        value: "not detected",
        expected: "Clear privacy context",
      }),
    );
  }

  if (
    (form.kind === "contact" || form.kind === "lead" || form.kind === "signup") &&
    !form.hasAntiSpamSignal &&
    form.totalFieldCount > 0
  ) {
    findings.push(
      finding(context, {
        ruleId: "anti-spam-not-detected",
        url,
        severity: "low",
        title: "No common anti-spam signal was detected",
        description:
          "The static form markup did not show CAPTCHA, challenge, or honeypot indicators. Protection may still exist server-side.",
        impact:
          "Unprotected public forms can attract automated spam and reduce the usefulness of incoming leads.",
        recommendation:
          "Confirm server-side rate limiting and spam controls; add a privacy-conscious challenge or honeypot only when needed.",
        selector: form.selector,
        metric: "anti-spam signal",
        value: "not detected",
        expected: "Verify protection",
      }),
    );
  }

  if (form.fileFieldCount > 0 || form.paymentFieldCount > 0 || form.passwordFieldCount > 0) {
    findings.push(
      finding(context, {
        ruleId: "sensitive-form-manual-review",
        url,
        severity: "info",
        title: "Sensitive form requires manual verification",
        description:
          "The form includes file, payment, or password controls. The automated audit did not upload, pay, create an account, or submit data.",
        impact:
          "Delivery, security, validation, and error handling for this sensitive flow remain outside the automated evidence.",
        recommendation:
          "Review the flow manually with approved synthetic data in a safe environment.",
        selector: form.selector,
        metric: "sensitive controls",
        value: form.fileFieldCount + form.paymentFieldCount + form.passwordFieldCount,
        expected: "Manual review",
      }),
    );
  }

  return findings;
}

function scanFields(
  url: string,
  containerSelector: string,
  fields: FormFact["fields"],
  context: ScannerContext,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const missingAccessibleNames = fields.filter((field) => !field.hasAccessibleName);
  const placeholderOnly = fields.filter((field) => !field.hasVisibleLabel && field.hasPlaceholder);
  const accessibleButNotVisible = fields.filter(
    (field) => field.hasAccessibleName && !field.hasVisibleLabel,
  );
  const typeMismatches = fields.filter(
    (field) =>
      field.expectedType !== undefined &&
      field.expectedType !== "text" &&
      field.expectedType !== "payment" &&
      field.type !== field.expectedType,
  );
  const missingAutocomplete = fields.filter(
    (field) =>
      field.expectedType !== undefined &&
      ["email", "tel", "text"].includes(field.expectedType) &&
      !field.hasAutocomplete,
  );

  if (missingAccessibleNames.length > 0) {
    findings.push(
      finding(context, {
        ruleId: "field-label-missing",
        url,
        severity: "high",
        title: "Form fields lack accessible names",
        description: `${String(missingAccessibleNames.length)} fields have no associated label or ARIA name.`,
        impact:
          "Users may not know what information is required, especially when using assistive technology.",
        recommendation:
          "Give every field a visible label associated with matching for and id attributes; use ARIA only when a visible label is not possible.",
        selector: missingAccessibleNames[0]?.selector ?? containerSelector,
        metric: "fields without accessible names",
        value: missingAccessibleNames.length,
        expected: 0,
      }),
    );
  }
  if (placeholderOnly.length > 0) {
    findings.push(
      finding(context, {
        ruleId: "placeholder-only-fields",
        url,
        severity: "medium",
        title: "Fields rely on placeholders instead of visible labels",
        description: `${String(placeholderOnly.length)} fields have placeholder text but no visible associated label.`,
        impact: "Instructions disappear while typing and can be difficult to perceive or recall.",
        recommendation:
          "Keep persistent visible labels and use placeholders only for optional examples or formatting hints.",
        selector: placeholderOnly[0]?.selector ?? containerSelector,
        metric: "placeholder-only fields",
        value: placeholderOnly.length,
        expected: 0,
      }),
    );
  }
  if (accessibleButNotVisible.length > 0) {
    findings.push(
      finding(context, {
        ruleId: "visible-label-missing",
        url,
        severity: "low",
        title: "Fields lack persistent visible labels",
        description: `${String(accessibleButNotVisible.length)} fields have an accessible name but no associated visible label.`,
        impact:
          "Visitors who do not use assistive technology may still have difficulty understanding or recalling the requested information.",
        recommendation:
          "Add persistent visible labels while retaining the existing programmatic accessible names.",
        selector: accessibleButNotVisible[0]?.selector ?? containerSelector,
        metric: "fields without visible labels",
        value: accessibleButNotVisible.length,
        expected: 0,
      }),
    );
  }
  if (typeMismatches.length > 0) {
    findings.push(
      finding(context, {
        ruleId: "semantic-input-type-missing",
        url,
        severity: "medium",
        title: "Fields may use inappropriate input types",
        description: `${String(typeMismatches.length)} fields appear to collect email, phone, URL, or numeric data without the matching input type.`,
        impact:
          "Users may miss browser validation and mobile-friendly keyboards, increasing entry errors and abandonment.",
        recommendation:
          "Use semantic input types such as email, tel, url, and number where they match the requested data.",
        selector: typeMismatches[0]?.selector ?? containerSelector,
        metric: "semantic type mismatches",
        value: typeMismatches.length,
        expected: 0,
      }),
    );
  }
  if (missingAutocomplete.length > 0) {
    findings.push(
      finding(context, {
        ruleId: "autocomplete-missing",
        url,
        severity: "low",
        title: "Common personal fields lack autocomplete hints",
        description: `${String(missingAutocomplete.length)} common contact or identity fields do not provide an autocomplete token.`,
        impact:
          "Visitors may need more effort to complete the form, particularly on mobile devices or with cognitive and motor impairments.",
        recommendation:
          "Add accurate autocomplete tokens such as name, email, tel, organization, and address fields.",
        selector: missingAutocomplete[0]?.selector ?? containerSelector,
        metric: "fields missing autocomplete",
        value: missingAutocomplete.length,
        expected: 0,
      }),
    );
  }
  return findings;
}

function finding(context: ScannerContext, details: FindingDetails): AuditFinding {
  const digest = createHash("sha256")
    .update(`${details.ruleId}|${details.url}|${details.selector}`)
    .digest("hex")
    .slice(0, 12);
  return auditFindingSchema.parse({
    id: `forms-${details.ruleId}-${digest}`,
    ruleId: details.ruleId,
    url: details.url,
    category: "forms",
    severity: details.severity,
    title: details.title,
    description: details.description,
    impact: details.impact,
    recommendation: details.recommendation,
    scanner: "forms",
    detectedAt: context.detectedAt,
    evidence: {
      selector: details.selector,
      metric: details.metric,
      value: details.value,
      ...(details.expected === undefined ? {} : { expected: details.expected }),
      source: "crawler",
    },
  });
}
