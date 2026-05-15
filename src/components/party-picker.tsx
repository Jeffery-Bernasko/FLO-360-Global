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
  name?: string;
  initial?: PartyOption | null;
  required?: boolean;
};

const SEARCH_DEBOUNCE_MS = 200;

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
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!required) {
      textInputRef.current?.setCustomValidity("");
      return;
    }
    const message = selected ? "" : `Please select a ${kind}.`;
    textInputRef.current?.setCustomValidity(message);
  }, [kind, required, selected]);

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
      />
      <input
        ref={textInputRef}
        type="text"
        required={required}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={
          kind === "customer" ? "Search customers..." : "Search suppliers..."
        }
        autoComplete="off"
        className="block w-full rounded-lg border border-surface-border bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-zinc-400 focus-ring transition-colors"
      />
      {selected ? (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100 focus-ring"
        >
          Clear
        </button>
      ) : null}

      {open ? (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-lg border border-surface-border bg-white shadow-lg">
          {isPending && options.length === 0 ? (
            <p className="p-3 text-sm text-zinc-500">Searching...</p>
          ) : options.length === 0 ? (
            <p className="p-3 text-sm text-zinc-500">
              No matches. Try a different name.
            </p>
          ) : (
            <ul className="max-h-60 divide-y divide-surface-border/60 overflow-y-auto">
              {options.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => pick(opt)}
                    className="block w-full px-3 py-2.5 text-left transition-colors hover:bg-emerald-50/50"
                  >
                    <p className="text-sm font-medium text-zinc-900">{opt.name}</p>
                    {opt.hint ? (
                      <p className="text-xs text-zinc-500">{opt.hint}</p>
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
