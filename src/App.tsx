import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/context/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { AdminRoute } from "@/routes/AdminRoute";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";

import LoginPage from "@/pages/Login";
import RegisterPage from "@/pages/Register";
import ForgotPasswordPage from "@/pages/ForgotPassword";
import ResetPasswordPage from "@/pages/ResetPassword";
import DashboardPage from "@/pages/Dashboard";
import CartDetailPage from "@/pages/CartDetail";
import ProfilePage from "@/pages/Profile";
import ForbiddenPage from "@/pages/Forbidden";
import NotFoundPage from "@/pages/NotFound";

// The admin area (and only the admin area) pulls in pdf.js and papaparse,
// which are sizeable. Lazy-loading it keeps the initial bundle small for
// the vast majority of users who never open /admin.
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminProductsPage = lazy(() => import("@/pages/admin/AdminProducts"));
const AdminPdfImportPage = lazy(() => import("@/pages/admin/AdminPdfImport"));
const AdminImportHistoryPage = lazy(() => import("@/pages/admin/AdminImportHistory"));
const AdminUsersPage = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminAuditLogPage = lazy(() => import("@/pages/admin/AdminAuditLog"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/403" element={<ForbiddenPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/carts/:cartId" element={<CartDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />

                <Route element={<AdminRoute />}>
                  <Route
                    path="/admin"
                    element={
                      <Suspense fallback={<FullScreenSpinner label="Admin-Bereich wird geladen …" />}>
                        <AdminLayout />
                      </Suspense>
                    }
                  >
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="products" element={<AdminProductsPage />} />
                    <Route path="pdf-import" element={<AdminPdfImportPage />} />
                    <Route path="import-history" element={<AdminImportHistoryPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="audit-log" element={<AdminAuditLogPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
