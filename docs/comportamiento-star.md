---
id: comportamiento-star
title: 🌟 Preguntas de Comportamiento (STAR)
sidebar_position: 1
---

# 🌟 Preguntas de Comportamiento (STAR)

---

## 1. ¿Qué son las preguntas de comportamiento?

Las preguntas de comportamiento son aquellas que te piden que narres situaciones reales del pasado. No preguntan qué *harías* hipotéticamente, sino qué *hiciste* en concreto.

**Ejemplos típicos:**
- "Cuéntame de un momento en que tuviste que lidiar con un compañero difícil."
- "¿Cuándo cometiste un error importante? ¿Qué hiciste?"
- "Describe una situación donde tomaste la iniciativa."

### ¿Por qué las empresas las hacen?

> **El comportamiento pasado es el mejor predictor del comportamiento futuro.**

Las empresas asumen que si resolviste bien un problema de comunicación en tu trabajo anterior, probablemente harás lo mismo en el nuevo. No están evaluando si tuviste el problema "correcto", sino *cómo pensaste*, *cómo actuaste* y *qué aprendiste*.

### ¿En qué nivel aparecen más?

| Nivel | Frecuencia |
|-------|-----------|
| Junior | Pocas (el foco es técnico) |
| Semi-senior | Moderada (empiezan a importar soft skills) |
| Senior | Alta (ownership, liderazgo, conflictos) |
| Staff / Lead | Muy alta (casi toda la entrevista puede ser así) |

A partir de semi-senior, asumir que **al menos una ronda completa** será de preguntas de comportamiento.

### Diferencia con preguntas técnicas

| Técnicas | Comportamiento |
|----------|---------------|
| Hay respuesta correcta o incorrecta | No hay una respuesta "correcta" |
| Se evalúa conocimiento | Se evalúa razonamiento y aprendizaje |
| Se puede estudiar de memoria | Requiere reflexión sobre experiencia propia |
| El silencio es incómodo | El silencio para pensar es aceptable |

---

## 2. El Método STAR

STAR es un framework para estructurar respuestas a preguntas de comportamiento de forma clara, concisa y convincente.

```
S → Situación
T → Tarea (Task)
A → Acción
R → Resultado
```

### S — Situación

Establece el contexto. Responde: *¿cuándo?, ¿dónde?, ¿en qué proyecto?*

**Objetivo:** que el entrevistador entienda el escenario sin que tengas que dar demasiado detalle. 2-3 oraciones son suficientes.

✅ **Bien:** "En mi trabajo anterior en una fintech, a principios de 2023, estábamos lanzando una nueva feature de pagos en tiempo real. Teníamos un deadline fijo porque dependía de una campaña de marketing."

❌ **Mal:** "Bueno, en mi empresa anterior... que era una empresa de tecnología... teníamos un proyecto... era sobre pagos..." *(vago, sin contexto útil)*

---

### T — Tarea (Task)

Especifica cuál era **tu responsabilidad específica** en esa situación. No la del equipo, la tuya.

**Objetivo:** que quede claro que eras un actor activo, no un espectador.

✅ **Bien:** "Mi responsabilidad era diseñar la arquitectura del servicio de notificaciones y asegurarme de que las alertas llegaran en menos de 500ms."

❌ **Mal:** "El equipo tenía que entregar la feature." *(no dice qué hacías tú)*

---

### A — Acción

La parte más importante. Describe qué **hiciste tú** con detalle técnico y proceso de pensamiento.

**Objetivo:** demostrar cómo piensas, qué consideraste, qué priorizaste.

**Reglas:**
- Usa "yo", no "nosotros"
- Da detalles técnicos concretos (tecnologías, patrones, decisiones)
- Explica *por qué* tomaste cada decisión, no solo *qué* hiciste
- Si el equipo hizo algo, di: "yo coordiné con el equipo para que..."

✅ **Bien:** "Primero hice profiling con dotnet-trace y encontré que el cuello de botella estaba en queries N+1 hacia la base de datos. Refactoricé el repositorio usando `.Include()` de EF Core y añadí un índice compuesto en las columnas `UserId` y `CreatedAt`. Luego implementé un caché en memoria con `IMemoryCache` para las consultas más frecuentes."

❌ **Mal:** "Lo arreglé optimizando las queries." *(demasiado genérico)*

---

### R — Resultado

Cierra con resultados **medibles** y reflexión.

**Objetivo:** demostrar impacto real y capacidad de aprender.

**Incluye:**
- Métrica concreta (tiempo, porcentaje, dinero, usuarios)
- Qué aprendiste
- Qué harías diferente (opcional pero poderoso)

✅ **Bien:** "Las queries pasaron de 800ms a 120ms de promedio. El error rate en producción bajó de 2.3% a 0.1% en la primera semana. Aprendí que el profiling debería ser parte del proceso de revisión antes de lanzar a producción, no solo cuando hay un problema."

❌ **Mal:** "Todo salió bien y el cliente quedó contento." *(sin métricas, sin aprendizaje)*

---

### Errores comunes al responder

| Error | Por qué es un problema | Corrección |
|-------|----------------------|------------|
| "Nosotros hicimos..." | No queda claro tu rol | Usa "yo" y especifica tu contribución |
| "Todo salió bien" | Sin resultados medibles | Busca siempre una métrica o impacto concreto |
| Inventar situaciones | El entrevistador hace preguntas de seguimiento | Usa situaciones reales; si son aburridas, elige las mejores |
| Respuesta de 30 segundos | Demasiado superficial | Target: 2-3 minutos |
| Respuesta de 8 minutos | El entrevistador se pierde | Practica en voz alta con timer |
| Hablar mal del ex-empleador | Señal de red flag inmediata | Sé neutral, enfócate en lo que aprendiste |
| No tener resultado | Parece historia incompleta | Si no hubo resultado medible, di qué aprendiste |

---

## 3. Cómo prepararse

### Paso 1: Construye tu banco de situaciones

Antes de la entrevista, lista **5-7 situaciones** de tu experiencia que puedas adaptar a diferentes preguntas.

**Tipos de situaciones a preparar:**

| Tipo | Ejemplo de pregunta que cubre |
|------|-------------------------------|
| 🐛 Desafío técnico difícil | "Cuéntame de un bug difícil..." |
| 🤝 Conflicto con colega/PM | "¿Cómo manejaste un desacuerdo?" |
| 🧭 Decisión con info incompleta | "¿Cuándo tuviste que decidir sin todos los datos?" |
| 💥 Error que cometiste | "¿Cuál fue tu mayor fracaso?" |
| 🏆 Éxito importante | "¿De qué logro estás más orgulloso?" |
| 🔄 Cambio de prioridades | "¿Cuándo cambiaron los requisitos a mitad?" |
| 👑 Liderazgo sin autoridad formal | "¿Cuándo tomaste la iniciativa?" |

