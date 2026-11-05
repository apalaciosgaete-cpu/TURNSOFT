import { useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Componentes simples
const Navbar = () => (
  <nav className="bg-slate-800 text-white p-4 shadow-md">
    <div className="max-w-7xl mx-auto flex justify-between items-center">
      <Link to="/" className="text-2xl font-bold tracking-tight">
        TURNSOFT
      </Link>
      <div className="space-x-4">
        <Link to="/" className="px-4 py-2 hover:bg-slate-700 rounded">Dashboard</Link>
        <Link to="/guardias" className="px-4 py-2 hover:bg-slate-700 rounded">Guardias</Link>
        <Link to="/horarios" className="px-4 py-2 hover:bg-slate-700 rounded">Horarios</Link>
        <Link to="/reportes" className="px-4 py-2 hover:bg-slate-700 rounded">Reportes</Link>
      </div>
    </div>
  </nav>
);

const Dashboard = () => {
  const [stats, setStats] = useState({ empresas: 0, guardias: 0, horarios: 0 });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="text-sm text-slate-500">TURNSOFT - Gestión de Horarios</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <div className="text-slate-500 text-sm uppercase tracking-wider">Empresas</div>
          <div className="text-3xl font-bold">{stats.empresas}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <div className="text-slate-500 text-sm uppercase tracking-wider">Guardias activos</div>
          <div className="text-3xl font-bold">{stats.guardias}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
          <div className="text-slate-500 text-sm uppercase tracking-wider">Horarios generados</div>
          <div className="text-3xl font-bold">{stats.horarios}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
        <h2 className="text-lg font-bold mb-4">Acciones rápidas</h2>
        <div className="space-y-3">
          <Link to="/empresas/nueva" className="block bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 transition">Crear empresa</Link>
          <Link to="/guardias/nuevo" className="block bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 transition">Registrar guardia</Link>
          <Link to="/horarios/generar" className="block bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 transition">Generar horarios</Link>
        </div>
      </div>
    </div>
  );
};

