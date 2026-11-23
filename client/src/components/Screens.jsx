import { useEffect, useMemo, useState } from "react";
import { queryString, request } from "../lib/api.js";

const money = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "rupee",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
const date = (value) =>
  value
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "—";
const initials = (value = "") =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

function useLoad(token, path, params = {}, refreshKey = 0) {
  const query = queryString(params);
  const requestKey = `${token}:${path}:${query}:${refreshKey}`;
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    request(`${path}${query ? `?${query}` : ""}`, { token })
      .then((result) => {
        if (active) setResult({ key: requestKey, data: result, error: "" });
      })
      .catch((loadError) => {
        if (active)
          setResult({ key: requestKey, data: null, error: loadError.message });
      });
    return () => {
      active = false;
    };
  }, [token, path, query, refreshKey, requestKey]);

  const isCurrent = result?.key === requestKey;
  return {
    data: isCurrent ? result.data : null,
    loading: !isCurrent,
    error: isCurrent ? result.error : "",
  };
}

export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}

export function Modal({ title, description, onClose, children, wide = false }) {
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className={`modal-card ${wide ? "modal-wide" : ""}`}
        role="dialog"
      >
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
          <button
            aria-label="Close dialog"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true" className="empty-icon">
        ◌
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadState({ loading, error, onRetry }) {
  if (loading)
    return (
      <div className="loading-state">
        <span className="spinner" /> Loading your workspace…
      </div>
    );
  if (error) {
    return (
      <div className="inline-error" role="alert">
        <span>{error}</span>
        {onRetry && (
          <button className="text-button" onClick={onRetry} type="button">
            Try again
          </button>
        )}
      </div>
    );
  }
  return null;
}

export function StatusBadge({ status }) {
  const value = String(status ?? "Unknown");
  const kind = value.toLowerCase().replaceAll(" ", "-");
  return <span className={`status-badge status-${kind}`}>{value}</span>;
}

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <span>
        Page {page} of {pages}
      </span>
      <div>
        <button
          className="button button-small button-quiet"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          type="button"
        >
          ← Previous
        </button>
        <button
          className="button button-small button-quiet"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          type="button"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function Toolbar({ children }) {
  return <div className="toolbar">{children}</div>;
}

function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function FormActions({ onCancel, saving, submitLabel = "Save changes" }) {
  return (
    <div className="form-actions">
      <button className="button button-quiet" onClick={onCancel} type="button">
        Cancel
      </button>
      <button className="button button-primary" disabled={saving} type="submit">
        {saving ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

const emptyInventoryItem = { name: "", sku: "", price: "", quantity: "" };

export function SimpleInventoryScreen({ token, onNotify }) {
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(emptyInventoryItem);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", sku: "", price: "" });
  const [stockProduct, setStockProduct] = useState(null);
  const [stockForm, setStockForm] = useState({ quantity: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const { data, loading, error } = useLoad(
    token,
    "/products",
    { limit: 100, page },
    refreshKey,
  );
  const products = data?.products ?? [];
  const inventoryCount = data?.pagination?.total ?? 0;

  async function submitItem(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");

    try {
      const createdResult = await request("/products", {
        token,
        method: "POST",
        body: {
          name: form.name.trim(),
          sku: form.sku.trim(),
          price: Number(form.price),
          imageUrl: "",
        },
      });

      const quantity = Number(form.quantity);
      if (quantity > 0) {
        try {
          await request(`/inventory/${createdResult.product._id}/adjust`, {
            token,
            method: "PATCH",
            body: { change: quantity, reason: "Initial stock" },
          });
        } catch (stockError) {
          setIsAdding(false);
          setForm(emptyInventoryItem);
          setRefreshKey((current) => current + 1);
          onNotify(
            `${form.name} was added, but its stock was not. It currently has 0 units: ${stockError.message}`,
            "error",
          );
          return;
        }
      }

      setIsAdding(false);
      setForm(emptyInventoryItem);
      setRefreshKey((current) => current + 1);
      onNotify(`${form.name} added to inventory`);
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await request(`/products/${editingProduct._id}`, {
        token,
        method: "PATCH",
        body: {
          name: editForm.name.trim(),
          sku: editForm.sku.trim(),
          price: Number(editForm.price),
        },
      });
      setEditingProduct(null);
      setRefreshKey((current) => current + 1);
      onNotify(`${editForm.name} updated`);
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveStock(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    const change = Number(stockForm.quantity) - stockProduct.stock;
    if (!Number.isInteger(change) || change === 0) {
      setFormError(
        "Enter a new whole-number quantity that is different from the current stock.",
      );
      setSaving(false);
      return;
    }
    try {
      await request(`/inventory/${stockProduct._id}/adjust`, {
        token,
        method: "PATCH",
        body: { change, reason: stockForm.reason.trim() },
      });
      setStockProduct(null);
      setRefreshKey((current) => current + 1);
      onNotify(`${stockProduct.name} stock updated`);
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(product) {
    if (!window.confirm(`Remove ${product.name} from inventory?`)) return;
    try {
      await request(`/products/${product._id}`, { token, method: "DELETE" });
      setRefreshKey((current) => current + 1);
      onNotify(`${product.name} removed from inventory`);
    } catch (requestError) {
      onNotify(requestError.message, "error");
    }
  }

  return (
    <>
      <section className="inventory-welcome">
        <div>
          <span className="eyebrow">WORKSPACE STOCK, AT A GLANCE</span>
          <h1>Inventory</h1>
          <p>Manage workspace items and keep stock up to date.</p>
        </div>
        <button
          className="button button-primary inventory-add-button"
          onClick={() => {
            setFormError("");
            setIsAdding(true);
          }}
          type="button"
        >
          <span aria-hidden="true">＋</span> Add item
        </button>
      </section>

      <section
        aria-labelledby="inventory-items-title"
        className="inventory-section"
      >
        <header className="inventory-section-heading ">
          <div>
            <h2 id="inventory-items-title">Workspace items</h2>
            <p>Products available across the workspace.</p>
          </div>
          {!loading && !error && (
            <span className="inventory-count">
              {inventoryCount} {inventoryCount === 1 ? "item" : "items"}
            </span>
          )}
        </header>

        <LoadState
          loading={loading}
          error={error}
          onRetry={() => setRefreshKey((current) => current + 1)}
        />
        {!loading && !error && products.length === 0 && (
          <EmptyState
            title="Inventory is empty"
            description="Add the first item to start keeping track of workspace stock."
            action={
              <button
                className="button button-primary"
                onClick={() => setIsAdding(true)}
                type="button"
              >
                Add your first item
              </button>
            }
          />
        )}
        {!loading && !error && products.length > 0 && (
          <div className="inventory-grid">
            {products.map((product) => (
              <article className="inventory-card" key={product._id}>
                <div className="inventory-card-image">
                  <img
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                    src={
                      product.imageUrl ||
                      `https://picsum.photos/seed/${encodeURIComponent(product.sku)}/640/400`
                    }
                  />
                </div>
                <div className="inventory-card-content">
                  <div className="inventory-card-title">
                    <h3>{product.name}</h3>
                    <span
                      className={`inventory-stock ${product.stock === 0 ? "inventory-stock-empty" : ""}`}
                    >
                      {product.stock} {product.stock === 1 ? "unit" : "units"}
                    </span>
                  </div>
                  <div className="inventory-card-meta">
                    <span>SKU: {product.sku}</span>
                    <strong>{money(product.price)}</strong>
                  </div>
                  <div className="inventory-card-actions">
                    <button
                      className="button button-small button-quiet"
                      onClick={() => {
                        setFormError("");
                        setEditingProduct(product);
                        setEditForm({
                          name: product.name,
                          sku: product.sku,
                          price: String(product.price),
                        });
                      }}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="button button-small button-quiet"
                      onClick={() => {
                        setFormError("");
                        setStockProduct(product);
                        setStockForm({
                          quantity: String(product.stock),
                          reason: "",
                        });
                      }}
                      type="button"
                    >
                      Update stock
                    </button>
                    <button
                      className="button button-small button-danger"
                      onClick={() => removeItem(product)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {!loading && !error && data?.pagination?.pages > 1 && (
          <Pagination
            page={data.pagination.page}
            pages={data.pagination.pages}
            onChange={setPage}
          />
        )}
      </section>

      {isAdding && (
        <Modal
          title="Add an item"
          description="Enter a few details to add a product and its starting quantity."
          onClose={() => setIsAdding(false)}
        >
          <form className="modal-form" onSubmit={submitItem}>
            {formError && (
              <div className="inline-error" role="alert">
                {formError}
              </div>
            )}
            <Field label="Product name">
              <input
                autoFocus
                maxLength="150"
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
                value={form.name}
              />
            </Field>
            <Field label="SKU" hint="A unique code for this item">
              <input
                maxLength="64"
                onChange={(event) =>
                  setForm({ ...form, sku: event.target.value })
                }
                required
                value={form.sku}
              />
            </Field>
            <div className="inventory-form-row">
              <Field label="Price">
                <input
                  min="0"
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                  required
                  step="0.01"
                  type="number"
                  value={form.price}
                />
              </Field>
              <Field label="Starting quantity">
                <input
                  min="0"
                  onChange={(event) =>
                    setForm({ ...form, quantity: event.target.value })
                  }
                  required
                  step="1"
                  type="number"
                  value={form.quantity}
                />
              </Field>
            </div>
            <p className="inventory-image-note"></p>
            <FormActions
              onCancel={() => setIsAdding(false)}
              saving={saving}
              submitLabel="Add to inventory"
            />
          </form>
        </Modal>
      )}
      {editingProduct && (
        <Modal
          title="Edit item"
          description="Update the item details in the workspace catalog."
          onClose={() => setEditingProduct(null)}
        >
          <form className="modal-form" onSubmit={saveProduct}>
            {formError && (
              <div className="inline-error" role="alert">
                {formError}
              </div>
            )}
            <Field label="Product name">
              <input
                autoFocus
                maxLength="150"
                onChange={(event) =>
                  setEditForm({ ...editForm, name: event.target.value })
                }
                required
                value={editForm.name}
              />
            </Field>
            <Field label="SKU">
              <input
                maxLength="64"
                onChange={(event) =>
                  setEditForm({ ...editForm, sku: event.target.value })
                }
                required
                value={editForm.sku}
              />
            </Field>
            <Field label="Price">
              <input
                min="0"
                onChange={(event) =>
                  setEditForm({ ...editForm, price: event.target.value })
                }
                required
                step="0.01"
                type="number"
                value={editForm.price}
              />
            </Field>
            <FormActions
              onCancel={() => setEditingProduct(null)}
              saving={saving}
              submitLabel="Save item"
            />
          </form>
        </Modal>
      )}
      {stockProduct && (
        <Modal
          title="Update stock"
          description={`${stockProduct.name} currently has ${stockProduct.stock} ${stockProduct.stock === 1 ? "unit" : "units"}.`}
          onClose={() => setStockProduct(null)}
        >
          <form className="modal-form" onSubmit={saveStock}>
            {formError && (
              <div className="inline-error" role="alert">
                {formError}
              </div>
            )}
            <Field label="New quantity">
              <input
                autoFocus
                min="0"
                onChange={(event) =>
                  setStockForm({ ...stockForm, quantity: event.target.value })
                }
                required
                step="1"
                type="number"
                value={stockForm.quantity}
              />
            </Field>
            <Field label="Reason for change">
              <input
                maxLength="300"
                onChange={(event) =>
                  setStockForm({ ...stockForm, reason: event.target.value })
                }
                placeholder="For example, new delivery"
                required
                value={stockForm.reason}
              />
            </Field>
            <FormActions
              onCancel={() => setStockProduct(null)}
              saving={saving}
              submitLabel="Save quantity"
            />
          </form>
        </Modal>
      )}
    </>
  );
}

export function SimpleOrdersScreen({ token }) {
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useLoad(
    token,
    "/orders",
    { limit: 50, page },
    refreshKey,
  );
  const orders = data?.orders ?? [];

  return (
    <section className="orders-page">
      <header className="inventory-welcome">
        <div>
          <span className="eyebrow">ORDER HISTORY</span>
          <h1>Orders</h1>
          <p>Workspace order history.</p>
        </div>
      </header>
      <section
        aria-labelledby="orders-list-title"
        className="inventory-section"
      >
        <header className="inventory-section-heading">
          <div>
            <h2 id="orders-list-title">Workspace orders</h2>
            <p>View the items, totals, and status for each order.</p>
          </div>
          {!loading && !error && (
            <span className="inventory-count">
              {data?.pagination?.total ?? 0} orders
            </span>
          )}
        </header>
        <LoadState
          loading={loading}
          error={error}
          onRetry={() => setRefreshKey((current) => current + 1)}
        />
        {!loading && !error && orders.length === 0 && (
          <EmptyState
            title="No orders yet"
            description="Orders created in this workspace will appear here."
          />
        )}
        {!loading && !error && orders.length > 0 && (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order._id}>
                <div className="order-card-heading">
                  <div>
                    <span className="mono-text">{order.orderNumber}</span>
                    <h3>
                      {order.customerSnapshot?.name ??
                        order.customer?.name ??
                        "Customer"}
                    </h3>
                  </div>
                  <span
                    className={`order-status order-status-${String(order.status).toLowerCase()}`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="order-card-items">
                  {order.items.map((item) => (
                    <span key={`${order._id}-${item.sku}`}>
                      {item.name} × {item.quantity}
                    </span>
                  ))}
                </div>
                <div className="order-card-footer">
                  <strong>{money(order.total)}</strong>
                </div>
              </article>
            ))}
          </div>
        )}
        {!loading && !error && data?.pagination?.pages > 1 && (
          <Pagination
            page={data.pagination.page}
            pages={data.pagination.pages}
            onChange={setPage}
          />
        )}
      </section>
    </section>
  );
}

const emptyProduct = {
  name: "",
  description: "",
  imageUrl: "",
  sku: "",
  category: "",
  price: "",
};

export function ProductsScreen({ token, onNotify }) {
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    stockStatus: "",
    sortBy: "name",
    sortOrder: "asc",
    page: 1,
  });
  const [searchDraft, setSearchDraft] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const products = useLoad(
    token,
    "/products",
    { ...filters, limit: 8 },
    refreshKey,
  );
  const categories = useLoad(token, "/categories");
  const rows = products.data?.products ?? [];
  const categoriesList = categories.data?.categories ?? [];

  function openForm(product) {
    setActionError("");
    setForm(
      product
        ? {
            name: product.name,
            description: product.description ?? "",
            imageUrl: product.imageUrl ?? "",
            sku: product.sku,
            category: product.category?._id ?? product.category ?? "",
            price: String(product.price),
          }
        : emptyProduct,
    );
    setModal(product ? "edit" : "create");
  }

  async function submitProduct(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    const editing = modal === "edit";
    const { category, ...productFields } = form;
    const payload = {
      ...productFields,
      price: Number(form.price),
      ...(category ? { category } : {}),
    };
    try {
      await request(editing ? `/products/${selected._id}` : "/products", {
        token,
        method: editing ? "PATCH" : "POST",
        body: payload,
      });
      setModal(null);
      setSelected(null);
      setRefreshKey((key) => key + 1);
      onNotify(editing ? "Product updated" : "Product created");
    } catch (error) {
      setActionError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(product) {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    try {
      await request(`/products/${product._id}`, { token, method: "DELETE" });
      setRefreshKey((key) => key + 1);
      onNotify("Product deleted");
    } catch (error) {
      onNotify(error.message, "error");
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="CATALOG"
        title="Products"
        description="Manage products across the workspace."
        action={
          <button
            className="button button-primary"
            onClick={() => openForm()}
            type="button"
          >
            <span>＋</span> Add product
          </button>
        }
      />
      <section className="panel">
        <Toolbar>
          <form
            className="search-control"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters((current) => ({
                ...current,
                search: searchDraft,
                page: 1,
              }));
            }}
          >
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search products"
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search name or SKU…"
              value={searchDraft}
            />
            <button className="sr-only" type="submit">
              Search
            </button>
          </form>
          <select
            aria-label="Filter by category"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                category: event.target.value,
                page: 1,
              }))
            }
            value={filters.category}
          >
            <option value="">All categories</option>
            {categoriesList.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by stock"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                stockStatus: event.target.value,
                page: 1,
              }))
            }
            value={filters.stockStatus}
          >
            <option value="">Any stock</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
          <select
            aria-label="Sort products"
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                sortBy: event.target.value,
              }))
            }
            value={filters.sortBy}
          >
            <option value="name">Sort: Name</option>
            <option value="price">Sort: Price</option>
            <option value="quantity">Sort: Quantity</option>
          </select>
        </Toolbar>
        <LoadState
          loading={products.loading}
          error={products.error}
          onRetry={() => setRefreshKey((key) => key + 1)}
        />
        {!products.loading && !products.error && rows.length === 0 && (
          <EmptyState
            title="No products found"
            description={
              filters.search
                ? "Try a different search or clear your filters."
                : "Add your first product to start building your catalog."
            }
            action={
              <button
                className="button button-primary"
                onClick={() => openForm()}
                type="button"
              >
                Add a product
              </button>
            }
          />
        )}
        {!products.loading && !products.error && rows.length > 0 && (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Available</th>
                    <th>Updated</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((product) => (
                    <tr key={product._id}>
                      <td>
                        <button
                          className="product-cell"
                          onClick={() => {
                            setSelected(product);
                            setModal("details");
                          }}
                          type="button"
                        >
                          <span className="product-thumb">
                            {product.imageUrl ? (
                              <img alt="" src={product.imageUrl} />
                            ) : (
                              initials(product.name)
                            )}
                          </span>
                          <span>
                            <b>{product.name}</b>
                            <small>{product.description || "—"}</small>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="mono-text">{product.sku}</span>
                      </td>
                      <td>{product.category?.name ?? "Uncategorized"}</td>
                      <td className="price-cell">{money(product.price)}</td>
                      <td>
                        <span
                          className={`stock-value ${product.stock === 0 ? "stock-empty" : product.stock <= 5 ? "stock-low" : ""}`}
                        >
                          {product.stock} <small>units</small>
                        </span>
                      </td>
                      <td className="muted">{date(product.updatedAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            aria-label={`Edit ${product.name}`}
                            className="icon-button"
                            onClick={() => {
                              setSelected(product);
                              openForm(product);
                            }}
                            type="button"
                          >
                            ✎
                          </button>
                          <button
                            aria-label={`Delete ${product.name}`}
                            className="icon-button icon-danger"
                            onClick={() => removeProduct(product)}
                            type="button"
                          >
                            ⌫
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={products.data.pagination.page}
              pages={products.data.pagination.pages}
              onChange={(page) =>
                setFilters((current) => ({ ...current, page }))
              }
            />
          </>
        )}
      </section>
      {(modal === "create" || modal === "edit") && (
        <Modal
          title={modal === "create" ? "Add a product" : "Edit product"}
          description="Product stock is managed separately in Inventory."
          onClose={() => setModal(null)}
        >
          <form className="modal-form" onSubmit={submitProduct}>
            {actionError && (
              <div className="inline-error" role="alert">
                {actionError}
              </div>
            )}
            <Field label="Product name">
              <input
                maxLength="150"
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
                value={form.name}
              />
            </Field>
            <Field label="SKU" hint="Unique product code">
              <input
                maxLength="64"
                onChange={(event) =>
                  setForm({ ...form, sku: event.target.value })
                }
                required
                value={form.sku}
              />
            </Field>
            <Field label="Category" hint="Optional">
              <select
                onChange={(event) =>
                  setForm({ ...form, category: event.target.value })
                }
                value={form.category}
              >
                <option value="">Choose a category</option>
                {categoriesList.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price">
              <div className="input-prefix">
                <span>$</span>
                <input
                  min="0"
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                  required
                  step="0.01"
                  type="number"
                  value={form.price}
                />
              </div>
            </Field>
            <Field label="Image URL">
              <input
                maxLength="2048"
                onChange={(event) =>
                  setForm({ ...form, imageUrl: event.target.value })
                }
                placeholder="https://…"
                type="url"
                value={form.imageUrl}
              />
            </Field>
            <Field label="Description">
              <textarea
                maxLength="2000"
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                rows="3"
                value={form.description}
              />
            </Field>
            <FormActions
              onCancel={() => setModal(null)}
              saving={saving}
              submitLabel={
                modal === "create" ? "Create product" : "Save product"
              }
            />
          </form>
        </Modal>
      )}
      {modal === "details" && selected && (
        <Modal title="Product details" onClose={() => setModal(null)}>
          <div className="detail-stack">
            <div className="detail-product">
              <span className="product-thumb product-thumb-large">
                {selected.imageUrl ? (
                  <img alt="" src={selected.imageUrl} />
                ) : (
                  initials(selected.name)
                )}
              </span>
              <div>
                <h3>{selected.name}</h3>
                <span className="mono-text">{selected.sku}</span>
              </div>
            </div>
            <div className="detail-grid">
              <div>
                <small>Category</small>
                <b>{selected.category?.name ?? "Uncategorized"}</b>
              </div>
              <div>
                <small>Price</small>
                <b>{money(selected.price)}</b>
              </div>
              <div>
                <small>Available stock</small>
                <b>{selected.stock} units</b>
              </div>
              <div>
                <small>Added</small>
                <b>{date(selected.createdAt)}</b>
              </div>
            </div>
            <p className="detail-description">
              {selected.description || "No description provided."}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

const blankCategory = { name: "", description: "" };

export function CategoriesScreen({ token, onNotify }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blankCategory);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const {
    data,
    loading,
    error: loadError,
  } = useLoad(token, "/categories", {}, refreshKey);
  const categories = data?.categories ?? [];

  function startForm(category) {
    setSelected(category ?? null);
    setForm(
      category
        ? { name: category.name, description: category.description ?? "" }
        : blankCategory,
    );
    setError("");
    setModal(category ? "edit" : "create");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await request(selected ? `/categories/${selected._id}` : "/categories", {
        token,
        method: selected ? "PATCH" : "POST",
        body: form,
      });
      setModal("");
      setRefreshKey((key) => key + 1);
      onNotify(selected ? "Category updated" : "Category created");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(category) {
    if (!window.confirm(`Delete the ${category.name} category?`)) return;
    try {
      await request(`/categories/${category._id}`, { token, method: "DELETE" });
      setRefreshKey((key) => key + 1);
      onNotify("Category deleted");
    } catch (requestError) {
      onNotify(requestError.message, "error");
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="ORGANIZATION"
        title="Categories"
        description="Group your products into collections that make sense for your team."
        action={
          <button
            className="button button-primary"
            onClick={() => startForm()}
            type="button"
          >
            ＋ Add category
          </button>
        }
      />
      <LoadState
        loading={loading}
        error={loadError}
        onRetry={() => setRefreshKey((key) => key + 1)}
      />
      {!loading && !loadError && categories.length === 0 && (
        <EmptyState
          title="A place for everything"
          description="Create a category to start organizing your products."
          action={
            <button
              className="button button-primary"
              onClick={() => startForm()}
              type="button"
            >
              Create category
            </button>
          }
        />
      )}
      {!loading && !loadError && categories.length > 0 && (
        <div className="category-grid">
          {categories.map((category, index) => (
            <article className="category-card" key={category._id}>
              <div className={`category-glyph glyph-${index % 5}`}>
                <span>{category.name.slice(0, 1).toUpperCase()}</span>
              </div>
              <div className="category-card-body">
                <div className="category-title-row">
                  <h2>{category.name}</h2>
                  <span className="count-pill">
                    {category.productCount}{" "}
                    {category.productCount === 1 ? "item" : "items"}
                  </span>
                </div>
                <p>{category.description || "No description added yet."}</p>
                <div className="category-card-footer">
                  <span>Updated {date(category.updatedAt)}</span>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`Edit ${category.name}`}
                      onClick={() => startForm(category)}
                      type="button"
                    >
                      ✎
                    </button>
                    <button
                      className="icon-button icon-danger"
                      aria-label={`Delete ${category.name}`}
                      onClick={() => remove(category)}
                      type="button"
                    >
                      ⌫
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {modal && (
        <Modal
          title={selected ? "Edit category" : "Create a category"}
          description="Products already assigned to this category keep their link."
          onClose={() => setModal("")}
        >
          <form className="modal-form" onSubmit={submit}>
            {error && (
              <div className="inline-error" role="alert">
                {error}
              </div>
            )}
            <Field label="Category name">
              <input
                maxLength="100"
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
                value={form.name}
              />
            </Field>
            <Field label="Description">
              <textarea
                maxLength="500"
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
                rows="4"
                value={form.description}
              />
            </Field>
            <FormActions
              onCancel={() => setModal("")}
              saving={saving}
              submitLabel={selected ? "Save category" : "Create category"}
            />
          </form>
        </Modal>
      )}
    </>
  );
}

export function InventoryScreen({ token, onNotify }) {
  const [view, setView] = useState("low-stock");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState(null);
  const [adjustment, setAdjustment] = useState({ change: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const summary = useLoad(token, "/inventory", {}, refreshKey);
  const listPath =
    view === "movements" ? "/inventory/movements" : `/inventory/${view}`;
  const list = useLoad(token, listPath, { page, limit: 8 }, refreshKey);
  const summaryData = summary.data ?? {};
  const items =
    view === "movements"
      ? (list.data?.movements ?? [])
      : (list.data?.products ?? []);

  async function submitAdjustment(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    try {
      await request(`/inventory/${selected._id}/adjust`, {
        token,
        method: "PATCH",
        body: { change: Number(adjustment.change), reason: adjustment.reason },
      });
      setSelected(null);
      setAdjustment({ change: "", reason: "" });
      setRefreshKey((key) => key + 1);
      onNotify("Stock adjustment recorded");
    } catch (error) {
      setActionError(error.message);
    } finally {
      setSaving(false);
    }
  }

  const stats = [
    {
      label: "Total products",
      value: summaryData.totalProducts ?? "—",
      tone: "stat-sage",
      symbol: "▦",
    },
    {
      label: "Low stock",
      value: summaryData.lowStockCount ?? "—",
      tone: "stat-amber",
      symbol: "⌁",
    },
    {
      label: "Out of stock",
      value: summaryData.outOfStockCount ?? "—",
      tone: "stat-rose",
      symbol: "∅",
    },
    {
      label: "Alert threshold",
      value: `${summaryData.threshold ?? "—"} units`,
      tone: "stat-blue",
      symbol: "⌖",
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow="STOCK CONTROL"
        title="Inventory"
        description="A real-time view of availability, low stock and every stock movement."
      />
      <div className="stats-grid inventory-stats">
        {stats.map((stat) => (
          <article className={`stat-card ${stat.tone}`} key={stat.label}>
            <div className="stat-top">
              <span>{stat.label}</span>
              <span className="stat-symbol">{stat.symbol}</span>
            </div>
            <strong>{stat.value}</strong>
            <small>
              {stat.label === "Alert threshold"
                ? "Configured low-stock limit"
                : "Across your product catalog"}
            </small>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="panel-heading panel-heading-tabs">
          <div>
            <h2>Stock overview</h2>
            <p>Monitor quantity and investigate changes.</p>
          </div>
          <div className="segmented-control">
            <button
              className={view === "low-stock" ? "active" : ""}
              onClick={() => {
                setView("low-stock");
                setPage(1);
              }}
              type="button"
            >
              Low stock
            </button>
            <button
              className={view === "out-of-stock" ? "active" : ""}
              onClick={() => {
                setView("out-of-stock");
                setPage(1);
              }}
              type="button"
            >
              Out of stock
            </button>
            <button
              className={view === "movements" ? "active" : ""}
              onClick={() => {
                setView("movements");
                setPage(1);
              }}
              type="button"
            >
              Movement history
            </button>
          </div>
        </div>
        <LoadState
          loading={summary.loading || list.loading}
          error={summary.error || list.error}
          onRetry={() => setRefreshKey((key) => key + 1)}
        />
        {!summary.loading &&
          !list.loading &&
          !summary.error &&
          !list.error &&
          items.length === 0 && (
            <EmptyState
              title={
                view === "low-stock"
                  ? "Stock levels look healthy"
                  : view === "out-of-stock"
                    ? "Nothing is out of stock"
                    : "No stock movements yet"
              }
              description={
                view === "movements"
                  ? "Adjust inventory to start a traceable history."
                  : "There are no products to show in this view."
              }
            />
          )}
        {!list.loading && !list.error && items.length > 0 && (
          <>
            <div className="table-scroll">
              <table className="data-table">
                {view === "movements" ? (
                  <>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Movement</th>
                        <th>Before → after</th>
                        <th>Reason</th>
                        <th>Recorded by</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((movement) => (
                        <tr key={movement._id}>
                          <td>
                            <b>{movement.product?.name ?? "Removed product"}</b>
                            <small className="table-subline">
                              {movement.product?.sku ?? "—"}
                            </small>
                          </td>
                          <td>
                            <StatusBadge status={movement.type} />
                          </td>
                          <td>
                            <span
                              className={
                                movement.change > 0
                                  ? "movement-positive"
                                  : "movement-negative"
                              }
                            >
                              {movement.change > 0 ? "+" : ""}
                              {movement.change}
                            </span>
                            <small className="table-subline">
                              {movement.quantityBefore} →{" "}
                              {movement.quantityAfter}
                            </small>
                          </td>
                          <td>{movement.reason}</td>
                          <td>{movement.performedBy?.name ?? "—"}</td>
                          <td>{date(movement.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Stock level</th>
                        <th>Status</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((product) => (
                        <tr key={product._id}>
                          <td>
                            <div className="table-product">
                              <span className="product-thumb">
                                {product.imageUrl ? (
                                  <img alt="" src={product.imageUrl} />
                                ) : (
                                  initials(product.name)
                                )}
                              </span>
                              <span>
                                <b>{product.name}</b>
                                <small>{product.sku}</small>
                              </span>
                            </div>
                          </td>
                          <td>{product.category?.name ?? "—"}</td>
                          <td>
                            <b>{product.stock}</b> units
                          </td>
                          <td>
                            <StatusBadge
                              status={
                                product.stock === 0
                                  ? "Out of stock"
                                  : "Low stock"
                              }
                            />
                          </td>
                          <td>
                            <button
                              className="button button-small button-outline"
                              onClick={() => {
                                setSelected(product);
                                setAdjustment({ change: "", reason: "" });
                                setActionError("");
                              }}
                              type="button"
                            >
                              Adjust stock
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>
            <Pagination
              page={list.data.pagination.page}
              pages={list.data.pagination.pages}
              onChange={setPage}
            />
          </>
        )}
      </section>
      {selected && (
        <Modal
          title="Adjust stock"
          description={`${selected.name} · current quantity ${selected.stock}`}
          onClose={() => setSelected(null)}
        >
          <form className="modal-form" onSubmit={submitAdjustment}>
            {actionError && (
              <div className="inline-error" role="alert">
                {actionError}
              </div>
            )}
            <Field
              label="Quantity change"
              hint="Use a positive number to add stock or a negative number to remove it."
            >
              <input
                onChange={(event) =>
                  setAdjustment({ ...adjustment, change: event.target.value })
                }
                required
                step="1"
                type="number"
                value={adjustment.change}
              />
            </Field>
            <Field label="Reason">
              <textarea
                maxLength="300"
                onChange={(event) =>
                  setAdjustment({ ...adjustment, reason: event.target.value })
                }
                placeholder="e.g. Received supplier shipment"
                required
                rows="3"
                value={adjustment.reason}
              />
            </Field>
            <FormActions
              onCancel={() => setSelected(null)}
              saving={saving}
              submitLabel="Record adjustment"
            />
          </form>
        </Modal>
      )}
    </>
  );
}

const transitions = {
  Pending: ["Processing", "Cancelled"],
  Processing: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

export function OrdersScreen({ token, onNotify }) {
  const [params, setParams] = useState({
    search: "",
    status: "",
    page: 1,
  });
  const [searchDraft, setSearchDraft] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orderForm, setOrderForm] = useState({
    customerId: "",
    items: [{ productId: "", quantity: 1 }],
  });
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const orders = useLoad(token, "/orders", { ...params, limit: 8 }, refreshKey);
  const rows = orders.data?.orders ?? [];

  async function startOrder() {
    setActionError("");
    setSaving(true);
    try {
      const [customerResult, productResult] = await Promise.all([
        request("/customers?limit=100", { token }),
        request("/products?limit=100&stockStatus=in_stock", { token }),
      ]);
      setCustomers(customerResult.customers);
      setProducts(productResult.products);
      setOrderForm({ customerId: "", items: [{ productId: "", quantity: 1 }] });
      setIdempotencyKey(crypto.randomUUID());
      setModal("create");
    } catch (error) {
      onNotify(error.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const estimatedTotal = useMemo(
    () =>
      orderForm.items.reduce((sum, item) => {
        const product = products.find((entry) => entry._id === item.productId);
        return sum + (product?.price ?? 0) * (Number(item.quantity) || 0);
      }, 0),
    [orderForm.items, products],
  );

  function editItem(index, field, value) {
    setOrderForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  }

  async function submitOrder(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    try {
      const result = await request("/orders", {
        token,
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: {
          customerId: orderForm.customerId,
          items: orderForm.items.map((item) => ({
            productId: item.productId,
            quantity: Number(item.quantity),
          })),
        },
      });
      setModal("");
      setIdempotencyKey("");
      setRefreshKey((key) => key + 1);
      onNotify(`Order ${result.order.orderNumber} created`);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function showOrder(order) {
    try {
      const result = await request(`/orders/${order._id}`, { token });
      setSelected(result.order);
      setModal("details");
    } catch (error) {
      onNotify(error.message, "error");
    }
  }

  async function updateStatus(status) {
    if (
      status === "Cancelled" &&
      !window.confirm(
        `Cancel order ${selected.orderNumber}? Stock will be restored.`,
      )
    ) {
      return;
    }
    try {
      const result = await request(`/orders/${selected._id}/status`, {
        token,
        method: "PATCH",
        body: { status },
      });
      setSelected(result.order);
      setRefreshKey((key) => key + 1);
      onNotify(
        status === "Cancelled"
          ? "Order cancelled and stock restored"
          : `Order marked ${status.toLowerCase()}`,
      );
    } catch (error) {
      onNotify(error.message, "error");
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="SALES"
        title="Orders"
        description="Follow every order from the first click through fulfillment."
        action={
          <button
            className="button button-primary"
            disabled={saving}
            onClick={startOrder}
            type="button"
          >
            ＋ Create order
          </button>
        }
      />
      <section className="panel">
        <Toolbar>
          <form
            className="search-control"
            onSubmit={(event) => {
              event.preventDefault();
              setParams((current) => ({
                ...current,
                search: searchDraft,
                page: 1,
              }));
            }}
          >
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search orders"
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Order number or customer…"
              value={searchDraft}
            />
            <button className="sr-only" type="submit">
              Search
            </button>
          </form>
          <select
            aria-label="Filter orders by status"
            onChange={(event) =>
              setParams((current) => ({
                ...current,
                status: event.target.value,
                page: 1,
              }))
            }
            value={params.status}
          >
            <option value="">All statuses</option>
            {Object.keys(transitions).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Toolbar>
        <LoadState
          loading={orders.loading}
          error={orders.error}
          onRetry={() => setRefreshKey((key) => key + 1)}
        />
        {!orders.loading && !orders.error && rows.length === 0 && (
          <EmptyState
            title="No orders yet"
            description="Create an order and it will appear here with its status and history."
            action={
              <button
                className="button button-primary"
                disabled={saving}
                onClick={startOrder}
                type="button"
              >
                Create an order
              </button>
            }
          />
        )}
        {!orders.loading && !orders.error && rows.length > 0 && (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Placed</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">View</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => (
                    <tr key={order._id}>
                      <td>
                        <button
                          className="text-button mono-text"
                          onClick={() => showOrder(order)}
                          type="button"
                        >
                          {order.orderNumber}
                        </button>
                      </td>
                      <td>
                        {order.customer?.name ??
                          order.customerSnapshot?.name ??
                          "—"}
                      </td>
                      <td>{date(order.createdAt)}</td>
                      <td>
                        {order.items.reduce(
                          (sum, item) => sum + item.quantity,
                          0,
                        )}{" "}
                        items
                      </td>
                      <td className="price-cell">{money(order.total)}</td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td>
                        <button
                          className="button button-small button-quiet"
                          onClick={() => showOrder(order)}
                          type="button"
                        >
                          Details →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={orders.data.pagination.page}
              pages={orders.data.pagination.pages}
              onChange={(page) =>
                setParams((current) => ({ ...current, page }))
              }
            />
          </>
        )}
      </section>
      {modal === "create" && (
        <Modal
          title="Create an order"
          description="Choose a customer and available products. Prices are confirmed by the server."
          onClose={() => setModal("")}
          wide
        >
          <form className="modal-form" onSubmit={submitOrder}>
            {actionError && (
              <div className="inline-error" role="alert">
                {actionError}
              </div>
            )}
            <Field label="Customer">
              <select
                onChange={(event) =>
                  setOrderForm({ ...orderForm, customerId: event.target.value })
                }
                required
                value={orderForm.customerId}
              >
                <option value="">Choose a customer</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.name}
                    {customer.email ? ` · ${customer.email}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {customers.length === 0 && (
              <p className="form-note">
                Add a customer first in the Customers section.
              </p>
            )}
            <div className="order-items-heading">
              <b>Order items</b>
              <button
                className="text-button"
                onClick={() =>
                  setOrderForm({
                    ...orderForm,
                    items: [...orderForm.items, { productId: "", quantity: 1 }],
                  })
                }
                type="button"
              >
                ＋ Add another item
              </button>
            </div>
            {orderForm.items.map((item, index) => (
              <div className="order-item-row" key={index}>
                <select
                  aria-label={`Product ${index + 1}`}
                  onChange={(event) =>
                    editItem(index, "productId", event.target.value)
                  }
                  required
                  value={item.productId}
                >
                  <option value="">Choose a product</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name} · {product.stock} available ·{" "}
                      {money(product.price)}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Quantity ${index + 1}`}
                  max={
                    products.find((product) => product._id === item.productId)
                      ?.stock ?? 1
                  }
                  min="1"
                  onChange={(event) =>
                    editItem(index, "quantity", event.target.value)
                  }
                  required
                  type="number"
                  value={item.quantity}
                />
                <button
                  aria-label="Remove item"
                  className="icon-button icon-danger"
                  disabled={orderForm.items.length === 1}
                  onClick={() =>
                    setOrderForm({
                      ...orderForm,
                      items: orderForm.items.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    })
                  }
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
            <div className="order-estimate">
              <span>Estimated total</span>
              <strong>{money(estimatedTotal)}</strong>
              <small>
                Final total is calculated from trusted product prices by the
                server.
              </small>
            </div>
            <FormActions
              onCancel={() => setModal("")}
              saving={saving}
              submitLabel="Place order"
            />
          </form>
        </Modal>
      )}
      {modal === "details" && selected && (
        <Modal
          title={`Order ${selected.orderNumber}`}
          description={`Placed ${date(selected.createdAt)} · ${selected.customerSnapshot?.name ?? selected.customer?.name ?? "Customer"}`}
          onClose={() => setModal("")}
          wide
        >
          <div className="order-detail">
            <div className="order-detail-top">
              <StatusBadge status={selected.status} />
              <strong>{money(selected.total)}</strong>
            </div>
            <div className="table-scroll">
              <table className="data-table compact-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map((item) => (
                    <tr key={item.product}>
                      <td>{item.name}</td>
                      <td className="mono-text">{item.sku}</td>
                      <td>{item.quantity}</td>
                      <td>{money(item.unitPrice)}</td>
                      <td>{money(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="order-history">
              <h3>Order history</h3>
              {(selected.statusHistory ?? []).map((entry, index) => (
                <div
                  className="history-row"
                  key={`${entry.changedAt}-${index}`}
                >
                  <span
                    className={`history-dot history-${entry.status.toLowerCase()}`}
                  />
                  <div>
                    <b>{entry.status}</b>
                    <small>
                      {date(entry.changedAt)} ·{" "}
                      {entry.changedBy?.name ?? "Team member"}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </small>
                  </div>
                </div>
              ))}
            </div>
            <div className="order-actions">
              {(transitions[selected.status] ?? []).map((status) => (
                <button
                  className={`button ${status === "Cancelled" ? "button-danger" : status === "Completed" ? "button-primary" : "button-outline"}`}
                  key={status}
                  onClick={() => updateStatus(status)}
                  type="button"
                >
                  {status === "Cancelled"
                    ? "Cancel order"
                    : `Mark ${status.toLowerCase()}`}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

const blankCustomer = { name: "", email: "", phone: "", address: "" };

export function CustomersScreen({ token, onNotify }) {
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(blankCustomer);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const customers = useLoad(
    token,
    "/customers",
    { search, page: 1, limit: 50 },
    refreshKey,
  );
  const rows = customers.data?.customers ?? [];

  function startForm(customer) {
    setSelected(customer ?? null);
    setForm(
      customer
        ? {
            name: customer.name,
            email: customer.email ?? "",
            phone: customer.phone ?? "",
            address: customer.address ?? "",
          }
        : blankCustomer,
    );
    setActionError("");
    setModal(customer ? "edit" : "create");
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    try {
      await request(selected ? `/customers/${selected._id}` : "/customers", {
        token,
        method: selected ? "PATCH" : "POST",
        body: form,
      });
      setModal("");
      setRefreshKey((key) => key + 1);
      onNotify(selected ? "Customer updated" : "Customer added");
    } catch (error) {
      setActionError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function showHistory(customer) {
    try {
      const [customerResult, ordersResult] = await Promise.all([
        request(`/customers/${customer._id}`, { token }),
        request(`/customers/${customer._id}/orders?limit=100`, { token }),
      ]);
      setSelected({ ...customerResult.customer, orders: ordersResult.orders });
      setModal("details");
    } catch (error) {
      onNotify(error.message, "error");
    }
  }

  async function remove(customer) {
    if (!window.confirm(`Delete ${customer.name}?`)) return;
    try {
      await request(`/customers/${customer._id}`, { token, method: "DELETE" });
      setRefreshKey((key) => key + 1);
      onNotify("Customer deleted");
    } catch (error) {
      onNotify(error.message, "error");
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="PEOPLE"
        title="Customers"
        description="Know who you serve and see the orders behind every relationship."
        action={
          <button
            className="button button-primary"
            onClick={() => startForm()}
            type="button"
          >
            ＋ Add customer
          </button>
        }
      />
      <section className="panel">
        <Toolbar>
          <form
            className="search-control"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchDraft);
            }}
          >
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search customers"
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search name, email or phone…"
              value={searchDraft}
            />
            <button className="sr-only" type="submit">
              Search
            </button>
          </form>
        </Toolbar>
        <LoadState
          loading={customers.loading}
          error={customers.error}
          onRetry={() => setRefreshKey((key) => key + 1)}
        />
        {!customers.loading && !customers.error && rows.length === 0 && (
          <EmptyState
            title="No customers found"
            description={
              search
                ? "Try another search or clear the filter."
                : "Add a customer before creating an order."
            }
            action={
              <button
                className="button button-primary"
                onClick={() => startForm()}
                type="button"
              >
                Add customer
              </button>
            }
          />
        )}
        {!customers.loading && !customers.error && rows.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Added</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer._id}>
                    <td>
                      <div className="table-product">
                        <span className="avatar avatar-small">
                          {initials(customer.name)}
                        </span>
                        <b>{customer.name}</b>
                      </div>
                    </td>
                    <td>{customer.email || "—"}</td>
                    <td>{customer.phone || "—"}</td>
                    <td className="muted">{customer.address || "—"}</td>
                    <td className="muted">{date(customer.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="button button-small button-quiet"
                          onClick={() => showHistory(customer)}
                          type="button"
                        >
                          Orders
                        </button>
                        <button
                          aria-label={`Edit ${customer.name}`}
                          className="icon-button"
                          onClick={() => startForm(customer)}
                          type="button"
                        >
                          ✎
                        </button>
                        <button
                          aria-label={`Delete ${customer.name}`}
                          className="icon-button icon-danger"
                          onClick={() => remove(customer)}
                          type="button"
                        >
                          ⌫
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {(modal === "create" || modal === "edit") && (
        <Modal
          title={selected ? "Edit customer" : "Add a customer"}
          description="Provide at least one contact method: email or phone."
          onClose={() => setModal("")}
        >
          <form className="modal-form" onSubmit={submit}>
            {actionError && (
              <div className="inline-error" role="alert">
                {actionError}
              </div>
            )}
            <Field label="Full name">
              <input
                maxLength="150"
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                required
                value={form.name}
              />
            </Field>
            <Field label="Email">
              <input
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                placeholder="name@company.com"
                type="email"
                value={form.email}
              />
            </Field>
            <Field label="Phone">
              <input
                maxLength="40"
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                placeholder="+1 (555) 000-0000"
                type="tel"
                value={form.phone}
              />
            </Field>
            <Field label="Address">
              <textarea
                maxLength="500"
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
                rows="3"
                value={form.address}
              />
            </Field>
            <FormActions
              onCancel={() => setModal("")}
              saving={saving}
              submitLabel={selected ? "Save customer" : "Add customer"}
            />
          </form>
        </Modal>
      )}
      {modal === "details" && selected && (
        <Modal
          title={selected.name}
          description={selected.email || selected.phone || "Customer"}
          onClose={() => setModal("")}
          wide
        >
          <div className="customer-history">
            <h3>
              Order history{" "}
              <span className="count-pill">{selected.orders.length}</span>
            </h3>
            {selected.orders.length ? (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Date</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.orders.map((order) => (
                      <tr key={order._id}>
                        <td className="mono-text">{order.orderNumber}</td>
                        <td>{date(order.createdAt)}</td>
                        <td>
                          {order.items.reduce(
                            (sum, item) => sum + item.quantity,
                            0,
                          )}
                        </td>
                        <td>{money(order.total)}</td>
                        <td>
                          <StatusBadge status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">
                No orders have been placed for this customer yet.
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

export function ProfileScreen({ token, onNotify, onProfileUpdated }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useLoad(token, "/users/me", {}, refreshKey);

  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT"
        title="My profile"
        description="Update your account details and password."
      />
      <LoadState
        loading={loading}
        error={error}
        onRetry={() => setRefreshKey((key) => key + 1)}
      />
      {!loading && !error && data?.user && (
        <ProfileForm
          key={data.user.id}
          onNotify={onNotify}
          onProfileUpdated={onProfileUpdated}
          token={token}
          user={data.user}
        />
      )}
    </>
  );
}

function ProfileForm({ token, user, onNotify, onProfileUpdated }) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    currentPassword: "",
    newPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    const body = { name: form.name, email: form.email };
    if (form.newPassword) {
      body.currentPassword = form.currentPassword;
      body.newPassword = form.newPassword;
    }
    try {
      const result = await request("/users/me", {
        token,
        method: "PATCH",
        body,
      });
      onProfileUpdated(result.user);
      setForm((current) => ({
        ...current,
        currentPassword: "",
        newPassword: "",
      }));
      onNotify("Profile updated");
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel profile-panel">
      <form className="modal-form" onSubmit={submit}>
        {actionError && (
          <div className="inline-error" role="alert">
            {actionError}
          </div>
        )}
        <Field label="Full name">
          <input
            autoComplete="name"
            maxLength="100"
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
            value={form.name}
          />
        </Field>
        <Field label="Email">
          <input
            autoComplete="email"
            maxLength="254"
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            required
            type="email"
            value={form.email}
          />
        </Field>
        <Field label="Current password">
          <input
            autoComplete="current-password"
            onChange={(event) =>
              setForm({ ...form, currentPassword: event.target.value })
            }
            type="password"
            value={form.currentPassword}
          />
        </Field>
        <Field label="New password">
          <input
            autoComplete="new-password"
            minLength="8"
            onChange={(event) =>
              setForm({ ...form, newPassword: event.target.value })
            }
            type="password"
            value={form.newPassword}
          />
          <small>
            Leave password fields empty to keep your current password.
          </small>
        </Field>
        <div className="form-actions">
          <button
            className="button button-primary"
            disabled={saving}
            type="submit"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </section>
  );
}

function MetricCard({ label, value, detail, tone, symbol }) {
  return (
    <article className={`stat-card ${tone}`}>
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-symbol">{symbol}</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function DashboardCard({ label, value, detail, icon, onClick, tone = "" }) {
  return (
    <button className={`summary-card ${tone}`} onClick={onClick} type="button">
      <span className="summary-card-top">
        <span>{label}</span>
        <span aria-hidden="true">{icon}</span>
      </span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </button>
  );
}

export function DashboardSummaryScreen({ token, onNavigate }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useLoad(token, "/dashboard", {}, refreshKey);
  const inventory = data?.inventory ?? {};
  const orders = data?.orders ?? {};
  const sales = data?.sales ?? {};
  const byStatus = orders.byStatus ?? {};
  const monthlySales = sales.monthly ?? [];
  const maxSales = Math.max(...monthlySales.map((item) => item.sales), 0);

  return (
    <section className="dashboard-summary">
      <header className="inventory-welcome">
        <div>
          <span className="eyebrow">BUSINESS AT A GLANCE</span>
          <h1>Dashboard</h1>
          <p>Summary of workspace inventory, orders, and completed sales.</p>
        </div>
        <button
          className="button button-outline"
          disabled={loading}
          onClick={() => setRefreshKey((current) => current + 1)}
          type="button"
        >
          ↻ Refresh
        </button>
      </header>

      <LoadState
        loading={loading}
        error={error}
        onRetry={() => setRefreshKey((current) => current + 1)}
      />

      {!loading && !error && (
        <>
          <div className="summary-card-grid">
            <DashboardCard
              label="Products"
              value={inventory.productCount ?? 0}
              detail="Across the workspace"
              icon="▦"
              onClick={() => onNavigate("products")}
            />
            <DashboardCard
              label="Categories"
              value={inventory.categoryCount ?? 0}
              detail="In the catalog"
              icon="▧"
              onClick={() => onNavigate("categories")}
              tone="summary-card-sage"
            />
            <DashboardCard
              label="Customers"
              value={data?.customers?.total ?? 0}
              detail="Customer records"
              icon="◉"
              onClick={() => onNavigate("customers")}
              tone="summary-card-blue"
            />
            <DashboardCard
              label="Total orders"
              value={orders.total ?? 0}
              detail="Across the workspace"
              icon="▤"
              onClick={() => onNavigate("orders")}
              tone="summary-card-lilac"
            />
            <DashboardCard
              label="Pending orders"
              value={byStatus.Pending ?? 0}
              detail="Waiting to be processed"
              icon="◷"
              onClick={() => onNavigate("orders")}
              tone="summary-card-amber"
            />
            <DashboardCard
              label="Completed orders"
              value={byStatus.Completed ?? 0}
              detail="Successfully completed"
              icon="✓"
              onClick={() => onNavigate("orders")}
              tone="summary-card-sage"
            />
            <DashboardCard
              label="Completed sales"
              value={money(sales.revenue)}
              detail={`${sales.completedOrderCount ?? 0} completed orders`}
              icon="$"
              onClick={() => onNavigate("orders")}
              tone="summary-card-blue"
            />
            <DashboardCard
              label="Low / out of stock"
              value={`${inventory.lowStockCount ?? 0} / ${inventory.outOfStockCount ?? 0}`}
              detail={`Low stock is ${inventory.lowStockThreshold ?? 5} units or less`}
              icon="!"
              onClick={() => onNavigate("stock-activity")}
              tone="summary-card-amber"
            />
          </div>

          <div className="dashboard-report-grid">
            <section
              aria-labelledby="sales-trend-title"
              className="report-card"
            >
              <header className="report-card-heading">
                <div>
                  <h2 id="sales-trend-title">Sales trend</h2>
                  <p>Completed orders · last 6 months</p>
                </div>
                <strong>{money(sales.currentMonth)}</strong>
              </header>
              <div
                aria-label="Monthly completed sales chart"
                className="sales-chart"
                role="img"
              >
                {monthlySales.map((month) => {
                  const barHeight =
                    maxSales > 0
                      ? Math.max(
                          (month.sales / maxSales) * 100,
                          month.sales > 0 ? 5 : 0,
                        )
                      : 0;
                  return (
                    <div className="sales-chart-column" key={month.month}>
                      <span className="sales-chart-value">
                        {money(month.sales)}
                      </span>
                      <div className="sales-chart-track">
                        <div
                          className="sales-chart-bar"
                          style={{ height: `${barHeight}%` }}
                        />
                      </div>
                      <span className="sales-chart-label">{month.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="sales-month-comparison">
                <span>{sales.currentMonthLabel ?? "This month"} sales</span>
                <strong>{money(sales.currentMonth)}</strong>
                <span>{sales.previousMonthLabel ?? "Last month"} sales</span>
                <strong>{money(sales.previousMonth)}</strong>
              </div>
            </section>

            <section
              aria-labelledby="best-selling-title"
              className="report-card"
            >
              <header className="report-card-heading">
                <div>
                  <h2 id="best-selling-title">Best-selling products</h2>
                  <p>Ranked by quantity in completed orders</p>
                </div>
              </header>
              {data.bestSellingProducts?.length ? (
                <ol className="best-seller-list">
                  {data.bestSellingProducts.map((product, index) => (
                    <li key={`${product._id ?? product.sku}-${index}`}>
                      <span className="best-seller-rank">{index + 1}</span>
                      <span className="best-seller-name">
                        <b>{product.name}</b>
                        <small>{product.sku}</small>
                      </span>
                      <span className="best-seller-quantity">
                        {product.quantitySold} sold
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState
                  title="No completed sales yet"
                  description="Products will show here after orders are completed."
                />
              )}
            </section>
          </div>

          <section
            aria-labelledby="recent-orders-title"
            className="report-card recent-orders-card"
          >
            <header className="report-card-heading">
              <div>
                <h2 id="recent-orders-title">Recent orders</h2>
                <p>Latest orders across the workspace.</p>
              </div>
              <button
                className="text-button"
                onClick={() => onNavigate("orders")}
                type="button"
              >
                View orders →
              </button>
            </header>
            {data.recentOrders?.length ? (
              <div className="recent-orders-list">
                {data.recentOrders.map((order) => (
                  <button
                    className="dashboard-order-row"
                    key={order._id}
                    onClick={() => onNavigate("orders")}
                    type="button"
                  >
                    <span className="dashboard-order-primary">
                      <b>
                        {order.customer?.name ??
                          order.customerSnapshot?.name ??
                          "Customer"}
                      </b>
                      <small>
                        {order.orderNumber} · {date(order.createdAt)}
                      </small>
                    </span>
                    <span className="dashboard-order-total">
                      <b>{money(order.total)}</b>
                      <StatusBadge status={order.status} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No orders yet"
                description="New orders will appear here."
                action={
                  <button
                    className="button button-outline"
                    onClick={() => onNavigate("orders")}
                    type="button"
                  >
                    Open orders
                  </button>
                }
              />
            )}
          </section>
        </>
      )}
    </section>
  );
}

export function DashboardScreen({ token, onNavigate }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useLoad(token, "/dashboard", {}, refreshKey);
  const summary = data ?? {};
  const recentOrders = summary.recentOrders ?? [];
  const inventory = summary.inventory ?? {};
  const orderStats = summary.orders ?? {};

  return (
    <>
      <PageHeading
        eyebrow="OVERVIEW"
        title="Good morning"
        description="Here’s the latest from your operations."
        action={
          <button
            className="button button-outline"
            onClick={() => setRefreshKey((key) => key + 1)}
            type="button"
          >
            ↻ Refresh
          </button>
        }
      />
      {loading && (
        <div className="loading-state">
          <span className="spinner" /> Gathering your latest numbers…
        </div>
      )}
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      {!loading && !error && (
        <>
          <div className="stats-grid">
            <MetricCard
              label="Products"
              value={inventory.productCount ?? 0}
              detail="Items in your catalog"
              tone="stat-sage"
              symbol="▦"
            />
            <MetricCard
              label="Low stock"
              value={inventory.lowStockCount ?? 0}
              detail={`At or below ${inventory.lowStockThreshold ?? inventory.threshold ?? 5} units`}
              tone="stat-amber"
              symbol="⌁"
            />
            <MetricCard
              label="Open orders"
              value={
                (orderStats.byStatus?.Pending ?? 0) +
                (orderStats.byStatus?.Processing ?? 0)
              }
              detail="Pending or being processed"
              tone="stat-blue"
              symbol="↗"
            />
            <MetricCard
              label="Completed sales"
              value={money(summary.sales?.revenue)}
              detail={`${summary.sales?.completedOrderCount ?? 0} completed orders`}
              tone="stat-lilac"
              symbol="$"
            />
          </div>
          <div className="dashboard-grid">
            <section className="panel dashboard-orders">
              <div className="panel-heading">
                <div>
                  <h2>Recent orders</h2>
                  <p>The latest activity from your team.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => onNavigate("orders")}
                  type="button"
                >
                  View all →
                </button>
              </div>
              {recentOrders.length === 0 ? (
                <EmptyState
                  title="No orders to show"
                  description="New customer orders will appear here."
                  action={
                    <button
                      className="button button-outline"
                      onClick={() => onNavigate("orders")}
                      type="button"
                    >
                      Open orders
                    </button>
                  }
                />
              ) : (
                <div className="recent-list">
                  {recentOrders.slice(0, 5).map((order) => (
                    <button
                      className="recent-order"
                      key={order._id}
                      onClick={() => onNavigate("orders")}
                      type="button"
                    >
                      <span className="recent-order-icon">↗</span>
                      <span className="recent-order-main">
                        <b>
                          {order.customer?.name ??
                            order.customerSnapshot?.name ??
                            "Customer"}
                        </b>
                        <small>
                          {order.orderNumber} · {date(order.createdAt)}
                        </small>
                      </span>
                      <span className="recent-order-end">
                        <b>{money(order.total)}</b>
                        <StatusBadge status={order.status} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section className="panel quick-actions">
              <div className="panel-heading">
                <div>
                  <h2>Quick actions</h2>
                  <p>Jump right into the work.</p>
                </div>
              </div>
              <button
                className="quick-action"
                onClick={() => onNavigate("products")}
                type="button"
              >
                <span className="quick-action-icon quick-icon-green">▦</span>
                <span>
                  <b>Browse products</b>
                  <small>Find an item in your catalog</small>
                </span>
                <span className="quick-arrow">→</span>
              </button>
              <button
                className="quick-action"
                onClick={() => onNavigate("inventory")}
                type="button"
              >
                <span className="quick-action-icon quick-icon-orange">⌁</span>
                <span>
                  <b>Check inventory</b>
                  <small>Review stock and movements</small>
                </span>
                <span className="quick-arrow">→</span>
              </button>
              <button
                className="quick-action"
                onClick={() => onNavigate("customers")}
                type="button"
              >
                <span className="quick-action-icon quick-icon-blue">◉</span>
                <span>
                  <b>View customers</b>
                  <small>Keep customer records up to date</small>
                </span>
                <span className="quick-arrow">→</span>
              </button>
            </section>
          </div>
        </>
      )}
    </>
  );
}
