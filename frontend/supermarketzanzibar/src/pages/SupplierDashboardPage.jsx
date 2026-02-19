import { useEffect, useState } from "react";
import { http } from "../api/http.jsx";

function SupplierDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    category: "",
    price: "",
    cost_price: "",
    quantity: "",
    barcode: "",
    description: "",
    image: null,
  });

  const load = async () => {
    try {
      const response = await http.get("/api/supplier/dashboard/");
      setData(response.data);
    } catch {
      setError("Cannot load supplier dashboard.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createProduct = async (event) => {
    event.preventDefault();
    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") payload.append(key, value);
    });
    try {
      await http.post("/api/products/", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm({
        name: "",
        category: "",
        price: "",
        cost_price: "",
        quantity: "",
        barcode: "",
        description: "",
        image: null,
      });
      await load();
    } catch (err) {
      setError(JSON.stringify(err.response?.data || "Create product failed."));
    }
  };

  return (
    <section className="page-wrap two-col">
      <div className="panel">
        <h2>Supplier Dashboard</h2>
        <p>Products: {data?.products_count ?? 0}</p>
        <p>Low stock: {data?.low_stock_count ?? 0}</p>
        {error ? <p className="error">{error}</p> : null}
      </div>
      <div className="panel">
        <h2>Add Product</h2>
        <form onSubmit={createProduct}>
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <input placeholder="Category ID" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
          <input required placeholder="Price" type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} />
          <input required placeholder="Cost Price" type="number" value={form.cost_price} onChange={(e) => setForm((p) => ({ ...p, cost_price: e.target.value }))} />
          <input placeholder="Quantity" type="number" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
          <input required placeholder="Barcode" value={form.barcode} onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))} />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          <input type="file" accept="image/*" onChange={(e) => setForm((p) => ({ ...p, image: e.target.files?.[0] || null }))} />
          <button className="primary-btn" type="submit">Create Product</button>
        </form>
      </div>
      <div className="panel full-span">
        <h2>Your Products</h2>
        <div className="grid-products">
          {data?.products?.map((product) => (
            <article key={product.id} className="product-card small">
              <img src={product.image_url || "https://placehold.co/600x380?text=No+Image"} alt={product.name} />
              <div className="card-body">
                <h3>{product.name}</h3>
                <p className="price">TZS {product.price}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default SupplierDashboardPage;
