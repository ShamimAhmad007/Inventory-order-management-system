import "dotenv/config";
import mongoose from "mongoose";

const indexChanges = [
  {
    collection: "products",
    legacyName: "sku_1",
    name: "owner_1_sku_1",
    keys: { owner: 1, sku: 1 },
  },
  {
    collection: "categories",
    legacyName: "name_1",
    name: "owner_1_name_1",
    keys: { owner: 1, name: 1 },
  },
  {
    collection: "customers",
    legacyName: "email_1",
    name: "owner_1_email_1",
    keys: { owner: 1, email: 1 },
    partialFilterExpression: { email: { $type: "string" } },
  },
  {
    collection: "customers",
    legacyName: "phone_1",
    name: "owner_1_phone_1",
    keys: { owner: 1, phone: 1 },
    partialFilterExpression: { phone: { $type: "string" } },
  },
  {
    collection: "orders",
    legacyName: "orderNumber_1",
    name: "createdBy_1_orderNumber_1",
    keys: { createdBy: 1, orderNumber: 1 },
  },
];

async function ensureTenantIndex(change) {
  const collection = mongoose.connection.collection(change.collection);
  const indexes = await collection.indexes();
  const tenantIndex = indexes.find((index) => index.name === change.name);

  if (
    tenantIndex &&
    (!tenantIndex.unique ||
      JSON.stringify(tenantIndex.key) !== JSON.stringify(change.keys) ||
      JSON.stringify(tenantIndex.partialFilterExpression ?? null) !==
        JSON.stringify(change.partialFilterExpression ?? null))
  ) {
    throw new Error(
      `Index ${change.name} on ${change.collection} does not match the expected definition`,
    );
  }

  if (!tenantIndex) {
    await collection.createIndex(change.keys, {
      name: change.name,
      unique: true,
      ...(change.partialFilterExpression
        ? { partialFilterExpression: change.partialFilterExpression }
        : {}),
    });
  } else if (!tenantIndex.unique) {
    throw new Error(
      `Index ${change.name} on ${change.collection} exists but is not unique`,
    );
  }

  const legacyIndex = indexes.find((index) => index.name === change.legacyName);
  if (legacyIndex) {
    const keyNames = Object.keys(legacyIndex.key);
    if (
      !legacyIndex.unique ||
      keyNames.length !== 1 ||
      keyNames[0] !== Object.keys(change.keys)[
        Object.keys(change.keys).length - 1
      ]
    ) {
      throw new Error(
        `Refusing to drop unexpected index ${change.legacyName} on ${change.collection}`,
      );
    }
    await collection.dropIndex(change.legacyName);
  }

  console.log(`Updated tenant-scoped index on ${change.collection}`);
}

async function main() {
  if (!process.env.DB) {
    throw new Error("DB is not configured");
  }
  await mongoose.connect(process.env.DB);
  for (const change of indexChanges) {
    await ensureTenantIndex(change);
  }
}

try {
  await main();
} catch (error) {
  console.error("Tenant index migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
