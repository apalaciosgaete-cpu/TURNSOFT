import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { MasterLayout } from './components/MasterLayout.jsx';
import { LoginScreen } from './components/LoginScreen.jsx';
import { useAuth } from './store/AuthContext.jsx';
import { MasterProvider } from './store/MasterContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Schedule from './pages/Schedule.jsx';
import Staff from './pages/Staff.jsx';
import Shifts from './pages/Shifts.jsx';
import Rules from './pages/Rules.jsx';
import Legal from './pages/Legal.jsx';
import Reports from './pages/Reports.jsx';
import Clients from './pages/Clients.jsx';
import Support from './pages/Support.jsx';
import MiEmpresa from './pages/MiEmpresa.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import MasterOverview from './pages/MasterOverview.jsx';
import MasterCompanies from './pages/MasterCompanies.jsx';
import MasterPayments from './pages/MasterPayments.jsx';
import MasterPlans from './pages/MasterPlans.jsx';
import MasterSupport from './pages/MasterSupport.jsx';

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
  const { session, isSuperadmin, isOperator } = useAuth();

  if (!session) {
    return (
      <Routes>
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="*" element={<LoginScreen />} />
      </Routes>
    );
  }

  if (isSuperadmin) {
    return (
      <MasterProvider>
        <Routes>
          <Route element={<MasterLayout />}>
            <Route path="master" element={<MasterOverview />} />
            <Route path="master/empresas" element={<MasterCompanies />} />
            <Route path="master/pagos" element={<MasterPayments />} />
            <Route path="master/planes" element={<MasterPlans />} />
            <Route path="master/soporte" element={<MasterSupport />} />
            <Route path="*" element={<Navigate to="/master" replace />} />
          </Route>
        </Routes>
      </MasterProvider>
    );
  }

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
        <Route path="registro" element={<Navigate to="/" replace />} />
        {isOperator ? <Route path="empresa" element={<MiEmpresa />} /> : null}
        <Route path="soporte" element={<Support />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
