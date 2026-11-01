// GET /api/products/[id] - Get a single product by ID.

import { json } from "@/lib/http";
import { getProductById } from "@/lib/products";
import { getCategoryById } from "@/lib/categories";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const product = await getProductById(BigInt(id));
    if (!product) {
      return json({ detail: "Product not found." }, { status: 404 });
    }

    const category = product.category
      ? await getCategoryById(product.category.id)
      : null;

    return json({
      id: product.id.toString(),
      name: product.name,
      slug: product.slug,
      price: product.price,
      quantity: product.quantity,
      barcode: product.barcode,
      description: product.description,
      category: category
        ? { id: category.id.toString(), name: category.name }
        : null,
      supplier: product.supplier
        ? { id: product.supplier.id.toString(), companyName: product.supplier.companyName }
        : null,
      image_available: Boolean(product.imageData),
      createdAt: product.createdAt,
    });
  } catch (error) {
    console.error("Get product failed:", error);
    return json(
      { detail: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