### Paso 2: Escríbelas en formato STAR

Literalmente escríbelas. No las memorices palabra por palabra, pero sí ten claro el esqueleto:
- Situación en 1-2 oraciones
- Tu tarea específica
- 3-5 acciones clave que tomaste
- Resultado con número

### Paso 3: Practica en voz alta

Leer STAR en silencio no es suficiente. Grábate o practica con alguien. El objetivo es fluir naturalmente en 2-3 minutos sin sonar como que estás recitando.

---

## 4. Preguntas por categoría con respuestas ejemplo

---

### 🔧 Desafíos Técnicos

---

#### 1. "Cuéntame de un bug difícil que tuviste que resolver. ¿Cómo lo abordaste?"

**Ejemplo de respuesta STAR:**

> **Situación:** En mi rol como desarrollador .NET en una empresa de e-commerce, teníamos un bug que aparecía de forma intermitente en producción: alrededor del 0.5% de las órdenes de compra llegaban duplicadas a la base de datos. Solo ocurría bajo carga alta y era imposible reproducirlo en local.
>
> **Tarea:** Me asignaron investigar y resolver el bug porque yo era el dueño del servicio de checkout. El impacto era económico directo: órdenes duplicadas significaba procesar pagos dobles.
>
> **Acción:** Primero revisé los logs de Application Insights filtrando por los `OrderId` duplicados. Noté que las dos llamadas llegaban con milisegundos de diferencia desde la misma IP y con el mismo payload. Investigué el código del frontend React y encontré que el botón de "Confirmar compra" no se deshabilitaba inmediatamente al hacer click, lo que permitía doble submit si el usuario era rápido o si había lag de red. En el backend, el endpoint de creación de orden no tenía idempotency key. Implementé dos cosas: en el frontend, deshabilité el botón con `useState` en el primer click. En el backend, añadí una clave de idempotencia usando un hash SHA-256 del `userId + cartId + timestamp-truncado-al-minuto`, y verifiqué contra Redis si ya existía una orden con esa clave en los últimos 2 minutos. Si existía, devolvía la orden original en lugar de crear una nueva.
>
> **Resultado:** Las órdenes duplicadas desaparecieron completamente en producción. También aproveché para escribir un test de integración que simulaba doble submit concurrente, que ahora corre en CI. Aprendí que los bugs de race condition en producción rara vez se reproducen en local y que hay que investigarlos a través de logs y observabilidad, no de intuición.

**¿Qué busca el entrevistador?**
- Proceso sistemático de debugging (no adivinanzas)
- Capacidad de investigar sin reproducir el bug localmente
- Solución robusta, no parche
- Prevención futura (test añadido)

---

#### 2. "¿Cuándo tuviste que aprender una tecnología nueva rápidamente? ¿Cómo lo hiciste?"

**Ejemplo de respuesta STAR:**

> **Situación:** A finales de 2022, el equipo decidió migrar nuestro sistema de mensajería de RabbitMQ a Azure Service Bus. Teníamos 3 semanas hasta el siguiente sprint en el que se usaría en producción. Yo nunca había trabajado con Service Bus.
>
> **Tarea:** Fui el responsable de hacer el spike técnico y definir los patrones de implementación que usaría todo el equipo.
>
> **Acción:** Dediqué los primeros 2 días a la documentación oficial de Microsoft y a los ejemplos de `Azure.Messaging.ServiceBus` SDK. El tercer día creé un proyecto de prueba para entender las diferencias clave con RabbitMQ: sessions, dead-letter queues, y el modelo de lock de mensajes. Identifiqué 3 diferencias críticas que podían causar problemas: el lock timeout de 60 segundos (vs. RabbitMQ que es indefinido), la diferencia en comportamiento de DLQ, y que Service Bus no tiene exchanges, solo queues y topics. Creé un documento de ADR (Architecture Decision Record) con los patrones que adoptaríamos, una capa de abstracción con interfaces para no acoplar el código de negocio al SDK, y un ejemplo funcional para que el equipo lo usara como plantilla.
>
> **Resultado:** El equipo adoptó la abstracción sin problemas. La migración se completó en 2 sprints sin incidentes en producción. También detecté proactivamente un posible problema con el lock timeout en nuestros workers de procesamiento de imágenes (que tardaban más de 60 segundos) y lo resolvimos antes de que fuera un bug en prod. Aprendí que cuando tengo poco tiempo para aprender algo, la clave es identificar qué es *diferente* a lo que ya sé, no aprender todo desde cero.

**¿Qué busca el entrevistador?**
- Proceso de aprendizaje eficiente
- Capacidad de convertir aprendizaje propio en conocimiento del equipo
- Pensamiento proactivo (detectó el problema del lock timeout)
- Documentación y comunicación

---

#### 3. "Describe una situación donde tuviste que tomar una decisión técnica importante con información incompleta."

**Ejemplo de respuesta STAR:**

> **Situación:** Estábamos diseñando la arquitectura de un nuevo módulo de reportes para una aplicación de RRHH. El PM aún no tenía claridad total sobre qué tipos de reportes pediría el cliente final, pero el proyecto ya tenía fecha de entrega. Teníamos que empezar a construir.
>
> **Tarea:** Como tech lead del módulo, yo tenía que decidir si usar un enfoque de reportes predefinidos (más simple, menos flexible) o un query builder dinámico (más complejo, pero adaptable a futuros requisitos desconocidos).
>
> **Acción:** No esperé a que el PM tuviera certeza. En cambio, hice un análisis de riesgo comparando los dos enfoques. El query builder dinámico tenía riesgo de over-engineering si al final los reportes eran simples. Los reportes predefinidos tenían riesgo de tener que reescribir todo si los requisitos variaban mucho. Hablé con el PM y pedí que me diera los 5 reportes que *con certeza* necesitaba el cliente. Diseñé la arquitectura con esos 5 predefinidos, pero usando el patrón Strategy y una abstracción de `IReportDefinition` para que agregar nuevos reportes fuera añadir una clase, no modificar el core. También definí explícitamente en el ADR las asunciones que hice y los puntos de riesgo, para que si los requisitos cambiaban, el equipo supiera dónde impactaría.
>
> **Resultado:** Entregamos en fecha. Dos meses después el cliente pidió 4 reportes adicionales que no estaban en el plan original, y el equipo los implementó en 2 días cada uno gracias a la abstracción. El PM me mencionó específicamente en el retrospectivo por haber "tomado la decisión correcta a pesar de la incertidumbre". Aprendí que ante información incompleta, la clave no es esperar certeza, sino diseñar para el cambio y documentar los supuestos.

