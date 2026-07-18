import { load, type CheerioAPI } from "cheerio";

import { formPageSnapshotSchema } from "./schemas.js";
import type {
  FormFact,
  FormFieldFact,
  FormKind,
  FormPageSnapshot,
  FormSnapshotInput,
} from "./types.js";

const MAX_FORMS = 50;
const MAX_FIELDS = 100;
const FIELD_SELECTOR =
  "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='image']), select, textarea";

export function extractFormPageSnapshot(input: FormSnapshotInput): FormPageSnapshot {
  const document = load(input.html);
  const allForms = document("form");
  const forms = allForms
    .slice(0, MAX_FORMS)
    .toArray()
    .map((element, index) => extractForm(document, document(element), index, input.page.pageType));
  const orphanElements = document(FIELD_SELECTOR).filter(
    (_index, element) => document(element).closest("form").length === 0,
  );
  const orphanFields = orphanElements
    .slice(0, MAX_FIELDS)
    .toArray()
    .map((element) => extractField(document, document(element)));

  return formPageSnapshotSchema.parse({
    url: input.page.url,
    pageType: input.page.pageType,
    forms,
    totalFormCount: allForms.length,
    orphanFields,
    totalOrphanFieldCount: orphanElements.length,
  });
}

function extractForm(
  document: CheerioAPI,
  form: ReturnType<CheerioAPI>,
  index: number,
  pageType: FormSnapshotInput["page"]["pageType"],
): FormFact {
  const fieldElements = form.find(FIELD_SELECTOR);
  const fields = fieldElements
    .slice(0, MAX_FIELDS)
    .toArray()
    .map((element) => extractField(document, document(element)));
  const formText = normalizeSemanticText(
    `${form.attr("action") ?? ""} ${form.attr("id") ?? ""} ${form.attr("name") ?? ""} ${form.text()}`,
  );
  const paymentFieldCount = fields.filter((field) => field.expectedType === "payment").length;

  return {
    selector: `form:nth-of-type(${String(index + 1)})`,
    kind: classifyFormKind(pageType, formText, fields),
    fields,
    totalFieldCount: fieldElements.length,
    requiredFieldCount: fields.filter((field) => field.isRequired).length,
    fileFieldCount: fields.filter((field) => field.type === "file").length,
    passwordFieldCount: fields.filter((field) => field.type === "password").length,
    paymentFieldCount,
    hasSubmitControl:
      form.find(
        "button:not([type]), button[type='submit'], input[type='submit'], input[type='image']",
      ).length > 0,
    hasPrivacySignal:
      /\b(?:privacy|consent|terms|data policy)\b/u.test(formText) ||
      form.find("a[href*='privacy'], a[href*='terms']").length > 0,
    hasAntiSpamSignal:
      /\b(?:captcha|recaptcha|hcaptcha|turnstile|anti spam|antispam)\b/u.test(formText) ||
      form.find(
        "[class*='captcha'], [id*='captcha'], iframe[src*='captcha'], input[name*='honeypot']",
      ).length > 0,
    bypassesNativeValidation: form.is("[novalidate]") || form.attr("novalidate") !== undefined,
  };
}

function extractField(document: CheerioAPI, field: ReturnType<CheerioAPI>): FormFieldFact {
  const tagName = (field.prop("tagName") ?? "input").toLowerCase();
  const type = tagName === "input" ? (field.attr("type") ?? "text").toLowerCase() : tagName;
  const id = field.attr("id");
  const semanticText = normalizeSemanticText(
    `${field.attr("name") ?? ""} ${id ?? ""} ${field.attr("placeholder") ?? ""} ${field.attr("aria-label") ?? ""} ${field.attr("autocomplete") ?? ""}`,
  );
  const hasAssociatedLabel =
    id !== undefined &&
    document("label[for]").filter((_index, element) => document(element).attr("for") === id)
      .length > 0;
  const hasWrappedLabel = field.closest("label").length > 0;
  const hasAriaName =
    (field.attr("aria-label")?.trim().length ?? 0) > 0 ||
    (field.attr("aria-labelledby")?.trim().length ?? 0) > 0;
  const expectedType = inferExpectedType(semanticText);
  const autocomplete = field.attr("autocomplete")?.trim().toLowerCase();

  return {
    selector: fieldSelector(tagName, type),
    type,
    ...(expectedType === undefined ? {} : { expectedType }),
    hasAccessibleName: hasAssociatedLabel || hasWrappedLabel || hasAriaName,
    hasVisibleLabel: hasAssociatedLabel || hasWrappedLabel,
    hasPlaceholder: (field.attr("placeholder")?.trim().length ?? 0) > 0,
    isRequired: field.is("[required]") || field.attr("aria-required") === "true",
    hasAutocomplete:
      autocomplete !== undefined && autocomplete.length > 0 && autocomplete !== "off",
  };
}

function classifyFormKind(
  pageType: FormSnapshotInput["page"]["pageType"],
  formText: string,
  fields: readonly FormFieldFact[],
): FormKind {
  if (pageType === "checkout" || fields.some((field) => field.expectedType === "payment")) {
    return "checkout";
  }
  if (
    pageType === "booking" ||
    /\b(?:booking|appointment|reservation|schedule)\b/u.test(formText)
  ) {
    return "booking";
  }
  if (pageType === "auth" || fields.some((field) => field.type === "password")) {
    return "signup";
  }
  if (pageType === "contact" || /\b(?:contact|message|get in touch)\b/u.test(formText)) {
    return "contact";
  }
  if (/\b(?:quote|estimate|lead|demo|enquiry|inquiry)\b/u.test(formText)) {
    return "lead";
  }
  return "generic";
}

function inferExpectedType(text: string): string | undefined {
  if (/\b(?:card|credit card|cc number|payment|billing)\b/u.test(text)) return "payment";
  if (/\b(?:email|e mail)\b/u.test(text)) return "email";
  if (/\b(?:phone|telephone|mobile|tel)\b/u.test(text)) return "tel";
  if (/\b(?:website|url)\b/u.test(text)) return "url";
  if (/\b(?:quantity|amount|number|age)\b/u.test(text)) return "number";
  if (/\b(?:name|address|city|country|postal|zip|organization|company)\b/u.test(text))
    return "text";
  return undefined;
}

function fieldSelector(tagName: string, type: string): string {
  return tagName === "input" ? `input[type="${type.replace(/[^a-z0-9_-]/gu, "")}"]` : tagName;
}

function normalizeSemanticText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}
