import { redirect } from "next/navigation";
import { requireManager } from "@/auth-server";
import { ForbiddenError, UnauthorizedError } from "@/auth-helpers";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  let me: Awaited<ReturnType<typeof requireManager>>;
  try {
    me = await requireManager();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect("/sign-in?from=/products/new");
    if (err instanceof ForbiddenError) redirect("/");
    throw err;
  }

  return (
    <AppShell user={me}>
      <div className="mx-auto max-w-lg">
        <PageHeader
          title="Add Product"
          description="Workers will pick this product when filling inbound and outbound forms."
        />
        <ProductForm />
      </div>
    </AppShell>
  );
}
