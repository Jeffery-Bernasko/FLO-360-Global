"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { searchProductsAction } from "@/app/products/actions";

type ProductOption = {
  id: string;
  name: string;
};

type Props = {
  name?: string;
  initial?: ProductOption | null;
  required?: boolean;
  /** Product IDs to exclude from results (e.g. already selected in other lines). */
  exclude?: string[];
  /** Called when a product is selected or cleared. */
  onSelect?: (product: ProductOption | null) => void;
};

const SEARCH_DEBOUNCE_MS = 200;

export function ProductPicker({
  name = "productId",
  initial = null,
  required = false,
  exclude = [],
  onSelect,
}: Props) {
  const [query, setQuery] = useState(initial?.name ?? "");
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ProductOption | null>(initial);
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
    const message = selected ? "" : "Please select a product.";
    textInputRef.current?.setCustomValidity(message);
  }, [required, selected]);

  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const rows = await searchProductsAction(query);
        setOptions(
          rows
            .filter((r) => !exclude.includes(r.id))
            .map((r) => ({ id: r.id, name: r.name })),
        );
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, open, exclude]);

  function pick(option: ProductOption) {
    setSelected(option);
    setQuery(option.name);
    setOpen(false);
    onSelect?.(option);
  }

  function clear() {
    setSelected(null);
    setQuery("");
    setOpen(true);
    onSelect?.(null);
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
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
        placeholder="Search products..."
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
