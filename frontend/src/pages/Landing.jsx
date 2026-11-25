import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  ClipboardCheck,
  HeartPulse,
  Lock,
  Mountain,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Truck,
  UserCheck,
  Wand2,
} from 'lucide-react';
import { BrandMark } from '../components/Brand.jsx';
import './landing.css';

const SECTORES = [
  { icon: ShieldCheck, nombre: 'Seguridad', texto: 'Cobertura continua por puesto, día y noche.' },
  { icon: HeartPulse, nombre: 'Salud', texto: 'Turnos nocturnos y de 24 horas por unidad.' },
  { icon: Mountain, nombre: 'Minería', texto: 'Sistemas prolongados como 7x7 o 4x3.' },
  { icon: ShoppingBag, nombre: 'Retail', texto: 'Tramos horarios y picos de demanda.' },
  { icon: Truck, nombre: 'Logística', texto: 'Turnos por ola de despacho y rotación.' },
];

const PASOS = [
  {
    icon: ClipboardCheck,
    titulo: 'Carga tu operación',
    texto: 'Registra clientes, puestos, turnos y tu personal. Indica ausencias y vacaciones.',
  },
  {
    icon: Wand2,
    titulo: 'Recibe una propuesta',
    texto: 'El motor arma un horario que cubre cada puesto y respeta la normativa laboral chilena.',
  },
  {
    icon: SlidersHorizontal,
    titulo: 'Ajusta y publica',
    texto: 'Tú o quien designes cambia lo que haga falta. Cada cambio se vuelve a validar antes de publicar.',
  },
];

const REGLAS = [
  ['Jornada ordinaria', '42 horas semanales hoy y 40 horas desde abril de 2028, con vigencia por fecha.'],
  ['Descansos', 'Descanso entre turnos, colación y días de descanso semanal.'],
  ['Domingos y feriados', 'Control de domingos libres y de feriados nacionales y regionales.'],
  ['Jornadas excepcionales', 'Sistemas de turnos prolongados autorizados por la Dirección del Trabajo.'],
];

const PREGUNTAS = [
  ['¿Mi personal necesita una cuenta?', 'No. El administrador, o quien este designe, recibe el horario y se lo entrega al personal.'],
  ['¿Puedo cambiar lo que propone el motor?', 'Sí. La propuesta es un punto de partida; tú decides el horario final y el sistema te avisa si algo incumple una regla.'],
  ['¿Qué pasa al terminar los 15 días de prueba?', 'La cuenta queda sin acceso hasta que elijas un plan. Tus datos se conservan.'],
  ['¿Cuánto cuesta?', 'Los planes se anunciarán antes del lanzamiento comercial. Hoy puedes probar la app sin costo.'],
  ['¿Reemplaza la asesoría laboral?', 'No. SAFETURN ayuda a planificar y detectar incumplimientos, pero la responsabilidad legal sigue siendo de la empresa.'],
];

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MUESTRA = [
  { nombre: 'Equipo A', turnos: ['m', 'm', 'm', 'm', 'm', '', ''] },
  { nombre: 'Equipo B', turnos: ['t', 't', 't', 't', 't', 'm', ''] },
  { nombre: 'Equipo C', turnos: ['n', 'n', 'n', '', '', 'n', 'n'] },
  { nombre: 'Equipo D', turnos: ['', '', 't', 't', 'm', 'm', 'm'] },
];
const ETIQUETA = { m: 'Mañana', t: 'Tarde', n: 'Noche' };

function Muestra() {
  return (
    <div className="lp-mock" role="img" aria-label="Ejemplo de calendario semanal de turnos">
      <div className="lp-mock-bar">
        <span className="lp-dots" aria-hidden="true"><i /><i /><i /></span>
        <span>Semana de ejemplo</span>
        <span className="lp-tag lp-tag-ok"><CalendarCheck size={13} /> 0 infracciones</span>
      </div>
      <div className="lp-grid" aria-hidden="true">
        <span />
        {DIAS.map((d) => <b key={d}>{d}</b>)}
        {MUESTRA.map((fila) => (
          <FilaMuestra key={fila.nombre} fila={fila} />
        ))}
      </div>
      <div className="lp-legend" aria-hidden="true">
        <span><i className="lp-s-m" /> Mañana</span>
        <span><i className="lp-s-t" /> Tarde</span>
        <span><i className="lp-s-n" /> Noche</span>
      </div>
      <p className="lp-mock-note">Datos de ejemplo.</p>
    </div>
  );
}

