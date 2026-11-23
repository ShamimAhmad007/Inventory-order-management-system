import Category from "../models/category.js";
import Customer from "../models/customer.js";
import Order from "../models/order.js";
import Product from "../models/product.js";

function getLowStockThreshold() {
  const configured = Number.parseInt(process.env.LOW_STOCK_THRESHOLD, 10);
  return Number.isInteger(configured) && configured >= 0 ? configured : 5;
}

function roundMoney(value) {
  return Number((value ?? 0).toFixed(2));
}
export async function getDashboardSummary(req, res) {
  const productFilter = {
    archivedAt: null,
  };
  const orderFilter = {};
  const threshold = getLowStockThreshold();
  const now = new Date();
  const currentMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const previousMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const trendStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
  );

  const [
    productStats,
    categoryCount,
    customerCount,
    orderCounts,
    completedStats,
    monthlySalesRows,
    recentOrders,
    bestSellingProducts,
    lowStockCount,
    outOfStockCount,
  ] = await Promise.all([
    Product.aggregate([
      { $match: productFilter },
      {
        $group: {
          _id: null,
          productCount: { $sum: 1 },
          stockUnits: { $sum: "$stock" },
          inventoryValue: { $sum: { $multiply: ["$stock", "$price"] } },
        },
      },
    ]),
    Category.countDocuments(),
    Customer.countDocuments(),
    Order.aggregate([
      { $match: orderFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $match: { ...orderFilter, status: "Completed" } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total" },
          completedOrderCount: { $sum: 1 },
          currentMonthSales: {
            $sum: {
              $cond: [{ $gte: ["$createdAt", currentMonthStart] }, "$total", 0],
            },
          },
          previousMonthSales: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$createdAt", previousMonthStart] },
                    { $lt: ["$createdAt", currentMonthStart] },
                  ],
                },
                "$total",
                0,
              ],
            },
          },
        },
      },
    ]),
    Order.aggregate([
      {
        $match: {
          ...orderFilter,
          status: "Completed",
          createdAt: { $gte: trendStart, $lte: now },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$createdAt",
              timezone: "UTC",
            },
          },
          sales: { $sum: "$total" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Order.find(orderFilter)
      .populate("customer", "name")
      .populate("createdBy", "name")
      .sort({ createdAt: -1, _id: -1 })
      .limit(5),
    Order.aggregate([
      { $match: { ...orderFilter, status: "Completed" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $first: "$items.name" },
          sku: { $first: "$items.sku" },
          quantitySold: { $sum: "$items.quantity" },
          sales: { $sum: "$items.lineTotal" },
        },
      },
      { $sort: { quantitySold: -1, name: 1 } },
      { $limit: 5 },
    ]),
    Product.countDocuments({
      ...productFilter,
      stock: { $gt: 0, $lte: threshold },
    }),
    Product.countDocuments({ ...productFilter, stock: 0 }),
  ]);

  const statusCounts = Object.fromEntries(
    orderCounts.map(({ _id, count }) => [_id, count]),
  );
  const currentMonthKey = `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
  const previousMonthDate = new Date(previousMonthStart);
  const previousMonthKey = `${previousMonthDate.getUTCFullYear()}-${String(
    previousMonthDate.getUTCMonth() + 1,
  ).padStart(2, "0")}`;
  const salesByMonth = new Map(monthlySalesRows.map((row) => [row._id, row]));
  const monthlySales = [];
  for (let offset = 0; offset < 6; offset += 1) {
    const month = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + offset, 1),
    );
    const key = `${month.getUTCFullYear()}-${String(
      month.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    const row = salesByMonth.get(key);
    monthlySales.push({
      month: key,
      label: new Intl.DateTimeFormat("en", {
        month: "short",
        timeZone: "UTC",
      }).format(month),
      sales: roundMoney(row?.sales),
      orderCount: row?.orderCount ?? 0,
    });
  }
  const completed = completedStats[0] ?? {};
  const monthLabel = (month) => {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
  };

  return res.json({
    success: true,
    inventory: {
      productCount: productStats[0]?.productCount ?? 0,
      categoryCount,
      stockUnits: productStats[0]?.stockUnits ?? 0,
      inventoryValue: roundMoney(productStats[0]?.inventoryValue),
      lowStockCount,
      outOfStockCount,
      lowStockThreshold: threshold,
    },
    customers: { total: customerCount },
    orders: {
      total: Object.values(statusCounts).reduce(
        (total, count) => total + count,
        0,
      ),
      byStatus: {
        Pending: statusCounts.Pending ?? 0,
        Processing: statusCounts.Processing ?? 0,
        Completed: statusCounts.Completed ?? 0,
        Cancelled: statusCounts.Cancelled ?? 0,
      },
    },
    sales: {
      completedOrderCount: completed.completedOrderCount ?? 0,
      revenue: roundMoney(completed.revenue),
      currentMonth: roundMoney(completed.currentMonthSales),
      previousMonth: roundMoney(completed.previousMonthSales),
      currentMonthLabel: monthLabel(currentMonthKey),
      previousMonthLabel: monthLabel(previousMonthKey),
      monthly: monthlySales,
    },
    recentOrders,
    bestSellingProducts,
  });
}