const Empresas = ({ buscarGuardias }) => {
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(false);

  const cargarEmpresas = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/empresas');
      setEmpresas(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const crearEmpresa = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await axios.post('/api/empresas', {
        razon_social: formData.get('razon_social'),
        rut_empresa: formData.get('rut_empresa'),
        jornada_maxima_semanal: parseInt(formData.get('jornada_maxima_semanal') || '44'),
        descanso_minimo_entre_turnos: parseInt(formData.get('descanso_minimo_entre_turnos') || '12'),
        horas_extras_max_diarias: parseInt(formData.get('horas_extras_max_diarias') || '2'),
        recargo_dominical_festivo: parseFloat(formData.get('recargo_dominical_festivo') || '50')
      });
      cargarEmpresas();
      e.target.reset();
    } catch (err) {
      alert('Error creando empresa: ' + err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Empresas</h1>

      <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
        <h2 className="text-lg font-bold mb-4">Nueva empresa</h2>
        <form onSubmit={crearEmpresa} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Razón social</label>
            <input name="razon_social" className="w-full border border-slate-300 rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">RUT empresa</label>
            <input name="rut_empresa" className="w-full border border-slate-300 rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Jornada máx. semanal (hs)</label>
            <input name="jornada_maxima_semanal" type="number" defaultValue="44" className="w-full border border-slate-300 rounded px-3 py-2" />
          </div>
          <div className="md:col-span-3">
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar empresa'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
        <h2 className="text-lg font-bold mb-4">Lista de empresas</h2>
        {loading ? (
          <div className="text-slate-500">Cargando...</div>
        ) : (
          <table className="w-full border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-200 p-3 text-left text-sm">Razón social</th>
                <th className="border border-slate-200 p-3 text-left text-sm">RUT</th>
                <th className="border border-slate-200 p-3 text-left text-sm">Jornada máx.</th>
                <th className="border border-slate-200 p-3 text-left text-sm">Creado</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map(e => (
                <tr key={e.id}>
                  <td className="border border-slate-200 p-3">{e.razon_social}</td>
                  <td className="border border-slate-200 p-3">{e.rut_empresa}</td>
                  <td className="border border-slate-200 p-3">{e.jornada_maxima_semanal} hs</td>
                  <td className="border border-slate-200 p-3">{new Date(e.creado_en).toLocaleDateString('es-CL')}</td>
                </tr>
              ))}
              {empresas.length === 0 && (
                <tr><td colSpan="4" className="border border-slate-200 p-3 text-slate-500 text-center">No hay empresas registradas</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const Guardias = () => {
  const [guardias, setGuardias] = useState([]);
  const [loading, setLoading] = useState(false);

  const cargarGuardias = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/guardias');
      setGuardias(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Guardias de Seguridad</h1>
        <Link to="/guardias/nuevo" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">+ Nuevo guardia</Link>
      </div>

      <button onClick={cargarGuardias} className="bg-slate-200 px-4 py-2 rounded hover:bg-slate-300">
        {loading ? 'Cargando...' : 'Refrescar'}
      </button>

      <div className="bg-white p-6 rounded-lg shadow border border-slate-200 overflow-x-auto">
        <table className="w-full border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-200 p-3 text-left text-sm">Nombre</th>
              <th className="border border-slate-200 p-3 text-left text-sm">RUT</th>
              <th className="border border-slate-200 p-3 text-left text-sm">OS-10</th>
              <th className="border border-slate-200 p-3 text-left text-sm">Estado</th>
              <th className="border border-slate-200 p-3 text-left text-sm">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {guardias.map(g => (
              <tr key={g.id}>
                <td className="border border-slate-200 p-3">{g.nombre_completo}</td>
                <td className="border border-slate-200 p-3">{g.rut}</td>
                <td className="border border-slate-200 p-3">
                  {g.numero_certificado ? g.numero_certificado : <span className="text-slate-400">Sin certificar</span>}
                </td>
                <td className="border border-slate-200 p-3">
                  <span className={`px-2 py-1 rounded text-xs ${g.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {g.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="border border-slate-200 p-3">
                  <button className="text-blue-600 hover:underline text-sm">Editar</button>
                </td>
              </tr>
            ))}
            {guardias.length === 0 && (
              <tr><td colSpan="5" className="border border-slate-200 p-3 text-slate-500 text-center">No hay guardias registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const GuardiaNuevo = () => {
  const guardarGuardia = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await axios.post('/api/guardias', {
        empresa_id: formData.get('empresa_id') || '00000000-0000-0000-0000-000000000000',
        nombre_completo: formData.get('nombre_completo'),
        rut: formData.get('rut'),
        email: formData.get('email'),
        telefono: formData.get('telefono'),
        fecha_contrato: formData.get('fecha_contrato'),
        horas_semanales_max: parseInt(formData.get('horas_semanales_max') || '44'),
        activo: true
      });
      alert('Guardia registrado correctamente');
      window.location.href = '/guardias';
    } catch (err) {
      alert('Error: ' + err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Registrar Guardia</h1>
      <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
        <form onSubmit={guardarGuardia} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nombre completo</label>
            <input name="nombre_completo" className="w-full border border-slate-300 rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">RUT</label>
            <input name="rut" className="w-full border border-slate-300 rounded px-3 py-2" placeholder="12.345.678-9" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input name="email" type="email" className="w-full border border-slate-300 rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono</label>
            <input name="telefono" className="w-full border border-slate-300 rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fecha de contrato</label>
            <input name="fecha_contrato" type="date" className="w-full border border-slate-300 rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Horas semanales máx.</label>
            <input name="horas_semanales_max" type="number" defaultValue="44" className="w-full border border-slate-300 rounded px-3 py-2" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 font-medium">
            Registrar Guardia
          </button>
        </form>
      </div>
    </div>
  );
};

const Horarios = () => {
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(false);

  const generarHorarios = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/horarios/generar', {
        empresa_id: '00000000-0000-0000-0000-000000000000',
        sucursal_id: '00000000-0000-0000-0000-000000000000',
        fecha_inicio: '2026-11-09',
        fecha_fin: '2026-11-15'
      });
      setHorarios(res.data.horarios);
      alert(`Se generaron ${res.data.total_generados} horarios`);
    } catch (err) {
      alert('Error generando horarios: ' + err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Generador de Horarios</h1>

      <div className="bg-white p-6 rounded-lg shadow border border-slate-200">
        <h2 className="text-lg font-bold mb-4">Generar horarios semanales</h2>
        <div className="flex gap-4">
          <button onClick={generarHorarios} disabled={loading} className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Generando...' : 'Generar horarios automáticos'}
          </button>
          <p className="text-sm text-slate-500 mt-2">El motor respetará: descanso 12h entre turnos, jornada máxima semanal, descanso semanal 24h.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow border border-slate-200 overflow-x-auto">
        <h2 className="text-lg font-bold mb-4">Horarios generados</h2>
        <table className="w-full border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-200 p-3 text-left text-sm">Fecha</th>
              <th className="border border-slate-200 p-3 text-left text-sm">Guardia</th>
              <th className="border border-slate-200 p-3 text-left text-sm">Puesto</th>
              <th className="border border-slate-200 p-3 text-left text-sm">Hora inicio</th>
              <th className="border border-slate-200 p-3 text-left text-sm">Hora fin</th>
              <th className="border border-slate-200 p-3 text-left text-sm">Horas</th>
              <th className="border border-slate-200 p-3 text-left text-sm">Tipo</th>
              <th className="border border-slate-200 p-3 text-left text-sm">Estado</th>
            </tr>
          </thead>
          <tbody>
            {horarios.map(h => (
              <tr key={h.id}>
                <td className="border border-slate-200 p-3">{h.fecha}</td>
                <td className="border border-slate-200 p-3">{h.guardia_nombre}</td>
                <td className="border border-slate-200 p-3">{h.puesto_nombre}</td>
                <td className="border border-slate-200 p-3">{new Date(h.hora_inicio).toLocaleTimeString('es-CL', {hour: '2-digit', minute:'2-digit'})}</td>
                <td className="border border-slate-200 p-3">{new Date(h.hora_fin).toLocaleTimeString('es-CL', {hour: '2-digit', minute:'2-digit'})}</td>
                <td className="border border-slate-200 p-3">{h.horas_trabajadas}</td>
                <td className="border border-slate-200 p-3">
                  <span className={`px-2 py-1 rounded text-xs ${h.tipo_turno === 'domingo' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                    {h.tipo_turno}
                  </span>
                </td>
                <td className="border border-slate-200 p-3">
                  <span className={`px-2 py-1 rounded text-xs ${h.estado === 'publicado' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                    {h.estado}
                  </span>
                </td>
              </tr>
            ))}
            {horarios.length === 0 && (
              <tr><td colSpan="8" className="border border-slate-200 p-3 text-slate-500 text-center">No hay horarios generados aún</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Reportes = () => {
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(false);

  const generarReporte = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/reportes/cumplimiento', {
        params: { empresa_id: '00000000-0000-0000-0000-000000000000', mes: '2026-11' }
      });
      setReporte(res.data);
    } catch (err) {
      alert('Error: ' + err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!reporte) return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold">Reportes de Cumplimiento</h1>
      <div className="bg-white p-6 rounded-lg shadow border border-slate-200 mt-6">
        <button onClick={generarReporte} disabled={loading} className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700">
          {loading ? 'Generando...' : 'Generar reporte de cumplimiento (noviembre 2026)'}
        </button>
        <p className="text-sm text-slate-500 mt-2">Incluye: horas semanales por guardia, descansos, domingos trabajados, certificaciones OS-10 vencidas.</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Reporte de Cumplimiento</h1>
      <p className="text-slate-600">Período: {reporte.periodo}</p>

      <div className="bg-white p-6 rounded-lg shadow border border-slate-200 overflow-x-auto">
        <table className="w-full border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-200 p-3 text-left text-sm">Guardia</th>
              <th className="border border-slate-200 p-3 text-right text-sm">Horas totales</th>
              <th className="border border-slate-200 p-3 text-right text-sm">Días trabajados</th>
              <th className="border border-slate-200 p-3 text-right text-sm">Domingos</th>
              <th className="border border-slate-200 p-3 text-right text-sm">Festivos</th>
            </tr>
          </thead>
          <tbody>
            {reporte.resumen_por_guardia.map(g => (
              <tr key={g.guardia_id}>
                <td className="border border-slate-200 p-3">{g.nombre_completo}</td>
                <td className="border border-slate-200 p-3 text-right">{g.total_horas}</td>
                <td className="border border-slate-200 p-3 text-right">{g.dias_trabajados}</td>
                <td className="border border-slate-200 p-3 text-right">{g.domingos_trabajados}</td>
                <td className="border border-slate-200 p-3 text-right">{g.festivos_trabajados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {reporte.os10_vencidas.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
          <h3 className="text-red-800 font-bold mb-3">⚠️ Certificaciones OS-10 vencidas</h3>
          <ul className="list-disc list-inside text-red-700 space-y-1">
            {reporte.os10_vencidas.map(c => (
              <li key={c.id}>{c.nombre_completo} - {c.numero_certificado} - Venció: {c.fecha_vencimiento}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const NotFound = () => (
  <div className="max-w-7xl mx-auto p-12 text-center">
    <h1 className="text-4xl font-bold text-slate-800">404</h1>
    <p className="text-slate-500 mt-4">Página no encontrada</p>
    <Link to="/" className="mt-6 inline-block bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700">Volver al inicio</Link>
  </div>
);

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/empresas" element={<Empresas />} />
        <Route path="/empresas/nueva" element={<Empresas />} />
        <Route path="/guardias" element={<Guardias />} />
        <Route path="/guardias/nuevo" element={<GuardiaNuevo />} />
        <Route path="/horarios" element={<Horarios />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}