**¿Qué busca el entrevistador?**
- Capacidad de actuar bajo incertidumbre sin paralizarse
- Pensamiento arquitectónico (diseñar para el cambio)
- Comunicación con stakeholders no técnicos
- Documentación de decisiones y asunciones

---

#### 4. "Cuéntame de un momento en que refactorizaste código legacy. ¿Cómo lo justificaste y ejecutaste?"

**Ejemplo de respuesta STAR:**

> **Situación:** Heredé el mantenimiento de un módulo de facturación en .NET Framework 4.6 que llevaba 5 años sin tocarse. Era una clase `BillingService` de 3.000 líneas con lógica de negocio, acceso a datos y envío de emails mezclados. Cada vez que tocábamos algo, rompíamos otra cosa. El tiempo de onboarding para nuevos devs en ese módulo era de 2 semanas.
>
> **Tarea:** Propuse y lideré la refactorización del módulo sin parar el desarrollo de features nuevas.
>
> **Acción:** Primero hice un business case para el PM: calculé que el equipo gastaba en promedio 3 horas por bug en ese módulo (vs. 45 minutos en el resto del código) y que habíamos tenido 8 bugs de producción en los últimos 3 meses solo en facturación. Con esos números, convencí al PM de dedicar el 20% de capacidad de dos sprints a la refactorización. Luego establecí la estrategia: no reescribir de cero (muy arriesgado), sino usar el patrón Strangler Fig. Primero escribí tests de caracterización usando la funcionalidad existente como oráculo. Con esos tests como red de seguridad, fui extrayendo responsabilidades: creé `BillingRepository`, `InvoiceEmailService`, `TaxCalculator`, etc. Cada extracción venía con sus propios unit tests. Hice los cambios de forma incremental, desplegando a producción cada semana.
>
> **Resultado:** Después de 6 semanas (4 sprints con 20% de capacidad), el módulo pasó de una clase de 3.000 líneas a 12 clases con responsabilidad única, con 87% de cobertura de tests. El tiempo promedio de resolución de bugs bajó de 3 horas a 50 minutos. No tuvimos ningún bug de regresión durante el proceso. Presenté el resultado en una demo interna y el equipo adoptó la misma estrategia para otros módulos legacy.

**¿Qué busca el entrevistador?**
- Capacidad de justificar deuda técnica en términos de negocio
- Estrategia de refactorización segura (no "big bang rewrite")
- Ejecución incremental con tests como red de seguridad
- Impacto medible

---

#### 5. "¿Cuándo tuviste que decirle a un PM o stakeholder que algo técnicamente no era posible (o no era buena idea)?"

**Ejemplo de respuesta STAR:**

> **Situación:** El PM de producto llegó con una solicitud urgente: quería que el sistema generara reportes en tiempo real de todas las transacciones de los últimos 5 años con filtros dinámicos. El cliente lo había pedido para una demo en 2 semanas. La base de datos principal tenía 200 millones de registros y ningún índice optimizado para ese tipo de queries.
>
> **Tarea:** Tenía que comunicarle al PM que la implementación tal como la pedía no era viable en 2 semanas, y proponer una alternativa realista.
>
> **Acción:** Antes de ir a hablar con el PM, hice un análisis rápido: corrí la query que necesitaríamos en el ambiente de staging y tardó 4 minutos. Eso era inaceptable para una demo en vivo. Calculé que crear los índices necesarios tomaría días en producción sin bloquear la tabla. En la reunión con el PM no dije simplemente "no se puede". Expliqué el problema con datos concretos: "La query que necesitamos tarda 4 minutos ahora mismo. Para la demo eso no funciona." Luego presenté tres alternativas con sus trade-offs: 1) Una base de datos analítica separada (OLAP) con datos precalculados — solución correcta pero 3-4 semanas de trabajo. 2) Reportes pre-generados nocturnos — datos del día anterior, listo en 1 semana. 3) Un subset de datos para la demo (últimos 3 meses, no 5 años) — listo en 3 días, pero limitado. El PM eligió la opción 3 para la demo y la opción 1 como solución permanente.
>
> **Resultado:** La demo fue exitosa con los datos de los últimos 3 meses. El cliente quedó conforme. Luego implementé la base de datos analítica con Azure Synapse, y 6 semanas después el cliente tenía la funcionalidad completa. El PM después me dijo que aprecia cuando llego con opciones en lugar de solo problemas.

**¿Qué busca el entrevistador?**
- Capacidad de dar malas noticias con datos, no con opiniones
- Orientación a soluciones (llegó con alternativas)
- Comunicación efectiva con no-técnicos
- Profesionalismo (no se enfrascó en "no se puede")

---

### 🤝 Trabajo en Equipo y Comunicación

---

#### 1. "Cuéntame de un conflicto técnico con un compañero. ¿Cómo lo resolviste?"

**Ejemplo de respuesta STAR:**

> **Situación:** En un proyecto de microservicios, mi compañero senior y yo teníamos una discrepancia sobre cómo manejar la comunicación entre servicios. Él quería usar REST síncrono para todo. Yo argumentaba que para ciertos flujos (notificaciones, auditoría) era mejor mensajería asíncrona con Service Bus. Las discusiones en code review se estaban poniendo tensas.
>
> **Tarea:** Necesitaba resolver el desacuerdo de forma técnicamente sólida sin dañar la relación de trabajo ni crear un ambiente tóxico.
>
> **Acción:** Pedí una reunión 1:1 con mi compañero, separada del code review. Le dije que quería entender su razonamiento sin la presión de un PR abierto. Él explicó que su preocupación principal era la complejidad operacional: mantener Service Bus agregaba infraestructura y curva de aprendizaje. Entendí que su objeción no era técnicamente incorrecta. Preparé un documento corto comparando los dos enfoques para los casos de uso específicos de nuestro proyecto, con métricas de cuándo la complejidad agregada de mensajería se justifica (principalmente: cuando el productor y consumidor no deben estar acoplados en tiempo). Le propuse hacer un spike de 2 días para implementar el patrón asíncrono solo para el caso de notificaciones, y que el equipo decidiera juntos en base al resultado.
>
> **Resultado:** Hicimos el spike. El equipo vio que para notificaciones y auditoría el enfoque asíncrono era claramente mejor, y que para operaciones de negocio críticas el REST síncrono tenía sentido. Terminamos con una guía de cuándo usar cada uno. Mi compañero y yo llegamos a una mejor alineación técnica y trabajamos bien el resto del proyecto. Lo que más aprendí fue que muchos conflictos técnicos son en realidad sobre miedos o preocupaciones legítimas que no se están comunicando directamente.

