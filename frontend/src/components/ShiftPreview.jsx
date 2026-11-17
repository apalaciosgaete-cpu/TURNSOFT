import { Check, Wand2 } from 'lucide-react';
import './shiftpreview.css';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const FILAS = [
  { nombre: 'Equipo A', turnos: ['m', 'm', 'm', 'm', 'm', '', ''] },
  { nombre: 'Equipo B', turnos: ['t', 't', 't', 't', 't', 'm', ''] },
  { nombre: 'Equipo C', turnos: ['n', 'n', 'n', '', '', 'n', 'n'] },
  { nombre: 'Equipo D', turnos: ['', '', 't', 't', 'm', 'm', 'm'] },
  { nombre: 'Equipo E', turnos: ['m', 'm', '', '', 'n', 'n', 'n'] },
];
const NOMBRE = { m: 'Mañana', t: 'Tarde', n: 'Noche' };
const CHEQUEOS = ['Jornada de 42 h', 'Descanso de 12 h', 'Domingos libres'];

export function ShiftPreview() {
  return (
    <div className="sp" role="img" aria-label="Ejemplo de calendario semanal de turnos con validación">
      <div className="sp-card">
        <div className="sp-head">
          <span className="sp-chip"><Wand2 size={13} /> Propuesta del motor</span>
          <span className="sp-sample">Ejemplo</span>
        </div>
        <div className="sp-grid" aria-hidden="true">
          <span />
          {DIAS.map((d) => <b key={d}>{d}</b>)}
          {FILAS.map((f) => (
            <FilaTurnos key={f.nombre} fila={f} />
          ))}
        </div>
      </div>
      <ul className="sp-checks" aria-hidden="true">
        {CHEQUEOS.map((c) => (
          <li key={c}><Check size={14} /> {c}</li>
        ))}
      </ul>
    </div>
  );
}

function FilaTurnos({ fila }) {
  return (
    <>
      <span className="sp-name">{fila.nombre}</span>
      {fila.turnos.map((t, i) => (
        <span key={i} className={t ? `sp-cell sp-${t}` : 'sp-cell sp-off'}>
          {t ? NOMBRE[t] : ''}
        </span>
      ))}
    </>
  );
}
