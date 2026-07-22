import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { clientInputSchema, type ClientInput, type ClientRecord } from "../../shared/contracts.js";

interface ClientDraft {
  addressLine: string;
  businessName: string;
  category: string;
  country: string;
  locality: string;
  notes: string;
  owner: string;
  postalCode: string;
  publicEmail: string;
  publicPhone: string;
  region: string;
  tags: string;
  websiteUrl: string;
}

function createDraft(client?: ClientRecord): ClientDraft {
  return {
    addressLine: client?.addressLine ?? "",
    businessName: client?.businessName ?? "",
    category: client?.category ?? "",
    country: client?.country ?? "",
    locality: client?.locality ?? "",
    notes: client?.notes ?? "",
    owner: client?.owner ?? "",
    postalCode: client?.postalCode ?? "",
    publicEmail: client?.publicEmail ?? "",
    publicPhone: client?.publicPhone ?? "",
    region: client?.region ?? "",
    tags: client?.tags.join(", ") ?? "",
    websiteUrl: client?.websiteUrl ?? "",
  };
}

export function ClientForm(props: {
  client?: ClientRecord;
  error: string | undefined;
  onCancel: () => void;
  onOpenExisting: (() => void) | undefined;
  onSubmit: (input: ClientInput) => Promise<void>;
}): React.JSX.Element {
  const initialDraft = useMemo(() => createDraft(props.client), [props.client]);
  const [draft, setDraft] = useState<ClientDraft>(initialDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [dirty]);

  const update = (field: keyof ClientDraft, value: string): void => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => key !== field)),
    );
  };

  const cancel = (): void => {
    if (!dirty || window.confirm("Discard unsaved client changes?")) props.onCancel();
  };

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const parsed = clientInputSchema.safeParse({
      ...draft,
      tags: draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "form");
        nextErrors[field] ??= issue.message;
      }
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      await props.onSubmit(parsed.data);
    } finally {
      setSaving(false);
    }
  };

  const field = (
    name: keyof ClientDraft,
    label: string,
    options: { autoComplete?: string; required?: boolean; type?: string } = {},
  ): React.JSX.Element => (
    <label className="form-field">
      <span>
        {label}
        {options.required === true ? " *" : ""}
      </span>
      <input
        aria-describedby={errors[name] === undefined ? undefined : `${name}-error`}
        aria-invalid={errors[name] === undefined ? undefined : true}
        autoComplete={options.autoComplete}
        name={name}
        onChange={(event) => {
          update(name, event.target.value);
        }}
        required={options.required}
        type={options.type ?? "text"}
        value={draft[name]}
      />
      {errors[name] !== undefined && (
        <small className="field-error" id={`${name}-error`}>
          {errors[name]}
        </small>
      )}
    </label>
  );

  return (
    <section aria-labelledby="client-form-title" className="section-block form-section">
      <div className="section-heading form-heading">
        <button
          aria-label="Back to clients"
          className="icon-button"
          onClick={cancel}
          title="Back to clients"
          type="button"
        >
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <div>
          <h2 id="client-form-title">
            {props.client === undefined ? "New client" : "Edit client"}
          </h2>
          <p>Keep public business information and internal account context together.</p>
        </div>
      </div>
      <form className="client-form" noValidate onSubmit={(event) => void submit(event)}>
        {props.error !== undefined && (
          <div aria-live="polite" className="form-error" role="alert">
            <span>{props.error}</span>
            {props.onOpenExisting !== undefined && (
              <button className="button secondary" onClick={props.onOpenExisting} type="button">
                Open existing client
              </button>
            )}
          </div>
        )}
        <div className="form-grid">
          {field("businessName", "Business name", { autoComplete: "organization", required: true })}
          {field("websiteUrl", "Website URL", { autoComplete: "url", required: true, type: "url" })}
          {field("publicPhone", "Public phone", { autoComplete: "tel", type: "tel" })}
          {field("publicEmail", "Public email", { autoComplete: "email", type: "email" })}
          {field("category", "Business category")}
          {field("owner", "Internal owner")}
          {field("addressLine", "Street address", { autoComplete: "street-address" })}
          {field("locality", "City or locality", { autoComplete: "address-level2" })}
          {field("region", "State or region", { autoComplete: "address-level1" })}
          {field("postalCode", "Postal code", { autoComplete: "postal-code" })}
          {field("country", "Country", { autoComplete: "country-name" })}
          {field("tags", "Tags", {})}
        </div>
        <label className="form-field form-field-wide">
          <span>Internal notes</span>
          <textarea
            name="notes"
            onChange={(event) => {
              update("notes", event.target.value);
            }}
            rows={5}
            value={draft.notes}
          />
          <small>Visible only in this local workspace.</small>
        </label>
        <div className="form-actions">
          <button className="button secondary" onClick={cancel} type="button">
            Cancel
          </button>
          <button className="button primary" disabled={saving} type="submit">
            <Save aria-hidden="true" size={16} />
            {saving ? "Saving..." : props.client === undefined ? "Create client" : "Save changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