**¿Qué busca el entrevistador?**
- Madurez emocional (no peleó en code review, pidió 1:1)
- Escucha activa (entendió la preocupación real del compañero)
- Resolución basada en datos, no en ego
- Capacidad de crear consenso

---

#### 2. "¿Cómo explicarías un concepto técnico complejo a alguien no técnico? Da un ejemplo."

**Ejemplo de respuesta STAR:**

> **Situación:** Nuestra empresa estaba evaluando migrar de una arquitectura monolítica a microservicios. El Director de Operaciones (no técnico) tenía que aprobar el presupuesto, pero no entendía por qué era necesario ni qué ganábamos.
>
> **Tarea:** Tuve que presentarle la propuesta de microservicios de una forma que tuviera sentido para él, sin usar jerga técnica.
>
> **Acción:** En lugar de hablar de "desacoplamiento" o "escalabilidad horizontal", usé una analogía que sabía que le resonaría: comparé el monolito con una tienda departamental donde toda la electricidad corre por un solo fusible. Si algo en el área de electrodomésticos falla, se va la luz de toda la tienda. Los microservicios son como tener un fusible independiente por sección: si falla electrodomésticos, ropa sigue funcionando. También traduje los beneficios técnicos a términos de negocio: "Si el módulo de pagos tiene un bug, hoy cae toda la aplicación. Con microservicios, solo cae pagos; el resto de la app sigue funcionando para los otros 50.000 usuarios que no están comprando en ese momento." Preparé una sola diapositiva con el diagrama de flujo de un incidente en el monolito vs. en microservicios.
>
> **Resultado:** El Director aprobó el presupuesto en esa misma reunión. Después me dijo que era la primera vez que entendía "para qué sirve toda esa arquitectura de software". La migración se aprobó con fondos del siguiente trimestre. Aprendí que explicar tecnología a no-técnicos no es simplificar — es encontrar el framework mental que esa persona ya tiene y conectarlo con el concepto nuevo.

**¿Qué busca el entrevistador?**
- Capacidad de comunicación cross-funcional
- Empatía (entendió el marco mental del Director)
- Uso de analogías efectivas
- Orientación a resultados de negocio

---

#### 3. "Describe una situación donde tu equipo no llegaba a un consenso técnico. ¿Cuál fue tu rol?"

**Ejemplo de respuesta STAR:**

> **Situación:** El equipo llevaba 3 reuniones debatiendo si el nuevo sistema de autenticación debía usar JWT con refresh tokens o sessions con Redis. Había argumentos válidos para ambos y la discusión se estaba ciclando sin avanzar.
>
> **Tarea:** No era el tech lead formal, pero me di cuenta de que el equipo necesitaba un proceso de decisión, no más debate.
>
> **Acción:** En la cuarta reunión, propuse pausar el debate de opiniones y estructurar la decisión. Creé una tabla de evaluación con los criterios que todos consideraban importantes: seguridad, complejidad de implementación, experiencia del equipo, escalabilidad, y requisitos de la app (que era una SPA con React). Pedí a cada persona que puntuara cada opción del 1 al 5 en cada criterio de forma independiente antes de la reunión. Luego compartimos los resultados. La puntuación agregada mostró que JWT ganaba en escalabilidad y experiencia del equipo, pero sessions ganaba en facilidad de revocación de tokens. Eso llevó la conversación a: "¿qué tan importante es la revocación inmediata para nuestro caso de uso?" — una pregunta concreta que el PM pudo responder. La respuesta fue: no mucho, ya que no manejábamos datos especialmente sensibles.
>
> **Resultado:** El equipo eligió JWT en 30 minutos después de semanas de debate. El proceso estructurado eliminó el ruido emocional y focalizó la discusión en los criterios relevantes. El PM agradeció que lo incluyéramos con una pregunta que podía responder. Implementamos JWT y no tuvimos problemas en producción. Aprendí que muchos debates interminables no son por falta de información sino por falta de un proceso de decisión.

**¿Qué busca el entrevistador?**
- Liderazgo sin autoridad formal
- Facilitación de procesos de decisión
- Capacidad de destrabar equipos
- Inclusión de stakeholders no técnicos cuando corresponde

---

#### 4. "¿Cuándo tuviste que dar feedback difícil a un colega sobre su código o trabajo?"

**Ejemplo de respuesta STAR:**

> **Situación:** Un compañero nuevo en el equipo (6 meses de experiencia) estaba enviando PRs con código funcional pero sin tests, con nombres de variables de una letra y sin manejo de errores. Los code reviews se estaban acumulando porque nadie quería tener esa conversación con él.
>
> **Tarea:** Como el miembro más senior del equipo en ese momento, sentí que era mi responsabilidad darle feedback directo antes de que el problema se normalizara.
>
> **Acción:** Pedí una reunión 1:1 con él, no en el contexto de un PR específico. Fui directo pero empático: "Quiero darte feedback sobre algo que veo un patrón y que creo que es importante para tu crecimiento." Le expliqué específicamente qué estaba viendo: código sin tests, naming que dificulta la legibilidad, y ausencia de manejo de errores. Le di ejemplos concretos de sus últimos 3 PRs. No hice juicios sobre él como persona, solo sobre el código. También pregunté si había algo que le estuviera dificultando escribir tests (¿falta de tiempo?, ¿no sabe cómo?). Resultó que nadie le había enseñado a escribir tests unitarios en .NET — venía de un bootcamp donde no cubrían eso. Le propuse hacer pair programming durante una semana para mostrarle cómo escribía tests con xUnit y Moq.
>
> **Resultado:** Hicimos el pair programming. En los siguientes dos meses, sus PRs llegaban con tests consistentemente. Un senior del equipo comentó en el retrospectivo que la calidad del código del equipo había mejorado notablemente. Aprendí que el feedback difícil, dado con respeto y con una propuesta de ayuda concreta, casi siempre es bien recibido. Y que a veces detrás de un "mal hábito" hay una brecha de conocimiento, no falta de profesionalismo.

**¿Qué busca el entrevistador?**
- Capacidad de dar feedback constructivo y directo
- Distinguir entre el problema y la persona
- Disposición a invertir en el crecimiento del equipo
- Escucha activa para entender la causa raíz

