import { FileSpreadsheet, Plug, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { Badge, Button, Modal } from './ui.jsx';

/**
 * Punto de entrada para conectar SAFETURN con otras aplicaciones (sistemas de recursos humanos o de
 * remuneraciones) que envíen a los trabajadores en forma masiva. Por ahora es informativo: deja
 * visible el camino y lleva a la carga desde Excel, que ya funciona.
 */
export function ConexionesModal({ open, onClose, onCargarExcel }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Conectar otra aplicación"
      subtitle="Trae a tus trabajadores desde los sistemas que ya usas."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button icon={FileSpreadsheet} onClick={onCargarExcel}>
            Cargar desde Excel
          </Button>
        </>
      }
    >
      <div className="conn-body">
        <div className="conn-status">
          <Badge tone="info" dot>
            Próximamente
          </Badge>
          <p>
            Muchas empresas ya tienen a su personal en un sistema de recursos humanos o de remuneraciones. Estamos
            preparando las conexiones para que esos sistemas envíen a los trabajadores a SAFETURN sin que tengas que
            subir archivos.
          </p>
        </div>

        <ul className="conn-list">
          <li>
            <span className="conn-icon">
              <Users size={18} />
            </span>
            <div>
              <strong>Todo tu personal de una vez</strong>
              <span>La conexión carga a los trabajadores de forma masiva, con las mismas validaciones que la carga desde Excel.</span>
            </div>
          </li>
          <li>
            <span className="conn-icon">
              <RefreshCw size={18} />
            </span>
            <div>
              <strong>Base al día</strong>
              <span>Cuando el personal cambie en el otro sistema, tu base de trabajadores en SAFETURN podrá reflejarlo.</span>
            </div>
          </li>
          <li>
            <span className="conn-icon">
              <ShieldCheck size={18} />
            </span>
            <div>
              <strong>Tú tienes el control</strong>
              <span>Solo la persona titular o un administrador de la empresa podrá conectar una aplicación y desconectarla.</span>
            </div>
          </li>
        </ul>

        <div className="conn-foot">
          <Plug size={16} />
          <span>Mientras tanto, usa «Cargar desde Excel»: sube tu planilla, revisa la vista previa y confirma.</span>
        </div>
      </div>
    </Modal>
  );
}
