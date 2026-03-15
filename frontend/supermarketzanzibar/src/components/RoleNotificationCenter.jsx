import { useEffect, useRef, useState } from "react";
import { http } from "../api/http.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { playNotificationTone, primeNotificationTone } from "../lib/notificationTone.js";

const POLL_INTERVAL_MS = 10000;
const ALERT_LIFETIME_MS = 7000;

function buildSummaryAlert(role, count) {
  const label = count === 1 ? "1 new item" : `${count} active items`;

  if (role === "supplier") {
    return {
      title: "Supplier Alert",
      kicker: "Live Orders",
      message: `You have ${label} waiting in supplier orders.`,
    };
  }

  return {
    title: "Driver Alert",
    kicker: "Live Deliveries",
    message: `You have ${label} on your delivery queue.`,
  };
}

function buildLiveAlert(role, item) {
  if (role === "supplier") {
    return {
      title: "New customer order",
      kicker: "Supplier Alert",
      message: `Order #${item.sale_id} from ${item.customer_name || "a customer"} is waiting for review.`,
    };
  }

  return {
    title: "New delivery assigned",
    kicker: "Driver Alert",
    message: `Delivery #${item.sale_id} has been added${item.delivery_location ? ` for ${item.delivery_location}` : ""}.`,
  };
}

function buildAlertId(role, itemId) {
  return `${role}-${itemId}-${Date.now()}`;
}

function timeLabel() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function RoleNotificationCenter() {
  const { isAuthenticated, user } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const timersRef = useRef(new Map());
  const seenIdsRef = useRef(new Set());
  const roleSessionRef = useRef("");
  const sessionReadyRef = useRef(false);

  const dismissAlert = (alertId) => {
    const timer = timersRef.current.get(alertId);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(alertId);
    }

    setAlerts((current) => current.filter((alert) => alert.id !== alertId));
  };

  const pushAlert = (role, payload) => {
    const alert = {
      id: buildAlertId(role, payload.itemId),
      role,
      title: payload.title,
      kicker: payload.kicker,
      message: payload.message,
      receivedAt: timeLabel(),
    };

    setAlerts((current) => [alert, ...current].slice(0, 4));
    const timer = window.setTimeout(() => dismissAlert(alert.id), ALERT_LIFETIME_MS);
    timersRef.current.set(alert.id, timer);
  };

  useEffect(() => {
    const releaseAudio = primeNotificationTone();
    return () => releaseAudio();
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const role = isAuthenticated ? user?.role : null;
    if (!user?.id || (role !== "supplier" && role !== "driver")) {
      seenIdsRef.current = new Set();
      roleSessionRef.current = "";
      sessionReadyRef.current = false;
      setAlerts([]);
      return;
    }

    const endpoint = role === "supplier" ? "/api/supplier/alerts/" : "/api/driver/alerts/";
    const roleSessionKey = `${role}:${user.id}`;

    if (roleSessionRef.current !== roleSessionKey) {
      roleSessionRef.current = roleSessionKey;
      seenIdsRef.current = new Set();
      sessionReadyRef.current = false;
    }

    let cancelled = false;

    const syncAlerts = async () => {
      try {
        const response = await http.get(endpoint);
        if (cancelled) return;

        const roleAlerts = Array.isArray(response.data?.alerts) ? response.data.alerts : [];
        const nextSeenIds = new Set(roleAlerts.map((item) => item.id));

        if (!sessionReadyRef.current) {
          sessionReadyRef.current = true;
          seenIdsRef.current = nextSeenIds;

          if (roleAlerts.length) {
            pushAlert(role, {
              itemId: "summary",
              ...buildSummaryAlert(role, roleAlerts.length),
            });
            playNotificationTone().catch(() => {});
          }
          return;
        }

        const newItems = roleAlerts.filter((item) => !seenIdsRef.current.has(item.id));
        seenIdsRef.current = nextSeenIds;

        if (!newItems.length) return;

        newItems.forEach((item) => {
          pushAlert(role, {
            itemId: item.id,
            ...buildLiveAlert(role, item),
          });
        });
        playNotificationTone().catch(() => {});
      } catch {
        // Silent fail: alerts should never block the main app.
      }
    };

    syncAlerts();
    const intervalId = window.setInterval(syncAlerts, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, user?.id, user?.role]);

  if (!alerts.length) return null;

  return (
    <div className="role-alert-stack" aria-live="polite" aria-atomic="false">
      {alerts.map((alert) => (
        <article key={alert.id} className={`role-alert-card role-alert-card-${alert.role}`}>
          <div className="role-alert-header">
            <div>
              <p className="role-alert-kicker">{alert.kicker}</p>
              <h3>{alert.title}</h3>
            </div>
            <button
              type="button"
              className="role-alert-dismiss"
              aria-label="Dismiss notification"
              onClick={() => dismissAlert(alert.id)}
            >
              x
            </button>
          </div>
          <p className="role-alert-body">{alert.message}</p>
          <p className="role-alert-meta">{alert.receivedAt}</p>
        </article>
      ))}
    </div>
  );
}

export default RoleNotificationCenter;