---

### 👑 Liderazgo y Ownership

---

#### 1. "Cuéntame de un proyecto donde tomaste la iniciativa sin que te lo pidieran."

**Ejemplo de respuesta STAR:**

> **Situación:** En mi equipo no teníamos ningún proceso de monitoreo de performance en producción. Los problemas los descubríamos cuando los usuarios reportaban lentitud. Esto pasó 3 veces en un trimestre y cada vez pasábamos horas debuggeando sin datos.
>
> **Tarea:** No era mi responsabilidad formal implementar observabilidad, pero decidí tomarlo como iniciativa personal porque el problema me afectaba directamente como desarrollador.
>
> **Acción:** Dediqué dos días de tiempo personal (fuera de sprint) a crear un proof of concept integrando Application Insights con nuestra API .NET usando el SDK de telemetría. Configuré tracking de requests, exceptions, y métricas de performance custom para las operaciones más críticas. Presenté el POC en la siguiente demo técnica del equipo, mostrando cómo en 10 minutos pude identificar que una dependency externa estaba respondiendo en 3 segundos. El equipo y el tech lead lo aprobaron. Coordiné con DevOps para integrarlo en el pipeline de CI/CD y creé un dashboard en Azure Monitor con alertas automáticas.
>
> **Resultado:** El siguiente problema de performance lo detectamos nosotros mismos antes de que los usuarios lo reportaran. El tiempo de diagnóstico bajó de horas a minutos. El tech lead incluyó observabilidad como un requisito de Definition of Done para todas las nuevas features. Aprendí que la iniciativa sin visibilidad no sirve — fue igual de importante presentarlo que implementarlo.

**¿Qué busca el entrevistador?**
- Ownership genuino (más allá del scope formal)
- Capacidad de identificar problemas sistémicos
- Ejecución autónoma
- Capacidad de influir sin autoridad formal

---

#### 2. "¿Cuándo cometiste un error que tuvo impacto en producción? ¿Qué hiciste?"

**Ejemplo de respuesta STAR:**

> **Situación:** Desplegué un cambio en el servicio de envío de emails de una plataforma de e-learning. Era un cambio "menor": actualizar la plantilla HTML de los emails de confirmación de curso. Era viernes a las 5pm.
>
> **Tarea:** Era mi responsabilidad haber revisado el cambio correctamente. El error fue mío.
>
> **Acción:** Veinte minutos después del deploy, empezaron a llegar alertas: los emails de confirmación no se estaban enviando. El error en los logs era un `NullReferenceException` en el renderizado de la plantilla — había un campo nuevo en la plantilla que no existía en el modelo de datos. Primero, hice rollback inmediato del deploy. No esperé aprobación — el sistema de rollback de nuestro CI/CD lo permite sin aprobación extra para emergencias. El rollback tardó 3 minutos. Luego revisé cuántos usuarios estaban afectados: 340 emails no enviados en esa ventana de 20 minutos. Escribí un script de PowerShell para reenviar esos emails desde la base de datos de auditoria de emails. Notifiqué al equipo y al PM de forma proactiva explicando lo que pasó, qué hice y cuántos usuarios se vieron afectados. El lunes, escribí un post-mortem honesto, incluyendo que no había hecho prueba en staging con datos reales, y propuse agregar un test de smoke en el pipeline que verificara que el modelo de datos era compatible con la plantilla antes de desplegar.
>
> **Resultado:** Los 340 usuarios recibieron sus emails con 30 minutos de retraso. Solo 12 contactaron soporte. El smoke test que propuse fue implementado y desde entonces no hubo más incidentes de ese tipo. El PM mencionó en el retrospectivo que apreció cómo manejé la situación. Aprendí que cómo manejas el error importa más que el error en sí.

**¿Qué busca el entrevistador?**
- Honestidad y responsabilidad (no buscar culpables)
- Reacción rápida y correcta bajo presión
- Comunicación proactiva
- Aprendizaje y mejora del proceso (no solo "lo arreglé")

> ⚠️ **Nota:** Esta es la pregunta más importante del banco. Todos los entrevistadores senior la hacen. Si no tienes un error en producción, usa un error de estimación, un bug en staging, o una mala decisión técnica que tuvo consecuencias.

---

#### 3. "Describe una situación donde tuviste que priorizar entre múltiples tareas urgentes."

**Ejemplo de respuesta STAR:**

> **Situación:** Un lunes por la mañana llegué con tres cosas urgentes simultáneas: un bug en producción que afectaba el módulo de pagos (con impacto en revenue), una solicitud del PM de una feature que prometió al cliente para "hoy", y un compañero bloqueado esperando mi revisión de su PR para poder avanzar.
>
> **Tarea:** Tenía que decidir el orden de atención sin perder ninguna de las tres bolas y sin crear conflictos con el PM o mi compañero.
>
> **Acción:** Lo primero fue una evaluación rápida de impacto y urgencia real. El bug de pagos tenía impacto directo en revenue y clientes en este momento: prioridad 1, empezar ya. Avisé al PM en un mensaje de 2 líneas: "Hay un bug de pagos en prod, lo estoy atacando ahora, en cuanto lo resuelva o tenga un ETA te contacto." Para mi compañero, revisé en 5 minutos si su PR tenía algún blocker crítico (no lo tenía), le mandé un mensaje explicando la situación y que lo revisaría en el transcurso de la mañana. Resolví el bug de pagos en 2 horas (era un problema de timeout en la integración con el proveedor). Luego revisé el PR de mi compañero (45 minutos). Luego hablé con el PM para revisar el alcance real de la feature "urgente" — resultó que el cliente necesitaba una parte específica, no todo el feature, y con 3 horas de trabajo podía entregar esa parte.
>
> **Resultado:** El bug de pagos resuelto sin escalada a liderazgo. Mi compañero desbloqueado antes del mediodía. El cliente recibió la parte crítica de la feature ese día. El PM quedó satisfecho. Aprendí que "urgente" es una etiqueta que la gente pone a todo, y que la labor de un developer senior es hacer la distinción entre urgente-real (impacto ahora) y urgente-percibido (importante, pero puede esperar horas).

**¿Qué busca el entrevistador?**
- Framework de priorización claro
- Comunicación proactiva cuando cambias el orden de prioridades
- Capacidad de hacer distinción entre urgente e importante
- Gestión de expectativas con múltiples stakeholders

---

#### 4. "¿Cómo has manejado la deuda técnica en un proyecto? ¿Cómo convenciste al equipo/negocio?"

