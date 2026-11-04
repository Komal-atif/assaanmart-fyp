import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import AdminLayout from '../components/layout/AdminLayout'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Orders from '../pages/Orders'
import OrderDetails from '../pages/OrderDetails'
import Products from '../pages/Products'
import ProductForm from '../pages/ProductForm'
import Inventory from '../pages/Inventory'
import LowStock from '../pages/LowStock'
import Customers from '../pages/Customers'
import Analytics from '../pages/Analytics'
import Settings from '../pages/Settings'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetails />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/new" element={<ProductForm />} />
          <Route path="/products/:id" element={<ProductForm />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/low-stock" element={<LowStock />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
