import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';

import LoginPage from './pages/LoginPage.jsx';
import POSPage from './pages/POSPage.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import DashboardPage from './pages/admin/DashboardPage.jsx';
import MenuManagerPage from './pages/admin/MenuManagerPage.jsx';
import InventoryPage from './pages/admin/InventoryPage.jsx';
import MembersPage from './pages/admin/MembersPage.jsx';
import StaffPage from './pages/admin/StaffPage.jsx';
import ReportsPage from './pages/admin/ReportsPage.jsx';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/pos'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/pos"
        element={
          <ProtectedRoute roles={['CASHIER', 'ADMIN']}>
            <CartProvider>
              <POSPage />
            </CartProvider>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="menu" element={<MenuManagerPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>

      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
