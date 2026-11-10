import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { LoginScreen } from './components/LoginScreen.jsx';
import { useAuth } from './store/AuthContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Schedule from './pages/Schedule.jsx';
import Staff from './pages/Staff.jsx';
import Shifts from './pages/Shifts.jsx';
import Rules from './pages/Rules.jsx';
import Legal from './pages/Legal.jsx';
import Reports from './pages/Reports.jsx';
import Clients from './pages/Clients.jsx';

function NotFound() {
  return (
    <div className="page">
      <div className="not-found">
        <span className="not-found-code">404</span>
        <h2>Página no encontrada</h2>
        <p>La ruta que buscas no existe en TURNSOFT.</p>
        <Link className="btn btn-primary btn-md" to="/">Volver al panel</Link>
      </div>
    </div>
  );
}

export default function App() {
  const { session } = useAuth();

  if (!session) return <LoginScreen />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="horario" element={<Schedule />} />
        <Route path="personal" element={<Staff />} />
        <Route path="turnos" element={<Shifts />} />
        <Route path="reglas" element={<Rules />} />
        <Route path="reportes" element={<Reports />} />
        <Route path="legal" element={<Legal />} />
        <Route path="clientes" element={<Clients />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
