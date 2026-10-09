# Corto y Cambio · Agenda con tiempos de pose

Agenda de peluquería que entiende los **tiempos de pose**. Un servicio no es un bloque de tiempo: es una secuencia de tramos. La estilista solo está ocupada en los tramos activos, así que durante la pose de un color puede atender a otra clienta.

| Tramo | Estilista | Lavacabezas |
| --- | --- | --- |
| **A** · activo (aplicación, secado, corte) | ocupada | — |
| **P** · pose | **libre** | — |
| **L** · lavado | ocupada | ocupa 1 de 2 |

Proyecto en Lovable: https://lovable.dev/projects/afb344c1-caf6-4384-aa41-1f2af15c190e
Previsualización: https://id-preview--afb344c1-caf6-4384-aa41-1f2af15c190e.lovable.app

## Cómo arrancarlo

Necesitas Node.js 18 o superior.

```sh
npm install
npm run dev        # http://localhost:8080
```

Otros comandos:

```sh
npm test           # tests del motor de reglas (Vitest)
npm run build      # comprobación de tipos + build de producción en dist/
```

No hace falta configurar nada: la primera vez que se abre, la app genera datos de ejemplo y los guarda en el navegador.

## Pantallas

**Web pública** (fondo negro, acento rosa flúor, Poppins + Inter)

| Ruta | Qué hace |
| --- | --- |
| `/` | Portada: servicios con precio y duración, cómo funciona la pose, equipo |
| `/reservar` | Reserva paso a paso: servicio → ¿primera vez con color? → profesional → día y hora → prueba de alergia (si hace falta) → datos → confirmación |
| `/reserva/:código` | Resumen de la cita, descarga del `.ics` y cancelación |
| `/mis-citas` | Buscar las próximas citas con el móvil |

**Equipo** (`/equipo`, herramienta de trabajo en claro, sin adornos)

| Ruta | Qué hace |
| --- | --- |
| `/equipo/agenda` | Agenda del día por profesional con los tramos dibujados (A oscuro, P rayado, L azul, prueba de alergia en ámbar) y una columna de lavacabezas. Las citas con borde rosa están dentro de la pose de otra. Toca un hueco para crear una cita o una cita para ver el detalle |
| `/equipo/agenda/nueva` | Crear cita con validación en vivo y huecos libres sugeridos (en rosa los que caen dentro de una pose). Si es un primer color, permite reservar la prueba de alergia en el mismo paso |
| `/equipo/agenda/cita/:id` | Mover o editar una cita, con la misma validación |
| `/equipo/clientas` | Fichas, búsqueda, historial y estado de color / prueba de alergia |
| `/equipo/servicios` | Catálogo con sus tramos, horarios del equipo y recursos compartidos |
| `/equipo/avisos` | Bandeja de los WhatsApp y correos que se enviarían (simulados) |
| `/equipo/ajustes` | Dirección del salón y **reinicio de los datos de ejemplo** |

## Reglas implementadas

Toda la lógica vive en [`src/lib/scheduling.ts`](src/lib/scheduling.ts) y está cubierta por [`src/lib/scheduling.test.ts`](src/lib/scheduling.test.ts).

