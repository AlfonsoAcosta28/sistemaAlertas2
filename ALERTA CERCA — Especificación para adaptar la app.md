# ALERTA CERCA — Especificación para adaptar la app

Oct 8, 2026 · @Jair Alfonso Acosta Duran

## Resumen

ALERTA CERCA convierte la app existente en un sistema de alertas comunitarias por proximidad: cada incidente se georreferencia y llega primero a quien está más cerca, con un radio que crece con el tiempo.

La regla central es doble. La alerta se expande desde el lugar de los hechos, y cada usuario decide qué tan lejos y qué categorías quiere recibir. Una notificación solo se envía si se cumplen ambas condiciones.

Ejemplo: un incendio ocurre a 10 km de Ana. Ana configuró un radio personal de 5 km. Aunque la alerta ya cubra 15 km, a Ana no le llega.

El documento está organizado alrededor de los cinco criterios de evaluación del desafío: rapidez y precisión, facilidad de uso, verificación, privacidad y escalabilidad.

## Alcance del prototipo

El prototipo debe demostrar el ciclo completo: reportar, verificar, distribuir por cercanía y recibir según preferencias.

**Dentro del alcance**

- Crear un reporte con ubicación GPS automática, categoría, descripción y foto opcional.
- Distribución por radios escalonados que se amplían con el tiempo.
- Preferencias por usuario: radio máximo y categorías activas.
- Dos estados visibles: reporte ciudadano no confirmado y alerta verificada.
- Panel web básico para moderadores (verificar, descartar, cerrar alertas).
- Mapa con las alertas activas cercanas.

**Fuera del alcance (fase posterior)**

- Integración real con sistemas de Protección Civil (se deja lista la interfaz, no la conexión).
- Difusión por SMS o Cell Broadcast.
- Chat entre usuarios dentro de una alerta.

## Adaptación de la app existente

La adaptación se resuelve con seis módulos; varios pueden reutilizar lo que la app ya tiene (registro, mapa, notificaciones).

| Módulo | Qué hace | Acción sobre la app actual |
| --- | --- | --- |
| Ubicación | Obtiene la posición del usuario y del incidente | Agregar permisos de ubicación y actualización en segundo plano por cambio significativo |
| Reportar | Formulario rápido de incidente | Nuevo: máximo 3 toques para enviar |
| Preferencias | Radio personal y categorías | Nuevo: pantalla en Ajustes y en el onboarding |
| Motor de distribución | Calcula a quién llega cada alerta y cuándo | Nuevo, en el servidor |
| Notificaciones | Push con sonido según severidad | Adaptar el sistema actual de push (FCM/APNs) |
| Moderación | Verificar o descartar reportes | Nuevo panel web con roles |

Datos que hacen falta de la app actual: stack tecnológico, si ya usa notificaciones push y cómo maneja usuarios. Con eso se ajusta este plan.

## Categorías y severidad

Cada categoría trae un radio inicial, un radio máximo y una severidad por defecto; el moderador puede ajustarlos por alerta.

| Categoría | Severidad por defecto | Radio inicial | Radio máximo | Vigencia por defecto |
| --- | --- | --- | --- | --- |
| Persona desaparecida | Alta | 2 km | 50 km | 72 h |
| Robo de vehículo | Media | 1 km | 20 km | 6 h |
| Incendio | Alta | 1 km | 10 km | 12 h |
| Inundación | Alta | 2 km | 25 km | 24 h |
| Accidente vial / bloqueo | Baja | 0.5 km | 5 km | 3 h |
| Riesgo sanitario o fuga | Alta | 1 km | 15 km | 12 h |
| Otro | Baja | 0.5 km | 3 km | 3 h |

Severidad define el tipo de notificación: **Alta** suena aunque el teléfono esté en silencio (alerta crítica, si el usuario la autoriza), **Media** es push normal y **Baja** solo aparece en el mapa y el historial.

Los valores son propuesta inicial para el prototipo y conviene validarlos con Protección Civil local.

## Preferencias del usuario y regla de filtrado

Cada usuario elige su radio personal (1 a 50 km, por defecto 5 km) y las categorías que quiere recibir; nada fuera de eso le llega.

**Lo que configura el usuario**

