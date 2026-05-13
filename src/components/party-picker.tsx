"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchCustomersAction } from "@/app/customers/actions";
import { searchSuppliersAction } from "@/app/suppliers/actions";

export type PartyKind = "customer" | "supplier";

type PartyOption = {
  id: string;
  name: string;
  hint?: string | null;
};

type Props = {
  kind: PartyKind;
  /** The hidden form field name. Defaults to e.g. `customerId`. */
  name?: string;
  /** Pre-selected option (e.g. when editing a draft form). */
  initial?: PartyOption | null;
  required?: boolean;
};

const SEARCH_DEBOUNCE_MS = 200;

/**
 * Typeahead picker for customers or suppliers. Calls the corresponding
 * search server action; emits the selected id via a hidden input so that
 * any standard form submission picks it up.
 *
 * Used by F5 (inbound forms, kind="supplier") and F6 (outbound forms,
 * kind="customer").
 */
export function PartyPicker({
  kind,
  name,
  initial = null,
  required = false,
}: Props) {
  const fieldName = name ?? (kind === "customer" ? "customerId" : "supplierId");
  const [query, setQuery] = useState(initial?.name ?? "");
  const [options, setOptions] = useState<PartyOption[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PartyOption | null>(initial);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const rows =
          kind === "customer"
            ? await searchCustomersAction(query)
            : await searchSuppliersAction(query);
        setOptions(
          rows.map((r) => ({
            id: r.id,
            name: r.name,
            hint:
              kind === "customer"
                ? (r as { location?: string | null }).location ?? null
                : (r as { country?: string | null }).country ?? null,
          })),
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, kind, open]);

  function pick(option: PartyOption) {
    setSelected(option);
    setQuery(option.name);
    setOpen(false);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="hidden"
        name={fieldName}
        value={selected?.id ?? ""}
        required={required}
      />
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={
          kind === "customer" ? "Search customers…" : "Search suppliers…"
        }
        autoComplete="off"
        className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
      />
      {selected ? (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
        >
          Clear
        </button>
      ) : null}

      {open ? (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {isPending && options.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">Searching…</p>
          ) : options.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">
              No matches. Try a different name.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {options.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => pick(opt)}
                    className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <p className="font-medium">{opt.name}</p>
                    {opt.hint ? (
                      <p className="text-xs text-slate-500">{opt.hint}</p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
