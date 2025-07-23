import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminProvider } from "@/hooks/useAdminAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import MainLayout from "@/layouts/MainLayout";
import AdminLayout from "@/layouts/AdminLayout";
import Index from "./pages/Index";
import Chat from "./pages/Chat";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import AdminAuth from "./pages/AdminAuth";
import AdminDashboard from "./pages/admin/Dashboard";
import FAQManagement from "./pages/admin/FAQManagement";
import CategoryManagement from "./pages/admin/CategoryManagement";
import EscalatedQueries from "./pages/admin/EscalatedQueries";
import Analytics from "./pages/admin/Analytics";
import OrderManagement from "./pages/admin/OrderManagement";
import OrderInquiries from "./pages/admin/OrderInquiries";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <AuthProvider>
          <AdminProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin/auth" element={<AdminAuth />} />
              
              {/* User Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  <MainLayout>
                    <Index />
                  </MainLayout>
                </ProtectedRoute>
              } />
              <Route path="/chat" element={
                <ProtectedRoute>
                  <MainLayout>
                    <Chat />
                  </MainLayout>
                </ProtectedRoute>
              } />
              <Route path="/chat/:sessionId" element={
                <ProtectedRoute>
                  <MainLayout>
                    <Chat />
                  </MainLayout>
                </ProtectedRoute>
              } />
              <Route path="/history" element={
                <ProtectedRoute>
                  <MainLayout>
                    <History />
                  </MainLayout>
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <MainLayout>
                    <Profile />
                  </MainLayout>
                </ProtectedRoute>
              } />
              
              {/* Admin Routes */}
              <Route path="/admin" element={
                <AdminProtectedRoute>
                  <AdminLayout>
                    <AdminDashboard />
                  </AdminLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/faq" element={
                <AdminProtectedRoute>
                  <AdminLayout>
                    <FAQManagement />
                  </AdminLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/categories" element={
                <AdminProtectedRoute>
                  <AdminLayout>
                    <CategoryManagement />
                  </AdminLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/escalated" element={
                <AdminProtectedRoute>
                  <AdminLayout>
                    <EscalatedQueries />
                  </AdminLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/analytics" element={
                <AdminProtectedRoute>
                  <AdminLayout>
                    <Analytics />
                  </AdminLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/orders" element={
                <AdminProtectedRoute>
                  <AdminLayout>
                    <OrderManagement />
                  </AdminLayout>
                </AdminProtectedRoute>
              } />
              <Route path="/admin/order-inquiries" element={
                <AdminProtectedRoute>
                  <AdminLayout>
                    <OrderInquiries />
                  </AdminLayout>
                </AdminProtectedRoute>
              } />
              
              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AdminProvider>
      </AuthProvider>
    </TooltipProvider>
  </ThemeProvider>
  </QueryClientProvider>
);

export default App;
