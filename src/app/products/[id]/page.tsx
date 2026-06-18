import { notFound, redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getProduct } from "@/lib/products";
import { ProductForm } from "../product-form";
import {
  deactivateProductAction,
  reactivateProductAction,
} from "../actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: PageProps) {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/products");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title={product.name}
          description="Edit details or change active status."
          actions={!product.isActive ? <Badge variant="danger">Inactive</Badge> : undefined}
        />

        <ProductForm product={product} />

        <Card className="mt-6">
          <h2 className="font-display text-base font-semibold text-zinc-900">Status</h2>
          {product.isActive ? (
            <>
              <p className="mt-2 text-sm text-zinc-500">
                Deactivating hides this product from the picker but keeps
                history intact.
              </p>
              <form action={deactivateProductAction} className="mt-3">
                <input type="hidden" name="productId" value={product.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 focus-ring"
                >
                  Deactivate product
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-zinc-500">
                Reactivate to make this product pickable again.
              </p>
              <form action={reactivateProductAction} className="mt-3">
                <input type="hidden" name="productId" value={product.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 focus-ring"
                >
                  Reactivate product
                </button>
              </form>
            </>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
