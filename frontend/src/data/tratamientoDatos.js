// Texto del tratamiento de datos que la empresa acepta en su primer ingreso.
// Al cambiar el texto, sube la versión aquí y en backend/src/config/datos.js:
// el servidor vuelve a pedir la aceptación.
export const TRATAMIENTO_VERSION = '2026-11-25';

export const TRATAMIENTO_RESUMEN = [
  {
    id: 'roles',
    titulo: 'Quién es quién',
    texto:
      'Tu empresa es la responsable de los datos de su personal. SAFETURN es el encargado: los trata por cuenta tuya y solo según tus instrucciones.',
  },
  {
    id: 'datos',
    titulo: 'Qué datos se usan',
    texto:
      'Nombre, RUT, cargo, turnos y ausencias del personal. No cargues datos sensibles, como salud, afiliación sindical o convicciones.',
  },
  {
    id: 'fin',
    titulo: 'Para qué',
    texto:
      'Solo para elaborar, validar y entregar turnos. No se venden, no se ceden y no se usan para publicidad.',
  },
  {
    id: 'derechos',
    titulo: 'Derechos de las personas',
    texto:
      'Tu personal puede pedir acceso, rectificación, supresión, oposición, portabilidad y bloqueo. SAFETURN te ayuda a responder.',
  },
  {
    id: 'seguridad',
    titulo: 'Seguridad',
    texto:
      'Los datos de cada empresa están aislados de las demás, viajan cifrados y se accede según el rol de cada usuario.',
  },
  {
    id: 'nube',
    titulo: 'Dónde se guardan',
    texto:
      'Usamos proveedores de nube (base de datos y servidor) que pueden operar fuera de Chile.',
  },
];

export const TRATAMIENTO_CLAUSULAS = [
  {
    titulo: '1. Partes y roles',
    texto:
      'La empresa que crea la cuenta (la «Empresa») es la responsable del tratamiento de los datos personales de sus trabajadores y de las personas que designe como usuarios. SAFETURN actúa como encargado del tratamiento: procesa esos datos por cuenta de la Empresa y solo para prestar el servicio.',
  },
  {
    titulo: '2. Finalidad',
    texto:
      'Los datos se tratan únicamente para elaborar, validar, aprobar y entregar horarios y turnos de trabajo, y para gestionar las solicitudes del personal. SAFETURN no los usa para fines propios, publicidad ni perfilamiento, y no los vende ni cede a terceros.',
  },
  {
    titulo: '3. Datos tratados',
    texto:
      'Identificación y contacto laboral del personal (nombre, RUT, cargo), turnos asignados, jornadas, descansos, ausencias y solicitudes. La Empresa se compromete a no cargar datos sensibles (salud, afiliación sindical, origen, convicciones u otros que la ley califique como tales) ni diagnósticos o antecedentes médicos.',
  },
  {
    titulo: '4. Base de licitud e información al personal',
    texto:
      'La Empresa declara contar con una base legal para tratar los datos de su personal en SAFETURN (por ejemplo, la ejecución del contrato de trabajo y el cumplimiento de obligaciones legales sobre jornada) y se obliga a informar a sus trabajadores de este tratamiento.',
  },
  {
    titulo: '5. Instrucciones y confidencialidad',
    texto:
      'SAFETURN trata los datos solo según las instrucciones de la Empresa y mantiene la confidencialidad de la información. Las cuentas de la Empresa (administradores y validadores) son su responsabilidad: debe entregar accesos solo a quienes los necesiten.',
  },
  {
    titulo: '6. Seguridad',
    texto:
      'SAFETURN mantiene medidas técnicas y organizativas razonables: aislamiento de los datos de cada empresa, comunicaciones cifradas y control de acceso por rol. Ante una vulneración que afecte los datos de la Empresa, SAFETURN la informará sin demora indebida para que pueda cumplir sus deberes de notificación.',
  },
  {
    titulo: '7. Derechos de las personas',
    texto:
      'Los titulares de los datos pueden ejercer ante la Empresa sus derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo temporal. SAFETURN colaborará con la Empresa para atender esas solicitudes dentro de los plazos legales.',
  },
  {
    titulo: '8. Proveedores y transferencia',
    texto:
      'SAFETURN utiliza proveedores de infraestructura en la nube para alojar la base de datos y la aplicación, los cuales pueden operar fuera de Chile. La Empresa autoriza esta subcontratación.',
  },
  {
    titulo: '9. Conservación y término',
    texto:
      'Los datos se conservan mientras la cuenta de la Empresa esté vigente y por el tiempo que la ley exija. Al terminar el servicio, a solicitud de la Empresa, se eliminarán o devolverán los datos, salvo que una norma obligue a conservarlos.',
  },
  {
    titulo: '10. Normativa aplicable',
    texto:
      'Este tratamiento se rige por la Ley N° 19.628 sobre protección de la vida privada, modificada por la Ley N° 21.719 sobre protección y tratamiento de los datos personales, y por la legislación laboral chilena aplicable.',
  },
];
