import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Inventario from './pages/Inventario'
import ProductoForm from './pages/ProductoForm'
import Familias from './pages/Familias'
import ConteoInicial from './pages/ConteoInicial'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
      <Route path="/productos/nuevo" element={<ProtectedRoute><ProductoForm /></ProtectedRoute>} />
      <Route path="/productos/:sku" element={<ProtectedRoute><ProductoForm /></ProtectedRoute>} />
      <Route path="/familias" element={<ProtectedRoute><Familias /></ProtectedRoute>} />
      <Route path= "/Conteo-Inicial" element={<ProtectedRoute><ConteoInicial /></ ProtectedRoute>}/>
    </Routes>
  )
}