**Ejemplo de respuesta STAR:**

> **Situación:** En una startup donde trabajé, el equipo llevaba 2 años acumulando deuda técnica bajo presión de features. El resultado: nuestro tiempo de build era de 18 minutos, los tests tardaban 45 minutos, y cualquier cambio en el modelo de datos requería tocar 12 archivos distintos. La velocidad del equipo había caído un 40% comparando con el año anterior.
>
> **Tarea:** Como senior del equipo propuse estructurar una estrategia para atacar la deuda técnica de forma sostenible.
>
> **Acción:** Primero, hice visible lo invisible: creé un documento que mapeaba los 10 problemas de deuda técnica más críticos con su impacto medible en tiempo de desarrollo. Por ejemplo: "Los tests tardan 45 minutos → cada PR tiene un overhead de 45 min de espera, asumiendo 5 PRs/día del equipo = 225 min/día de tiempo perdido = casi 4 horas de productividad al día." Con esos números, propuse al CTO dedicar el 20% de la capacidad de cada sprint a deuda técnica (la regla del 20%). No prometí resolverlo todo — prometí que en 3 meses el tiempo de build bajaría a menos de 10 minutos y los tests a menos de 15 minutos. Creé un backlog de deuda técnica priorizado por ROI (impacto/esfuerzo) y lo trabajamos de forma consistente.
>
> **Resultado:** En 3 meses: build bajó de 18 a 7 minutos (parallelizando y usando incremental builds). Tests bajaron de 45 a 12 minutos (eliminando tests de integración innecesarios y usando test doubles). La velocidad del equipo medida en puntos por sprint aumentó un 25% en ese trimestre. El CTO lo presentó como caso de estudio interno. Aprendí que la deuda técnica necesita hacerse visible en términos de negocio para conseguir presupuesto — los ingenieros ya saben que existe, hay que convencer a quien aprueba el tiempo.

**¿Qué busca el entrevistador?**
- Capacidad de hacer visible y cuantificar la deuda técnica
- Estrategia sostenible (no "paro todo y refactorizo")
- Comunicación de impacto en términos de negocio
- Ejecución con resultados medibles

---

### 🔄 Adaptación y Aprendizaje

---

#### 1. "Cuéntame de una vez que cambiaron los requisitos a mitad de un proyecto. ¿Cómo reaccionaste?"

**Ejemplo de respuesta STAR:**

> **Situación:** Llevábamos 3 semanas de un sprint de 6 semanas construyendo un dashboard de analytics con React. Habíamos diseñado toda la arquitectura de componentes en base a que los datos vendrían de una API REST interna. A mitad del sprint, el PM informó que el cliente había decidido que los datos vendrían de un proveedor externo con una API GraphQL completamente diferente.
>
> **Tarea:** Tenía que evaluar el impacto del cambio, comunicarlo honestamente al PM y al equipo, y encontrar una forma de avanzar sin tirar el trabajo hecho.
>
> **Acción:** Lo primero fue no reaccionar emocionalmente en la reunión. Le pedí al PM 24 horas para evaluar el impacto real antes de comprometer nada. Hice el análisis: la capa de UI de React estaba bien, los componentes no tenían conocimiento de la fuente de datos. El impacto real estaba en la capa de servicios y en los types de TypeScript. Calculé que recuperar eso era 3-4 días de trabajo, no 3 semanas. Presenté el análisis al día siguiente: "El impacto es manejable. La UI no cambia. La capa de datos sí. Necesito 4 días para adaptar los servicios y actualizar los contratos de tipos. El timeline final se extiende 4 días." También aproveché para proponer que en adelante usaríamos una capa de abstracción (adapters) entre la fuente de datos y los componentes React, para que este tipo de cambio en el futuro costara menos.
>
> **Resultado:** El dashboard se entregó con 4 días de retraso respecto al plan original, lo cual el cliente aceptó. Implementamos el patrón adapter, y un mes después el cliente volvió a cambiar una de las fuentes de datos; esa vez el cambio tomó medio día. Aprendí que los cambios de requisitos son inevitables y que la reacción correcta es evaluar el impacto real antes de asumirlo como una catástrofe.

**¿Qué busca el entrevistador?**
- Resiliencia ante el cambio (no "me frustré")
- Análisis racional del impacto antes de comunicar
- Propuesta proactiva para mejorar el proceso
- Adaptabilidad arquitectónica

---

#### 2. "¿Cuál es el mayor fracaso técnico que has tenido? ¿Qué aprendiste?"

**Ejemplo de respuesta STAR:**

> **Situación:** Hace dos años, lideré la migración de la base de datos principal de SQL Server a PostgreSQL en un sistema de gestión de inventario. Subestimé la complejidad y el proyecto terminó durando el doble de lo estimado, y tuvimos un incidente crítico en producción durante la migración.
>
> **Tarea:** Yo propuse la migración, convencí al equipo y al management, e hice la estimación. La responsabilidad era completamente mía.
>
> **Acción — y dónde salió mal:** Hice una estimación optimista basada en la migración del schema y los datos, pero no consideré: las diferencias de comportamiento entre T-SQL y PL/pgSQL (varias stored procedures fallaron silenciosamente), las diferencias de casing en nombres de tablas (PostgreSQL es case-sensitive por defecto), ni el tiempo de entrenamiento del equipo en la nueva base de datos. Durante la migración, un script de transformación de datos corrió con un bug que corrompió 15.000 registros de inventario. Detectamos el problema 4 horas después.
>
> **Lo que hice:** Activé el plan de rollback (que sí había preparado), restauramos desde el backup de antes de la migración, y pasamos el fin de semana validando la integridad de los datos. Lunes presenté un post-mortem al equipo y management siendo completamente honesto sobre los errores de planificación.
>
> **Resultado:** La migración finalmente se completó 3 meses después con una estrategia completamente diferente: migración incremental tabla por tabla con doble escritura durante la transición. Sin incidentes. Lo que aprendí: las migraciones de base de datos son uno de los proyectos donde más se paga el over-confidence. Desde entonces soy mucho más conservador en mis estimaciones para proyectos de alta complejidad y siempre incluyo tiempo de validación y planes de rollback detallados en la estimación.

**¿Qué busca el entrevistador?**
- Honestidad y accountability genuinos (no buscar culpables externos)
- Capacidad de aprendizaje real (no "aprendí a ser más cuidadoso")
- Madurez profesional
- La historia no tiene que ser reciente, pero el aprendizaje sí tiene que ser aplicado

