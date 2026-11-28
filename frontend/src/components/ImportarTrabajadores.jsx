import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { apiRequest } from '../store/AuthContext.jsx';
import {
  COLUMNAS,
  MAX_FILAS,
  analizarPlanilla,
  filasParaImportar,
  leerPlanilla,
} from '../lib/importTrabajadores.js';
import { Badge, Button, Modal } from './ui.jsx';

const ACEPTA = '.xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const ESTADOS = {
  ok: { tone: 'ok', etiqueta: 'Listo' },
  error: { tone: 'danger', etiqueta: 'Revisar' },
  existe: { tone: 'neutral', etiqueta: 'Ya existe' },
  repetido: { tone: 'warn', etiqueta: 'Repetido' },
};

function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/**
 * Carga masiva de trabajadores desde Excel o CSV.
 * Lee el archivo en el navegador, muestra una vista previa con los problemas de cada fila y solo
 * entonces envía las filas correctas al servidor.
 */
export function ImportarTrabajadores({ open, onClose, existentes, token, onDone }) {
  const entrada = useRef(null);
  const [fase, setFase] = useState('elegir'); // elegir | revisar | listo
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [analisis, setAnalisis] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [soloProblemas, setSoloProblemas] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const reiniciar = () => {
    setFase('elegir');
    setNombreArchivo('');
    setAnalisis(null);
    setLeyendo(false);
    setEnviando(false);
    setArrastrando(false);
    setSoloProblemas(false);
    setError('');
    setResultado(null);
  };

  const cerrar = () => {
    if (enviando) return;
    reiniciar();
    onClose?.();
  };

  const elegirArchivo = async (archivo) => {
    if (!archivo) return;
    setError('');
    setLeyendo(true);
    try {
      const filas = await leerPlanilla(archivo);
      setAnalisis(analizarPlanilla(filas, { existentes }));
      setNombreArchivo(archivo.name);
      setSoloProblemas(false);
      setFase('revisar');
    } catch (problema) {
      setError(problema.message || 'No pude leer el archivo.');
    } finally {
      setLeyendo(false);
    }
  };

  const importar = async () => {
    const trabajadores = filasParaImportar(analisis);
    if (!trabajadores.length) return;
    setError('');
    setEnviando(true);
    try {
      const respuesta = await apiRequest('/guardias/importar', {
        method: 'POST',
        token,
        body: { trabajadores },
      });
      setResultado(respuesta);
      setFase('listo');
      onDone?.(respuesta);
    } catch (problema) {
      setError(problema.message || 'No se pudo importar. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  const resumen = analisis?.resumen;
  const faltantes = analisis?.faltantes || [];
  const sinFilas = Boolean(analisis) && faltantes.length === 0 && analisis.filas.length === 0;
  const fuera = resultado
    ? [...resultado.invalidos.map((f) => ({ ...f, motivo: f.errores.join(' ') })), ...resultado.omitidos].sort(
        (a, b) => a.fila - b.fila
      )
    : [];
  const conProblemas = resumen ? resumen.errores + resumen.repetidos + resumen.existentes : 0;
  const filasVisibles = analisis
    ? soloProblemas
      ? analisis.filas.filter((f) => f.estado !== 'ok')
      : analisis.filas
    : [];

  let titulo = 'Cargar trabajadores desde Excel';
  let subtitulo = 'Sube tu planilla, revisa la vista previa y confirma. No se guarda nada hasta que lo apruebes.';
  if (fase === 'listo') {
    titulo = 'Carga terminada';
    subtitulo = nombreArchivo;
  }

  let pie = (
    <Button variant="ghost" onClick={cerrar}>
      Cancelar
    </Button>
  );
  if (fase === 'revisar') {
    pie = (
      <>
        <Button variant="ghost" onClick={cerrar} disabled={enviando}>
          Cancelar
        </Button>
        <Button
          icon={Upload}
          onClick={importar}
          disabled={enviando || !resumen || resumen.listos === 0}
        >
          {enviando
            ? 'Importando…'
            : resumen?.listos
              ? `Importar ${plural(resumen.listos, 'trabajador', 'trabajadores')}`
              : 'No hay filas para importar'}
        </Button>
      </>
    );
  }
  if (fase === 'listo') {
    pie = <Button onClick={cerrar}>Listo</Button>;
  }

  return (
    <Modal open={open} onClose={cerrar} title={titulo} subtitle={subtitulo} wide footer={pie}>
      {error ? (
        <div className="notice notice-danger import-notice" role="alert">
          <AlertTriangle size={18} />
          <div>
            <strong>No se pudo continuar</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {fase === 'elegir' ? (
        <div className="import-step">
          <button
            type="button"
            className={`import-drop ${arrastrando ? 'is-over' : ''}`}
            onClick={() => entrada.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(event) => {
              event.preventDefault();
              setArrastrando(false);
              elegirArchivo(event.dataTransfer.files?.[0]);
            }}
            disabled={leyendo}
          >
            <span className="import-drop-icon">
              {leyendo ? <RefreshCw size={26} className="spin" /> : <FileSpreadsheet size={26} />}
            </span>
            <strong>{leyendo ? 'Leyendo el archivo…' : 'Arrastra tu archivo aquí o haz clic para elegirlo'}</strong>
            <span>Excel (.xlsx) o CSV · hasta {MAX_FILAS.toLocaleString('es-CL')} trabajadores · máximo 5 MB</span>
          </button>
          <input
            ref={entrada}
            type="file"
            accept={ACEPTA}
            className="import-file-input"
            data-testid="import-file"
            onChange={(event) => {
              elegirArchivo(event.target.files?.[0]);
              event.target.value = '';
            }}
          />

          <div className="import-help">
            <div className="import-help-head">
              <strong>¿Cómo debe venir el archivo?</strong>
              <a className="btn btn-secondary btn-sm" href="/plantilla-trabajadores.xlsx" download>
                <Download size={15} strokeWidth={2.2} />
                <span>Descargar plantilla</span>
              </a>
            </div>
            <p>
              Una fila por trabajador y los títulos en la primera fila. Solo el nombre y el RUT son obligatorios;
              reconocemos títulos parecidos (por ejemplo «Correo» o «Email»).
            </p>
            <div className="import-cols">
              {COLUMNAS.map((columna) => (
                <Badge key={columna.campo} tone={columna.obligatoria ? 'info' : 'neutral'}>
                  {columna.titulo}
                  {columna.obligatoria ? ' *' : ''}
                </Badge>
              ))}
            </div>
            <p className="import-hint">
              Si un RUT ya está en tu base, esa fila se omite: no se duplica ni se modifica a nadie.
            </p>
          </div>
        </div>
      ) : null}

      {fase === 'revisar' && analisis ? (
        <div className="import-step">
          <div className="import-file-row">
            <span className="import-file-name">
              <FileSpreadsheet size={16} /> {nombreArchivo}
            </span>
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={reiniciar} disabled={enviando}>
              Elegir otro archivo
            </Button>
          </div>

          {faltantes.length ? (
            <div className="notice notice-danger">
              <AlertTriangle size={18} />
              <div>
                <strong>Falta una columna obligatoria</strong>
                <p>
                  No encontré {faltantes.length === 1 ? 'la columna' : 'las columnas'}{' '}
                  {faltantes.map((f) => `«${f}»`).join(' y ')} en la primera fila. Revisa los títulos o usa la
                  plantilla.
                </p>
              </div>
            </div>
          ) : sinFilas ? (
            <div className="notice notice-warn">
              <AlertTriangle size={18} />
              <div>
                <strong>No encontré trabajadores</strong>
                <p>El archivo tiene los títulos pero ninguna fila con datos debajo.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="import-chips">
                <Badge tone="ok" dot>
                  {plural(resumen.listos, 'listo para importar', 'listos para importar')}
                </Badge>
                {resumen.errores ? (
                  <Badge tone="danger" dot>
                    {plural(resumen.errores, 'con problemas', 'con problemas')}
                  </Badge>
                ) : null}
                {resumen.existentes ? (
                  <Badge tone="neutral" dot>
                    {plural(resumen.existentes, 'ya existe en tu base', 'ya existen en tu base')}
                  </Badge>
                ) : null}
                {resumen.repetidos ? (
                  <Badge tone="warn" dot>
                    {plural(resumen.repetidos, 'RUT repetido en el archivo', 'RUT repetidos en el archivo')}
                  </Badge>
                ) : null}
              </div>

              {analisis.ignoradas.length ? (
                <p className="import-hint">
                  Columnas que no se usan y se ignoran: {analisis.ignoradas.join(', ')}.
                </p>
              ) : null}
              {analisis.demasiadas ? (
                <div className="notice notice-warn">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Archivo muy grande</strong>
                    <p>
                      Solo se revisaron las primeras {MAX_FILAS.toLocaleString('es-CL')} filas. Importa estas y luego
                      sube el resto en otro archivo.
                    </p>
                  </div>
                </div>
              ) : null}
              {conProblemas ? (
                <label className="import-filter">
                  <input
                    type="checkbox"
                    checked={soloProblemas}
                    onChange={(event) => setSoloProblemas(event.target.checked)}
                  />
                  Mostrar solo las filas que no se importarán
                </label>
              ) : null}

              <div className="import-table-wrap">
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Trabajador</th>
                      <th>Cargo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasVisibles.map((fila) => {
                      const estado = ESTADOS[fila.estado];
                      return (
                        <tr key={fila.fila} className={fila.estado === 'ok' ? '' : 'is-problem'}>
                          <td className="import-num">{fila.fila}</td>
                          <td>
                            <strong>{fila.nombre || '(sin nombre)'}</strong>
                            <span className="import-sub">{fila.rut || '(sin RUT)'}</span>
                          </td>
                          <td>{fila.datos?.cargo || '—'}</td>
                          <td>
                            <Badge tone={estado.tone}>{estado.etiqueta}</Badge>
                            {fila.motivo ? <span className="import-reason">{fila.motivo}</span> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : null}

      {fase === 'listo' && resultado ? (
        <div className="import-step">
          <div className="import-done">
            <span className="import-done-icon">
              <CheckCircle2 size={30} />
            </span>
            <div>
              <strong>
                {resultado.creados
                  ? `Se importaron ${plural(resultado.creados, 'trabajador', 'trabajadores')}`
                  : 'No se importó a nadie'}
              </strong>
              <span>
                {fuera.length
                  ? `${plural(fuera.length, 'fila quedó', 'filas quedaron')} fuera, con el motivo abajo.`
                  : 'Ya están en la base de trabajadores de tu empresa.'}
              </span>
            </div>
          </div>
          {fuera.length ? (
            <div className="import-table-wrap">
              <table className="import-table">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Trabajador</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {fuera.map((fila) => (
                      <tr key={`${fila.fila}-${fila.rut}`} className="is-problem">
                        <td className="import-num">{fila.fila}</td>
                        <td>
                          <strong>{fila.nombre || '(sin nombre)'}</strong>
                          <span className="import-sub">{fila.rut || '(sin RUT)'}</span>
                        </td>
                        <td>{fila.motivo}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