- Radio personal con un control deslizante y un círculo sobre el mapa que muestra el área real.
- Categorías activas, todas encendidas al inicio salvo "Otro".
- Si quiere recibir reportes no confirmados o solo alertas verificadas.
- Horario de silencio, que nunca bloquea alertas de severidad Alta verificadas.
- Zonas guardadas opcionales (casa, trabajo, escuela de los hijos), cada una con su propio radio.

**Regla de envío**

Una alerta se envía a un usuario solo si se cumplen las cuatro condiciones:

1. La categoría está activa en sus preferencias.
2. La distancia al incidente es menor o igual a su radio personal.
3. La distancia es menor o igual al radio actual de la alerta (que crece con el tiempo).
4. Su filtro de verificación lo permite.

En una sola línea: se notifica si la distancia es menor o igual al mínimo entre el radio personal y el radio actual de la alerta, y la categoría está activa.

```latex
d(\text{usuario}, \text{incidente}) \le \min(r_{\text{usuario}}, r_{\text{alerta}}(t))
```

Cada usuario recibe una alerta una sola vez, aunque el radio siga creciendo o tenga varias zonas guardadas dentro del área.

## Verificación: verificadas vs reportes ciudadanos

Toda alerta muestra siempre su estado con color, ícono y texto, para que nadie confunda un rumor con una alerta oficial.

| Estado | Quién la origina | Cómo se ve | Expansión del radio |
| --- | --- | --- | --- |
| Reporte ciudadano | Cualquier usuario | Amarillo, ícono de persona, "No confirmado" | Solo el radio inicial |
| Corroborado | Varios usuarios independientes | Naranja, "Varios reportes" | Puede pasar al segundo anillo |
| Verificada | Moderador o autoridad | Verde o rojo según severidad, ícono de escudo, "Verificada por …" | Expansión completa hasta el radio máximo |
| Descartada | Moderador | Se retira del mapa; aviso de corrección a quien la recibió | Se detiene |
| Cerrada | Moderador o autoridad | Gris, "Resuelta" en el historial | Se detiene |

**Señales que suben la confianza de un reporte**

- Corroboración: 3 o más reportes de la misma categoría, de usuarios distintos, a menos de 500 m y 15 minutos.
- Reputación del autor: historial de reportes confirmados frente a descartados.
- Evidencia: foto tomada en el momento y ubicación GPS coherente con el lugar reportado.
- Botón "Yo también lo veo" y "Esto no es cierto" para quienes están cerca.

**Contra abuso**

Límite de reportes por usuario por hora, verificación de número telefónico al registrarse y suspensión automática tras varios reportes descartados. Las alertas de persona desaparecida pasan siempre por un moderador antes de expandirse, porque exponen datos de terceros.

## Privacidad y protección de datos

El servidor nunca guarda un historial de dónde ha estado cada usuario: solo conoce su celda aproximada actual, y la ubicación exacta del usuario nunca sale del teléfono.

**Ubicación del usuario (quien recibe)**

- El teléfono reporta solo una celda geográfica (H3, resolución 8, unos 0.7 km²), no coordenadas exactas.
- Se guarda únicamente la última celda; se sobrescribe, no se acumula historial.
- El servidor envía la alerta a las celdas candidatas, y el teléfono hace el cálculo fino de distancia con su GPS antes de mostrarla.
- Si el usuario deshabilita la ubicación en segundo plano, puede usar solo zonas guardadas.

**Ubicación del incidente (quien reporta)**

- La identidad del autor nunca se muestra a otros usuarios; solo moderadores la ven.
- Mientras el reporte no esté verificado, el punto público se muestra con un margen de unos 100 m.
- Fotos: se eliminan metadatos EXIF y se difuminan rostros y placas de forma automática antes de publicar.

**Cumplimiento y gobierno de datos**

- Aviso de privacidad y consentimiento explícito conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares; si se opera con una autoridad, aplica la ley general para sujetos obligados.
- Derechos ARCO accesibles desde Ajustes, con botón de borrar cuenta y datos.
- Reportes y fotos se anonimizan 90 días después de cerrada la alerta; datos de personas desaparecidas se retiran al resolverse el caso.
- Cifrado en tránsito (TLS) y en reposo; acceso al panel de moderación con registro de auditoría.

