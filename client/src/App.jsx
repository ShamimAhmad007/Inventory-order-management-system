import { useCallback, useEffect, useState } from "react";
import AuthScreen from "./components/AuthScreen.jsx";
import {
  CategoriesScreen,
  CustomersScreen,
  DashboardSummaryScreen,
  InventoryScreen,
  OrdersScreen,
  ProfileScreen,
  ProductsScreen,
  SimpleInventoryScreen,
} from "./components/Screens.jsx";
import { request } from "./lib/api.js";

const authStorageKey = "northstar-session";

function readStoredSession() {
  try {
    const value = localStorage.getItem(authStorageKey);
    return value ? JSON.parse(value) : null;
  } catch {
    localStorage.removeItem(authStorageKey);
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState(readStoredSession);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");
  const [notification, setNotification] = useState(null);
  const [apiState, setApiState] = useState("checking");
  const clearSession = useCallback(() => {
    localStorage.removeItem(authStorageKey);
    setSession(null);
    setActivePage("dashboard");
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setNotification({
        message: "Your session expired. Please sign in again.",
        type: "error",
      });
    };
    window.addEventListener("iom:unauthorized", onUnauthorized);
    return () => window.removeEventListener("iom:unauthorized", onUnauthorized);
  }, [clearSession]);

  // useEffect(() => {
  //   let active = true;
  //   request("/")
  //     .then(() => {
  //       if (active) setApiState("online");
  //     })
  //     .catch(() => {
  //       if (active) setApiState("offline");
  //     });
  //   return () => {
  //     active = false;
  //   };
  // }, []);

  useEffect(() => {
    if (!notification) return undefined;
    const timeout = window.setTimeout(() => setNotification(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notification]);

  const notify = useCallback((message, type = "success") => {
    setNotification({ message, type });
  }, []);

  function authenticate(nextSession) {
    localStorage.setItem(authStorageKey, JSON.stringify(nextSession));
    setSession(nextSession);
    setActivePage("dashboard");
    notify(`Welcome, ${nextSession.user.name.split(" ")[0]}`);
  }

  async function signOut() {
    try {
      await request("/auth/logout", { token: session.token, method: "POST" });
    } catch (error) {
      if (error.status !== 401) notify(error.message, "error");
    } finally {
      clearSession();
    }
  }

  if (!session?.token || !session?.user) {
    return (
      <>
        <AuthScreen onAuthenticated={authenticate} />
        {notification && (
          <div className={`toast toast-${notification.type}`} role="status">
            {notification.message}
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className={`inventory-shell ${mobileNavOpen ? "inventory-nav-open" : ""}`}
    >
      <button
        aria-label="Close navigation"
        className="inventory-mobile-scrim"
        onClick={() => setMobileNavOpen(false)}
        type="button"
      />
      <aside className="inventory-sidebar">
        <a
          aria-label="Northstar Supply home"
          className="brand-lockup inventory-brand"
          href="#"
        >
          <span className="brand-mark">N</span>
          <span>
            Northstar <b>Supply</b>
          </span>
        </a>
        <nav aria-label="Main navigation" className="inventory-navigation">
          <span className="inventory-nav-label">WORKSPACE</span>
          <button
            aria-current={activePage === "dashboard" ? "page" : undefined}
            className={`inventory-nav-link ${activePage === "dashboard" ? "inventory-nav-link-active" : ""}`}
            onClick={() => {
              setActivePage("dashboard");
              setMobileNavOpen(false);
            }}
            type="button"
          >
            <span aria-hidden="true">▤</span> Dashboard
          </button>
          <span className="inventory-nav-label">CATALOG</span>
          <button
            aria-current={activePage === "products" ? "page" : undefined}
            className={`inventory-nav-link ${activePage === "products" ? "inventory-nav-link-active" : ""}`}
            onClick={() => {
              setActivePage("products");
              setMobileNavOpen(false);
            }}
            type="button"
          >
            <span aria-hidden="true">▦</span> Products
          </button>
          <button
            aria-current={activePage === "categories" ? "page" : undefined}
            className={`inventory-nav-link ${activePage === "categories" ? "inventory-nav-link-active" : ""}`}
            onClick={() => {
              setActivePage("categories");
              setMobileNavOpen(false);
            }}
            type="button"
          >
            <span aria-hidden="true">▧</span> Categories
          </button>
          <span className="inventory-nav-label">OPERATIONS</span>
          <button
            aria-current={activePage === "inventory" ? "page" : undefined}
            className={`inventory-nav-link ${activePage === "inventory" ? "inventory-nav-link-active" : ""}`}
            onClick={() => {
              setActivePage("inventory");
              setMobileNavOpen(false);
            }}
            type="button"
          >
            <span aria-hidden="true">▦</span> Inventory
          </button>
          <button
            aria-current={activePage === "stock-activity" ? "page" : undefined}
            className={`inventory-nav-link ${activePage === "stock-activity" ? "inventory-nav-link-active" : ""}`}
            onClick={() => {
              setActivePage("stock-activity");
              setMobileNavOpen(false);
            }}
            type="button"
          >
            <span aria-hidden="true">⌁</span> Stock activity
          </button>
          <button
            aria-current={activePage === "orders" ? "page" : undefined}
            className={`inventory-nav-link ${activePage === "orders" ? "inventory-nav-link-active" : ""}`}
            onClick={() => {
              setActivePage("orders");
              setMobileNavOpen(false);
            }}
            type="button"
          >
            <span aria-hidden="true">▤</span> Orders
          </button>
          <button
            aria-current={activePage === "customers" ? "page" : undefined}
            className={`inventory-nav-link ${activePage === "customers" ? "inventory-nav-link-active" : ""}`}
            onClick={() => {
              setActivePage("customers");
              setMobileNavOpen(false);
            }}
            type="button"
          >
            <span aria-hidden="true">◉</span> Customers
          </button>
          <span className="inventory-nav-label">ACCOUNT</span>
          <button
            aria-current={activePage === "profile" ? "page" : undefined}
            className={`inventory-nav-link ${activePage === "profile" ? "inventory-nav-link-active" : ""}`}
            onClick={() => {
              setActivePage("profile");
              setMobileNavOpen(false);
            }}
            type="button"
          >
            <span aria-hidden="true">◉</span> My profile
          </button>
        </nav>
        <div className="inventory-sidebar-footer">
          <span>© 2026 Northstar Supply</span>
          <span className={`connection-state connection-${apiState}`}>
            <i /> API{" "}
            {apiState === "online"
              ? "connected"
              : apiState === "offline"
                ? "offline"
                : "checking"}
          </span>
        </div>
      </aside>

      <div className="inventory-main">
        <header className="inventory-topbar">
          <button
            aria-label="Open navigation"
            className="inventory-menu-button"
            onClick={() => setMobileNavOpen(true)}
            type="button"
          >
            ☰
          </button>
          <div className="inventory-account">
            <span className="inventory-account-avatar">
              {session.user.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <b>{session.user.name}</b>
              {/* <small>{session.user.staff}</small> */}
            </span>
            <button
              aria-label="Sign out"
              className="text-white border-round text-bold rounded-2xl p-2 bg-red-600 hover:bg-red-700 focus:ring-red-500"
              onClick={signOut}
              title="Sign out"
              type="button"
            >
              Log out
            </button>
          </div>
        </header>

        <main className="inventory-page">
          {activePage === "dashboard" ? (
            <DashboardSummaryScreen
              onNavigate={setActivePage}
              token={session.token}
            />
          ) : activePage === "inventory" ? (
            <SimpleInventoryScreen
              onNotify={notify}
              token={session.token}
            />
          ) : activePage === "products" ? (
            <ProductsScreen
              onNotify={notify}
              token={session.token}
            />
          ) : activePage === "categories" ? (
            <CategoriesScreen
              onNotify={notify}
              token={session.token}
            />
          ) : activePage === "stock-activity" ? (
            <InventoryScreen onNotify={notify} token={session.token} />
          ) : activePage === "orders" ? (
            <OrdersScreen onNotify={notify} token={session.token} />
          ) : activePage === "customers" ? (
            <CustomersScreen
              onNotify={notify}
              token={session.token}
            />
          ) : activePage === "profile" ? (
            <ProfileScreen
              onNotify={notify}
              onProfileUpdated={(user) => {
                const nextSession = { ...session, user };
                localStorage.setItem(authStorageKey, JSON.stringify(nextSession));
                setSession(nextSession);
              }}
              token={session.token}
            />
          ) : (
            <DashboardSummaryScreen
              onNavigate={setActivePage}
              token={session.token}
            />
          )}
        </main>
      </div>
      {notification && (
        <div className={`toast toast-${notification.type}`} role="status">
          <span>{notification.type === "error" ? "!" : "✓"}</span>
          {notification.message}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotification(null)}
            type="button"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