function FilaMuestra({ fila }) {
  return (
    <>
      <span className="lp-row-name">{fila.nombre}</span>
      {fila.turnos.map((t, i) => (
        <span key={i} className={t ? `lp-cell lp-s-${t}` : 'lp-cell lp-off'}>
          {t ? ETIQUETA[t] : ''}
        </span>
      ))}
    </>
  );
}

export default function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <Link to="/" className="lp-brand" aria-label="SAFETURN, inicio">
            <BrandMark size={36} />
            <span>SAFETURN</span>
          </Link>
          <nav className="lp-links" aria-label="Secciones">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#cumplimiento">Cumplimiento</a>
            <a href="#sectores">Sectores</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <div className="lp-nav-cta">
            <Link to="/ingresar" className="lp-btn lp-btn-ghost">Ya tengo cuenta</Link>
            <Link to="/registro" className="lp-btn lp-btn-primary">Crear cuenta</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-in">
            <div className="lp-hero-copy">
              <span className="lp-eyebrow">Versión de prueba · Turnos para Chile</span>
              <h1>Arma tus turnos en minutos y cumple la normativa laboral chilena.</h1>
              <p>
                SAFETURN propone el horario, revisa jornada, descansos y feriados, y tú lo ajustas
                antes de publicarlo. Para cualquier empresa que opere por turnos.
              </p>
              <div className="lp-hero-actions">
                <Link to="/registro" className="lp-btn lp-btn-primary lp-btn-lg">
                  Prueba 15 días gratis <ArrowRight size={18} />
                </Link>
                <Link to="/ingresar" className="lp-btn lp-btn-light lp-btn-lg">Ya tengo cuenta</Link>
              </div>
              <ul className="lp-hero-points">
                <li><Lock size={15} /> Cada empresa ve solo sus datos</li>
                <li><UserCheck size={15} /> Tu personal no necesita cuenta</li>
              </ul>
            </div>
            <Muestra />
          </div>
        </section>

        <section id="como-funciona" className="lp-section">
          <div className="lp-wrap">
            <h2>Cómo funciona</h2>
            <p className="lp-lead">El motor propone y tú decides.</p>
            <div className="lp-steps">
              {PASOS.map((p, i) => (
                <article key={p.titulo} className="lp-step">
                  <span className="lp-step-n">{i + 1}</span>
                  <p.icon size={22} aria-hidden="true" />
                  <h3>{p.titulo}</h3>
                  <p>{p.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cumplimiento" className="lp-section lp-dark">
          <div className="lp-wrap lp-split">
            <div>
              <h2>Pensado para la normativa chilena</h2>
              <p className="lp-lead">
                Las reglas viven en el motor con fecha de vigencia, así los cambios de ley se
                incorporan sin rehacer tus horarios.
              </p>
              <p className="lp-small">
                SAFETURN es una ayuda a la planificación y no reemplaza la asesoría laboral.
              </p>
            </div>
            <dl className="lp-rules">
              {REGLAS.map(([t, d]) => (
                <div key={t}>
                  <dt>{t}</dt>
                  <dd>{d}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="sectores" className="lp-section">
          <div className="lp-wrap">
            <h2>Para todos los sectores con turnos</h2>
            <p className="lp-lead">Un mismo motor, con las reglas de cada tipo de operación.</p>
            <div className="lp-sectors">
              {SECTORES.map((s) => (
                <article key={s.nombre} className="lp-sector">
                  <s.icon size={22} aria-hidden="true" />
                  <h3>{s.nombre}</h3>
                  <p>{s.texto}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="preguntas" className="lp-section lp-faq-sec">
          <div className="lp-wrap lp-faq-wrap">
            <h2>Preguntas frecuentes</h2>
            <div className="lp-faq">
              {PREGUNTAS.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-wrap">
            <h2>Prueba SAFETURN con tu propio equipo</h2>
            <p>15 días para armar tus primeros horarios.</p>
            <Link to="/registro" className="lp-btn lp-btn-primary lp-btn-lg">
              Empezar la prueba <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-wrap lp-foot-in">
          <span className="lp-brand lp-brand-sm"><BrandMark size={26} /> SAFETURN · Turnos para Chile</span>
          <span>© 2026 SAFETURN</span>
        </div>
      </footer>
    </div>
  );
}