## Experiencia de uso y compatibilidad

La meta es que cualquier persona reporte en menos de 15 segundos y entienda una alerta de un vistazo, en un teléfono de gama baja.

**Pantallas clave**

1. Mapa principal con alertas activas y el círculo del radio personal.
2. Botón flotante "Reportar": categoría con íconos grandes, ubicación ya puesta, foto y descripción opcionales.
3. Detalle de alerta: estado de verificación, distancia, hora, instrucciones y botones "Yo también lo veo" / "Compartir".
4. Ajustes de alertas: radio, categorías, verificación y zonas guardadas.

**Compatibilidad**

- Android 8 o superior e iOS 15 o superior, con un solo código (React Native o Flutter, según el stack actual).
- PWA como respaldo para quien no instale la app; las notificaciones web llegan con menor fiabilidad en iOS.
- Modo de datos bajo: mapa ligero y fotos comprimidas, pensado para redes 3G.
- Si no hay conexión, el reporte se guarda y se envía en cuanto vuelva la señal.

**Accesibilidad**

Texto escalable, contraste AA, estados que no dependen solo del color, compatibilidad con lector de pantalla y vibración distinta por severidad. Interfaz en español, preparada para agregar lenguas indígenas de la región.

## Escalabilidad e integración con autoridades

El prototipo se diseña desde el inicio para hablar el estándar internacional de alertas (CAP, Common Alerting Protocol), así la conexión con Protección Civil es configuración, no reescritura.

**Integración**

- Cada alerta se puede exportar e importar como mensaje CAP 1.2 (categoría, severidad, urgencia, área como polígono o círculo).
- API pública con llaves por institución: las autoridades publican alertas que entran ya como Verificadas.
- Rol "Autoridad" en el panel: Protección Civil municipal o estatal, policía, bomberos, cada uno limitado a su territorio y categorías.
- Webhooks salientes: un reporte ciudadano de incendio o inundación puede avisar al centro de mando en tiempo real.
- Futuro: puente con el 911, con fichas de búsqueda de personas desaparecidas y con canales de difusión masiva.

**Escala técnica**

- Índice espacial por celdas H3: buscar destinatarios es una consulta por lista de celdas, no un cálculo de distancia contra todos los usuarios.
- Envío de notificaciones por cola y en lotes, para no saturar ante un evento grande.
- Servidor sin estado, escalable horizontalmente; la base se puede particionar por región.
- Meta del prototipo: una ciudad de 100,000 usuarios activos; meta de diseño: escala estatal.

## Plan de trabajo y métricas

El prototipo completo cabe en unas 6 semanas, en cuatro fases; cada fase cierra con una demo funcional.

1. **Semana 1 — Base:** modelo de datos, PostGIS y H3, permisos de ubicación, pantalla de preferencias.
2. **Semanas 2 y 3 — Núcleo:** flujo de reporte, motor de distribución con anillos, notificaciones push, mapa de alertas.
3. **Semana 4 — Confianza:** estados de verificación, corroboración automática, panel de moderación, límites anti-abuso.
4. **Semanas 5 y 6 — Cierre:** privacidad (difuminado de fotos, borrado de datos), exportación CAP, pruebas en varios teléfonos, demo con datos simulados.

**Métricas por criterio de evaluación**

| Criterio | Métrica | Meta del prototipo |
| --- | --- | --- |
| Rapidez y precisión | Tiempo desde publicación hasta notificación en el primer anillo | Menos de 10 s |
| Rapidez y precisión | Error de ubicación del incidente | Menos de 50 m con GPS activo |
| Facilidad de uso | Tiempo para enviar un reporte | Menos de 15 s |
| Compatibilidad | Dispositivos probados | 5 o más modelos Android e iOS, incluido gama baja |
| Verificación | Alertas mostradas sin estado visible | 0 |
| Privacidad | Coordenadas exactas de usuarios guardadas en servidor | 0 |
| Escalabilidad | Usuarios simulados atendidos en una alerta | 100,000 sin degradar la meta de 10 s |

La demo final puede simular usuarios distribuidos en una ciudad piloto y mostrar en vivo cómo una alerta crece por anillos y a quién le llega.