- **Estilista**: un horario es válido para el servicio S con la estilista E si ningún tramo A o L de S coincide con un tramo A o L de otro turno de E. Los tramos P no bloquean.
- **Pose**: por tanto, otra clienta entra en una pose solo si todos sus tramos activos caben dentro (un corte de 45 min cabe en la pose de 50 min de un balayage; un corte y brushing de 60 min, no).
- **Lavacabezas**: hay 2. En cada tramo L tiene que quedar uno libre durante todo el tramo.
- **Cabinas**: hay 5. La clienta ocupa una durante todo su servicio, pose incluida, así que nunca hay más de 5 clientas a la vez. Es una decisión propia a partir del dato del briefing.
- **Horario**: martes a viernes de 10:00 a 20:00 y sábados de 9:30 a 15:00. El servicio entero tiene que empezar y terminar dentro del horario de la estilista.
- **Reserva pública**: no muestra horarios pasados ni fuera del horario. Propone horas cada 15 min y, además, las horas en que termina cada tramo ocupado de la estilista, para que aparezcan los huecos de pose que no caen en la rejilla. Con "sin preferencia" asigna la profesional con menos carga ese día.
- **Prueba de alergia**: en un primer color, la prueba (10 min) tiene que tener fecha ≤ fecha del turno − 48 h. Las 48 h son reales, teniendo en cuenta el cambio de hora del 25 de octubre. Cuenta como historial de color la marca "ya se ha hecho color en el salón" en la ficha o un color anterior en la agenda. La reserva pública solo ofrece colores para los que da tiempo a hacer la prueba antes y la reserva en el mismo flujo.
- **Una clienta no puede tener dos citas que se solapen.**
- **Archivo de calendario (.ics)**: `DTSTART`/`DTEND` con `TZID=Europe/Madrid` y la definición de zona horaria incluida, `LOCATION` con la dirección del salón y aviso 2 h antes. Si hay prueba de alergia, va en el mismo archivo.
- **Hora del salón**: todas las fechas se calculan en Europe/Madrid, aunque el navegador esté en otra zona horaria.

## Qué está simulado

- **Sin backend**: todo se guarda en `localStorage` (clave `corto-y-cambio:agenda`). Los datos sobreviven a recargar y a cerrar la pestaña. Si la agenda y la web pública están abiertas en dos pestañas, se sincronizan solas.
- **Avisos por WhatsApp y correo**: no se envía nada. Cada confirmación, cambio o cancelación genera el mensaje con su texto final en **Equipo → Avisos** (`state.outbox`), listo para conectar un proveedor.
- **Acceso del equipo**: `/equipo` no tiene login. El enlace "Acceso equipo" está en el pie de la web.
- **Pagos**: no hay. El precio se paga en el salón.
- **Dirección**: "Calle del Espíritu Santo 23, 28004 Madrid" es de ejemplo. Se cambia en **Equipo → Ajustes** y se usa en la web, los avisos y el `.ics`.
- **Clientas, teléfonos y correos** son inventados (correos en `example.com`).

## Cómo reiniciar los datos de ejemplo

- Desde la app: **Equipo → Ajustes → Reiniciar datos de ejemplo**.
- A mano: borra la clave `corto-y-cambio:agenda` del `localStorage` (DevTools → Application → Local Storage) y recarga.

Los datos se generan relativos al día de hoy: 10 días atrás (citas completadas y alguna "no se presentó") y unas 3 semanas hacia delante. Hoy y el próximo día abierto tienen la agenda llena; los días siguientes, menos, para que haya huecos que probar.

### Casos de prueba incluidos

- **Miércoles y viernes**: Lucía tiene tres balayages (10:00, 12:30 y 15:00) con un corte dentro de cada pose. Es el caso del briefing.
- **Sábados**: los dos lavacabezas coinciden de 11:10 a 11:20, así que no entra un tercer lavado en ese momento.
- **Paula Nieto**: primera vez con color. Tiene la prueba de alergia el próximo día abierto y su balayage al menos 48 h después.
- **Nuria Vidal**: solo se ha cortado aquí. Si se le intenta dar un color sin prueba, la agenda lo bloquea y propone reservar la prueba.

## Estructura

```
src/
  lib/
    scheduling.ts    motor de reglas: tramos, disponibilidad, lavacabezas, cabinas, alergia
    catalog.ts       servicios, equipo, horarios y recursos
    seed.ts          datos de ejemplo (pasan por el mismo motor de reglas)
    store.tsx        estado + persistencia en localStorage
    ics.ts           generación del archivo de calendario
    bookings.ts      creación de citas, teléfonos y textos de los avisos
    time.ts          fechas en hora del salón (Europe/Madrid)
  pages/public/      web pública y reserva
  pages/admin/       agenda y gestión del equipo
```

Stack: React 18, TypeScript, Vite, Tailwind CSS y React Router. Sin dependencias de backend.