> 💡 **Tip:** Esta es la pregunta donde más candidatos se auto-sabotean dando respuestas falsas ("Mi mayor fracaso es que soy demasiado perfeccionista"). Los entrevistadores lo detectan de inmediato. Da una historia real.

---

#### 3. "¿Cuándo recibiste feedback negativo sobre tu trabajo? ¿Cómo lo procesaste?"

**Ejemplo de respuesta STAR:**

> **Situación:** En mi primera revisión de performance como semi-senior, mi tech lead me dio feedback que no esperaba: mencionó que mis estimaciones eran sistemáticamente optimistas, que esto había generado problemas de planning en los últimos 3 sprints, y que necesitaba mejorar en comunicación cuando iba a perder un deadline (en lugar de avisar el último día).
>
> **Tarea:** Tenía que procesar feedback que dolía (no me consideraba una persona con ese problema) y decidir qué hacer con él.
>
> **Acción:** Mi primera reacción interna fue defensiva, pero no lo expresé en el momento. Le agradecí el feedback y pedí ejemplos concretos de los 3 sprints. Con los ejemplos revisé mis notas de estimación y comprobé que tenía razón: en los 3 casos había estimado para el escenario optimista sin buffer. Fui a hablar con mi tech lead una semana después con un plan concreto: empezaría a usar la técnica de estimación por tres puntos (optimista / realista / pesimista) y comunicaría un rango en lugar de un número fijo. También le propuse que si veía que iba a perder un deadline, lo comunicaría con 2 días de anticipación como mínimo, no el día anterior. Le pedí que me diera feedback en los siguientes 2 sprints sobre si estaba mejorando.
>
> **Resultado:** En los siguientes 3 meses mis estimaciones fueron mucho más precisas (no perfectas, pero sin los outliers del pasado). Mi tech lead mencionó específicamente en la siguiente revisión que había notado una mejora significativa. Aprendí que el feedback incómodo es el más valioso si lo recibes con la actitud correcta, y que la clave no es solo aceptarlo verbalmente sino volver con un plan de acción concreto.

**¿Qué busca el entrevistador?**
- Growth mindset genuino (no "siempre acepto el feedback muy bien")
- Honestidad sobre la reacción inicial
- Plan de acción concreto (no solo "lo tomé en cuenta")
- Seguimiento del cambio

---

## 5. Preguntas para hacerle al entrevistador

Al final de **toda** entrevista, siempre preguntar algo. El silencio o el "no, ninguna" es una señal negativa. Demuestra curiosidad, preparación e interés real.

> 💡 **Regla:** Prepara al menos 3-4 preguntas antes de cada entrevista. Algunas se responderán durante la entrevista; tendrás de respaldo.

---

### Sobre el equipo y cultura técnica

1. "¿Cómo es el proceso de onboarding para alguien nuevo en el equipo?"
2. "¿Cómo manejan los desacuerdos técnicos cuando no hay consenso?"
3. "¿Qué hace que alguien tenga éxito en este equipo en los primeros 6 meses?"
4. "¿Hay algún valor o práctica de ingeniería que el equipo protege especialmente?"

---

### Sobre el stack y decisiones técnicas

5. "¿Cuáles son las partes del stack de las que el equipo está más orgulloso? ¿Y cuáles son las que más quisieran mejorar?"
6. "¿Cómo se toman las decisiones de arquitectura? ¿Hay ADRs, RFC, o es más informal?"
7. "¿Qué es lo más técnicamente desafiante del sistema actual?"

---

### Sobre el proceso de desarrollo

8. "¿Cómo es el proceso de despliegue a producción? ¿Con qué frecuencia despliegan?"
9. "¿Qué tan maduro es el sistema de observabilidad y monitoreo? ¿Cómo se enteran de que algo falló en producción?"
10. "¿Cómo manejan la deuda técnica? ¿Tienen tiempo dedicado en los sprints?"

---

### Sobre crecimiento y oportunidades

11. "¿Qué oportunidades hay para crecer hacia roles de mayor responsabilidad técnica?"
12. "¿Hay presupuesto para conferencias, cursos o certificaciones?"
13. "¿Tienen un proceso formal de mentoring o career development?"

---

### Sobre el proyecto/producto actual

14. "¿Cuáles son los mayores desafíos técnicos que el equipo está enfrentando ahora mismo?"
15. "¿Cuál es el roadmap técnico para los próximos 6-12 meses?"

---

## 6. 🚩 Señales de alerta (Red Flags)

Durante la entrevista, el candidato también está evaluando a la empresa. Estas son señales de que puede no ser un buen lugar para trabajar:

### Red flags en las respuestas del entrevistador

| Lo que dicen | Por qué es preocupante |
|---|---|
| "No tenemos tiempo para tests" | La deuda técnica crecerá sin control |
| "El deploy lo hace solo una persona" | Bus factor 1, ambiente frágil |
| "El código es legacy pero lo vamos a reescribir pronto" | *Siempre* dicen esto. Rara vez pasa |
| "Aquí todos hacemos de todo" | Sin especialización ni crecimiento claro |
| "Somos como una familia" | Expectativa de trabajo emocional extra y límites borrosos |
| "Tienes que tener pasión por lo que haces" | Justificativo para pagar menos o pedir overtime |
| "El ambiente es muy intenso pero aprendes mucho" | Burn out garantizado |
| "Movemos rápido y rompemos cosas" | Sin procesos de calidad |

### Red flags en el comportamiento del entrevistador

- No pueden explicar qué hace el sistema con claridad
- No pueden responder preguntas sobre el proceso de desarrollo
- Hacen preguntas ilegales (edad, estado civil, planes de tener hijos)
- Responden preguntas sobre la cultura con generalidades vacías ("aquí todos son muy buenos")
- Se molestan cuando preguntas sobre deuda técnica o procesos
- No hay nadie del equipo técnico en las entrevistas (solo RRHH)
- El proceso de entrevistas tiene más de 6 rondas

### ¿Cómo reaccionar ante un red flag?

No te levantes y te vayas (a menos que sea algo muy grave). Toma nota y considera:
1. ¿Puedo verificar esto con alguien de la empresa en LinkedIn?
2. ¿Puedo preguntar más para entender el contexto real?
3. ¿Este red flag es bloqueante o es algo con lo que puedo vivir?

---

## 7. El día de la entrevista

### ✅ Checklist 30 minutos antes

