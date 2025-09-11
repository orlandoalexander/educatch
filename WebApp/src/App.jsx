import { useContext, useEffect, useRef } from "react";
import { Route, Routes, useLocation, Navigate } from "react-router-dom";
import {
  Calendar,
  Settings as SettingsIcon,
  FileText,
  DollarSign,
} from "react-feather";
import { notification } from "antd";
import dayjs from "dayjs";
import updateLocale from "dayjs/plugin/updateLocale";
import Sidebar from "./components/Sidebar";
import Login from "./components/Login";
import Timetable from "./components/Timetable";
import Reports from "./components/Reports";
import Invoices from "./components/Invoices";
import Settings from "./components/Settings";
import ProtectedRoute from "./ProtectedRoute";
import { UserContext } from "./UserContext";
import "./App.css";

const isDemo = import.meta.env.VITE_DEMO;

// Set Monday as the first day of the week
dayjs.extend(updateLocale);
dayjs.updateLocale("en", {
  weekStart: 1,
});

export default function App() {
  const demoNotificationShown = useRef(false);
  const { user } = useContext(UserContext);
  const { role } = user;
  const location = useLocation();
  const currentRoute = location.pathname;
  const routes = [
    { path: "/timetable", name: "Timetable", icon: Calendar },
    { path: "/reports", name: "Reports", icon: FileText },
    { path: "/invoices", name: "Invoices", icon: DollarSign },
    ...(role === "admin"
      ? [{ path: "/settings", name: "Settings", icon: SettingsIcon }]
      : []),
  ];

  useEffect(() => {
    if (
      !demoNotificationShown.current &&
      import.meta.env.VITE_DEMO === "true"
    ) {
      notification.warning({
        message: "Demo Mode",
        description: "You are in demo mode. Some actions are disabled.",
        duration: 0,
        placement: "topRight",
      });
      demoNotificationShown.current = true;
    }
  }, []);

  return (
    <div className="app">
      {location.pathname !== "/login" && role !== "student" && (
        <aside className="app--sidebar">
          <Sidebar routes={routes} currentRoute={currentRoute} />
        </aside>
      )}
      <main className="app--content">
        <Routes>
          <Route
            path="/login"
            element={isDemo ? <Navigate to="/timetable" replace /> : <Login />}
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Navigate to="/timetable" replace />
              </ProtectedRoute>
            }
          />

          <Route
            path="/timetable/:lessonOccurrenceId?"
            element={
              <ProtectedRoute>
                <Timetable />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timetable/:lessonOccurrenceId/report"
            element={
              <ProtectedRoute>
                <Timetable />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timetable/new/:initialDate?"
            element={
              <ProtectedRoute>
                <Timetable />
              </ProtectedRoute>
            }
          />

          <Route
            path="/reports/:reportId?"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/invoice/:reportInvoiceId?/student/:reportStudentId"
            element={
              <ProtectedRoute>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices/:invoiceId?"
            element={
              <ProtectedRoute>
                <Invoices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoices/:invoiceId/student/:studentId/report"
            element={
              <ProtectedRoute>
                <Invoices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <Navigate to="/timetable" replace />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
