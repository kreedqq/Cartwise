import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/context/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { UsernameGate } from "@/routes/UsernameGate";
import { AdminRoute } from "@/routes/AdminRoute";
import { MaintenanceGate } from "@/routes/MaintenanceGate";
import { ConsentGate } from "@/routes/ConsentGate";
import { AppShell } from "@/components/layout/AppShell";
import { FullScreenSpinner } from "@/components/common/FullScreenSpinner";
import UsernameRequiredPage from "@/pages/UsernameRequired";
import ConsentPage from "@/pages/Consent";
import AnnouncementsPage from "@/pages/Announcements";
import FeedbackPage from "@/pages/Feedback";

import LoginPage from "@/pages/Login";
import AuthCallbackPage from "@/pages/AuthCallback";
import RegisterPage from "@/pages/Register";
import ForgotPasswordPage from "@/pages/ForgotPassword";
import ResetPasswordPage from "@/pages/ResetPassword";
import DashboardPage from "@/pages/Dashboard";
import CartDetailPage from "@/pages/CartDetail";
import CheckoutPage from "@/pages/Checkout";
import ShopHubPage from "@/pages/ShopHub";
import ShopRetailPage from "@/pages/ShopRetail";
import GroupBuyPage from "@/pages/GroupBuy";
import KitRequestsPage from "@/pages/KitRequests";
import OrdersPage from "@/pages/Orders";
import OrderDetailPage from "@/pages/OrderDetail";
import ProfilePage from "@/pages/Profile";
import ForbiddenPage from "@/pages/Forbidden";
import NotFoundPage from "@/pages/NotFound";

const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminProductsPage = lazy(() => import("@/pages/admin/AdminProducts"));
const AdminShopAreasPage = lazy(() => import("@/pages/admin/AdminShopAreas"));
const AdminPdfImportPage = lazy(() => import("@/pages/admin/AdminPdfImport"));
const AdminImportHistoryPage = lazy(() => import("@/pages/admin/AdminImportHistory"));
const AdminUsersPage = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminAuditLogPage = lazy(() => import("@/pages/admin/AdminAuditLog"));
const AdminOrdersPage = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminOrderDetailPage = lazy(() => import("@/pages/admin/AdminOrderDetail"));
const AdminOrderSummaryPage = lazy(() => import("@/pages/admin/AdminOrderSummary"));
const AdminRolesPage = lazy(() => import("@/pages/admin/AdminRoles"));
const AdminRoleSurchargesPage = lazy(() => import("@/pages/admin/AdminRoleSurcharges"));
const AdminShippingPage = lazy(() => import("@/pages/admin/AdminShipping"));
const AdminResearchPage = lazy(() => import("@/pages/admin/AdminResearch"));
const AdminAnnouncementsPage = lazy(() => import("@/pages/admin/AdminAnnouncements"));
const AdminDesignPage = lazy(() => import("@/pages/admin/AdminDesign"));
const AdminFeedbackPage = lazy(() => import("@/pages/admin/AdminFeedback"));
const PeptideHubPage = lazy(() => import("@/pages/peptide/PeptideHub"));
const PeptideCalculatorPage = lazy(() => import("@/pages/peptide/PeptideCalculator"));
const PeptideLexiconPage = lazy(() => import("@/pages/peptide/PeptideLexicon"));
const PeptideLexiconDetailPage = lazy(() => import("@/pages/peptide/PeptideLexiconDetail"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

function RedirectAdminShippingOrder() {
  const { orderId } = useParams<{ orderId: string }>();
  return <Navigate to={orderId ? `/admin/orders/${orderId}` : "/admin/orders"} replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route element={<MaintenanceGate />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/403" element={<ForbiddenPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/username-required" element={<UsernameRequiredPage />} />
              <Route element={<UsernameGate />}>
              <Route path="/consent" element={<ConsentPage />} />
              <Route element={<ConsentGate />}>
              <Route element={<AppShell />}>
                <Route path="/announcements" element={<AnnouncementsPage />} />
                <Route path="/news" element={<Navigate to="/announcements" replace />} />
                <Route path="/newsfeed" element={<Navigate to="/announcements" replace />} />
                <Route path="/neuigkeiten" element={<Navigate to="/announcements" replace />} />
                <Route path="/shop" element={<ShopHubPage />} />
                <Route path="/shop/retail" element={<ShopRetailPage />} />
                <Route path="/shop/group-buy-1" element={<GroupBuyPage />} />
                <Route path="/shop/group-buy-2" element={<GroupBuyPage />} />
                <Route path="/kit-gesuche" element={<KitRequestsPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/carts/:cartId" element={<CartDetailPage />} />
                <Route path="/carts/:cartId/checkout" element={<CheckoutPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route
                  path="/peptide"
                  element={
                    <Suspense fallback={<FullScreenSpinner label="Peptidbereich wird geladen …" />}>
                      <PeptideHubPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/peptide/rechner"
                  element={
                    <Suspense fallback={<FullScreenSpinner label="Rechner wird geladen …" />}>
                      <PeptideCalculatorPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/peptide/lexikon"
                  element={
                    <Suspense fallback={<FullScreenSpinner label="Lexikon wird geladen …" />}>
                      <PeptideLexiconPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/peptide/lexikon/:slug"
                  element={
                    <Suspense fallback={<FullScreenSpinner label="Profil wird geladen …" />}>
                      <PeptideLexiconDetailPage />
                    </Suspense>
                  }
                />

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
                    <Route path="orders" element={<AdminOrdersPage />} />
                    <Route path="orders/:orderId" element={<AdminOrderDetailPage />} />
                    <Route path="order-summary" element={<AdminOrderSummaryPage />} />
                    <Route path="roles" element={<AdminRolesPage />} />
                    <Route path="surcharges" element={<AdminRoleSurchargesPage />} />
                    <Route path="shipping" element={<Navigate to="/admin/orders" replace />} />
                    <Route path="shipping/:orderId" element={<RedirectAdminShippingOrder />} />
                    <Route path="shipping-costs" element={<AdminShippingPage />} />
                    <Route path="products" element={<AdminProductsPage />} />
                    <Route path="shop-areas" element={<AdminShopAreasPage />} />
                    <Route path="pdf-import" element={<AdminPdfImportPage />} />
                    <Route path="import-history" element={<AdminImportHistoryPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="audit-log" element={<AdminAuditLogPage />} />
                    <Route path="research" element={<AdminResearchPage />} />
                    <Route path="announcements" element={<AdminAnnouncementsPage />} />
                    <Route path="design" element={<AdminDesignPage />} />
                    <Route path="feedback" element={<AdminFeedbackPage />} />
                  </Route>
                </Route>
              </Route>
              </Route>
              </Route>
            </Route>

            <Route path="/" element={<Navigate to="/announcements" replace />} />
            <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      <Toaster />
    </QueryClientProvider>
  );
}