- [ ] Releer el banco de situaciones STAR que preparaste
- [ ] Releer la descripción del puesto y tener 2-3 puntos de conexión claros con tu experiencia
- [ ] Tener listas tus preguntas para el entrevistador
- [ ] Agua cerca (las entrevistas se secan la garganta)
- [ ] Silencio en el entorno (notificaciones del celular apagadas)
- [ ] Si es virtual: cámara funcionando, auriculares probados, fondo decente

---

### Si no sabes la respuesta a una pregunta técnica

1. **No finjas que sabes.** Los entrevistadores experimentados lo detectan.
2. Di: *"No tengo experiencia directa con eso, pero lo abordaría de esta manera..."* y razona en voz alta.
3. O: *"No recuerdo el detalle exacto, pero el concepto que aplica aquí es..."*
4. O simplemente: *"Eso no lo sé. ¿Me puedes explicar cómo funciona?"* — demuestra curiosidad y honestidad.

Lo que nunca hay que hacer: inventar una respuesta técnica incorrecta con seguridad. Es peor que no saber.

---

### Cómo manejar el silencio

El silencio antes de responder es **normal y deseable**. No es incómodo; es señal de que estás pensando.

**Lo que puedes decir para ganar tiempo:**
- *"Déjame pensar un momento..."*
- *"Buena pregunta, quiero asegurarme de darte un buen ejemplo..."*
- *"¿Te importa si tomo 30 segundos para recordar un buen caso de uso?"*

Los entrevistadores buenos prefieren que pienses 30 segundos y respondas bien a que respondas de inmediato con algo genérico.

---

### Cómo cerrar la entrevista

Al final, no te levantes sin hacer esto:

1. **Pregunta algo inteligente** (usa tu lista preparada)
2. **Expresa interés genuino** (si lo tienes): *"Esta conversación me generó mucho interés en el rol, especialmente lo que mencionaste sobre [algo específico que dijo]."*
3. **Pregunta por los siguientes pasos**: *"¿Cuáles son los próximos pasos del proceso? ¿Cuándo podría esperar noticias?"*
4. **Agradece el tiempo**: breve y sincero, no exagerado.

---

## 8. Ejemplos STAR completos por nivel

Estos ejemplos muestran cómo varía la profundidad esperada según el nivel.

---

### 🟢 Junior — "Cuéntame de un error que cometiste y qué aprendiste"

**Situación:** En mi primer proyecto real, estaba trabajando en una app de gestión de tareas con ASP.NET Core. Era mi primer mes en la empresa.

**Tarea:** Tenía que hacer un endpoint de búsqueda de tareas por nombre. Era la primera feature que hacía yo solo.

**Acción:** Implementé el filtro con `Where(t => t.Name.Contains(searchTerm))`. Funcionó en desarrollo, hice el pull request, lo revisaron rápido y se mergeó. A los dos días, el equipo notó que la búsqueda hacía una query sin índice y lentísima en producción con los datos reales.

Lo que hice cuando lo detectamos: revisé el query generado por EF Core con el log de SQL, aprendí qué era un índice de base de datos, agregué `HasIndex(t => t.Name)` en la configuración de EF, y ayudé a deployar el hotfix.

**Resultado:** El endpoint bajó de ~1200ms a ~45ms. Lo más importante fue que aprendí a revisar el SQL generado en código review y a pensar en performance desde el diseño, no solo cuando hay un problema. Desde entonces, en cada PR que toco base de datos reviso el query generado.

---

### 🟡 Semi-Senior — "Describe una situación donde tomaste la iniciativa sin que te lo pidieran"

**Situación:** Estaba en un equipo de 5 personas construyendo una API REST en .NET 6. Nuestros deploys a staging tardaban 25-30 minutos manualmente porque no teníamos CI/CD automatizado — cada deploy era un proceso manual con scripts.

**Tarea:** Nadie me asignó esto. Era mi responsabilidad técnica principal entregar features de la API, pero vi el problema y decidí proponerlo.

**Acción:** Primero hice un análisis de cuánto tiempo perdíamos: ~4 deploys por semana × 30 min = 2 horas de trabajo manual por semana. Propuse al tech lead implementar GitHub Actions. Me asignaron un sprint para hacerlo sin afectar la entrega normal.

Implementé un workflow con 3 stages: build + tests (xUnit), analysis (SonarQube), y deploy a staging con `dotnet publish` y Azure App Service. Documenté el proceso y capacité al equipo en 30 minutos.

**Resultado:** Los deploys bajaron de 30 minutos manuales a 6 minutos automatizados. Eliminamos 2 horas de trabajo manual por semana. Más importante: detectamos 3 bugs en tests antes de llegar a staging en las primeras dos semanas. El tech lead lo presentó al área como mejora de proceso.

---

### 🔴 Senior — "Cuéntame de una decisión técnica difícil que tomaste con información incompleta"

**Situación:** Era tech lead en una startup de logística. Teníamos un monolito .NET con 300K requests/día, y empezamos a ver degradación de performance en picos (p95 de 800ms, target era 200ms). El CTO quería migrar a microservicios porque "escala mejor". El equipo eran 8 personas.

**Tarea:** Mi responsabilidad era proponer y defender la decisión de arquitectura correcta con un deadline de 2 semanas para presentar al board, sin datos completos de cuál era el bottleneck real.

**Acción:** Lo primero que hice fue rechazar la hipótesis de microservicios sin evidencia. Implementé Application Insights y distributed tracing en 3 días para tener datos reales. Encontré que el 80% de la latencia venía de 3 queries sin índices óptimos y un proceso batch que corría en el mismo thread pool que las requests.

Con datos en mano, propuse un plan en 3 fases: (1) optimizar las queries y mover el batch a un hosted service separado — estimé 60% de mejora en 2 semanas, (2) si no era suficiente, extraer solo el módulo de tracking (el de más carga) como servicio separado en 2 meses, (3) microservicios completos solo si escalábamos a 10x usuarios, con un equipo mayor.

Tuve que defender esto ante el CTO que quería ir directo a microservicios. Usé el análisis de datos y un RICE scoring comparando las opciones, mostrando el riesgo operacional con 8 personas.

**Resultado:** Implementamos fase 1 en 10 días. El p95 bajó a 95ms — mejor que el target. No fue necesario ir a microservicios. Ahorramos ~3 meses de rewrite y mantuvimos la velocidad de entrega de features. Lo que aprendí: las decisiones de arquitectura deben basarse en datos, no en tendencias. Y que saber decir "no todavía" es parte del liderazgo técnico.

---

> 💡 **Recuerda:** Una entrevista es una conversación entre dos partes que están evaluando si hay un buen match. No es un examen donde la empresa tiene todo el poder. Tú también estás decidiendo si quieres trabajar ahí.
