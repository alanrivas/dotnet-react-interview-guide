---
id: cultura-empresa
title: 🏢 Preguntas de Cultura y Dinámicas de Equipo
sidebar_position: 2
---

# 🏢 Preguntas de Cultura y Dinámicas de Equipo

Las preguntas de cultura no evalúan conocimiento técnico, sino cómo piensas, cómo reaccionas bajo presión y cómo te relacionas con un equipo. A partir de semi-senior, es común que una ronda completa sea solo de este tipo.

:::tip Cómo usar esta guía
Para cada pregunta: entiende **qué evalúan**, prepara una historia real siguiendo el [método STAR](./comportamiento-star), y practica diciéndola en voz alta. Suenar natural es más importante que ser perfecto.
:::

---

## 🟢 Nivel Junior

En entrevistas junior, las preguntas de cultura son pocas y buscan evaluar tu **actitud frente al aprendizaje** y tu capacidad para trabajar con otros.

---

### "¿Qué harías si no sabes cómo resolver algo que te asignaron?"

**Qué evalúan:** Tu capacidad de aprender por tu cuenta sin bloquear al equipo, y si sabes cuándo pedir ayuda.

**Lo que quieren escuchar:**
- Que investigas antes de preguntar (documentación, Stack Overflow, código existente)
- Que sabes cuándo escalar (si llevas X tiempo bloqueado, preguntas)
- Que no finges saber algo que no sabes

**Estructura sugerida:**
> "Primero intentaría resolverlo por mi cuenta: reviso la documentación, busco código similar en el proyecto y busco en Stack Overflow. Si después de [30-60 min] sigo bloqueado, pido ayuda a un compañero o al tech lead — prefiero perder 5 minutos de su tiempo que perder horas del equipo."

---

### "Cuéntame de un error que cometiste. ¿Qué hiciste al respecto?"

**Qué evalúan:** Tu honestidad, responsabilidad y capacidad de aprender de los errores. Un candidato que dice "nunca cometí errores graves" genera desconfianza.

**Lo que quieren escuchar:**
- Que reconoces el error sin excusas
- Que tomaste acción para corregirlo
- Que aprendiste algo concreto de la situación

**Estructura sugerida (STAR):**
> **S:** "En mi primer proyecto, modifiqué una query directamente en producción para corregir datos, creyendo que era rápido y seguro."
> **T:** "Al hacerlo, afecté registros relacionados que no había considerado."
> **A:** "Revertí el cambio, informé al equipo inmediatamente y preparé el fix correctamente en staging con revisión."
> **R:** "Desde entonces nunca ejecuto nada en producción sin revisión y sin un rollback plan. También propuse que el equipo documentara un checklist para cambios de BD."

---

### "¿Cómo manejas el feedback negativo sobre tu código?"

**Qué evalúan:** Tu ego técnico. Los desarrolladores con ego frágil son difíciles de onboardear y de trabajar en equipo.

**Lo que quieren escuchar:**
- Que ves el feedback como una oportunidad de aprendizaje, no como un ataque
- Que preguntas cuando no entiendes la razón del feedback
- Que no lo tomas de forma personal

**Estructura sugerida:**
> "Lo primero es agradecerlo — si alguien se tomó el tiempo de revisar mi código, me está ayudando. Si el feedback tiene sentido, lo implemento directamente. Si no lo entiendo del todo, pregunto: '¿Me explicas por qué esta alternativa es mejor?' Así aprendo el razonamiento, no solo la solución."

---

### "¿Por qué quieres trabajar con .NET y React específicamente?"

**Qué evalúan:** Tu motivación real y si te ves creciendo con el stack. No esperan una respuesta técnica perfecta, sino genuina.

**Lo que quieren escuchar:**
- Una razón auténtica (un proyecto personal, una experiencia, algo concreto)
- Que conoces mínimamente el ecosistema

**Estructura sugerida:**
> "Empecé con .NET porque [razón concreta: bootcamp, proyecto, trabajo previo]. Me sorprendió la madurez del ecosystem y lo bien integrado que está todo. Con React llegué después, pero la combinación de lógica de servidor robusta en .NET con una UI reactiva en React me pareció muy poderosa para aplicaciones empresariales."

---

## 🟡 Nivel Semi-Senior

A este nivel, las preguntas evalúan tu **ownership**, cómo manejas tensiones técnicas y tu impacto en el equipo.

---

### "Cuéntame de un momento en que estuviste en desacuerdo con una decisión técnica de tu equipo o tu tech lead."

**Qué evalúan:** Si puedes defender tu punto de vista de forma constructiva, y si sabes cuándo ceder y cuándo insistir. Un semi-senior que nunca discrepa o que siempre cede es igual de problemático que uno que nunca escucha.

**Lo que quieren escuchar:**
- Que expusiste tu punto con argumentos técnicos, no con opiniones
- Que escuchaste la otra parte con genuino interés
- Que la decisión final fue consensuada o aceptaste el resultado y lo ejecutaste bien

**Estructura sugerida (STAR):**
> **S:** "Estábamos evaluando si usar Redis para cachear respuestas de una API externa con alta latencia."
> **T:** "Yo proponía Redis; el tech lead prefería caché en memoria por simplicidad. Teníamos que decidir en un sprint."
> **A:** "Preparé una comparativa con datos: latencia del servicio externo, volumen de requests, costo de Redis vs. riesgo de caché inconsistente en múltiples instancias. Presenté ambas opciones con sus trade-offs sin presentarlo como 'mi idea vs la suya'."
> **R:** "Decidimos empezar con caché en memoria y documentar el plan de migración a Redis si superábamos X instancias. Fue la decisión correcta para ese momento. Aprendí que a veces la solución simple es la correcta y que los datos superan las opiniones."

---

### "¿Cómo manejas una situación donde el deadline es imposible de cumplir con los requisitos actuales?"

**Qué evalúan:** Tu capacidad de negociación técnica, comunicación proactiva y priorización. No buscan que "te quedes hasta las 3am" — buscan que gestiones expectativas.

**Lo que quieren escuchar:**
- Que identificas el problema temprano, no el día antes del deadline
- Que propones opciones (reducir scope, priorizar features, negociar fecha)
- Que comunicas el riesgo con datos, no con excusas

**Estructura sugerida (STAR):**
> **S:** "A mitad de sprint detecté que una integración con un proveedor externo era más compleja de lo estimado — el deadline era en 5 días y necesitábamos 10."
> **T:** "Tenía que comunicar el riesgo al PM sin simplemente decir 'no va a llegar'."
> **A:** "Preparé tres opciones: (1) lanzar con funcionalidad reducida que cubría el 80% del caso de uso, (2) pedir 5 días más de plazo, (3) simplificar la integración con un fallback manual temporal. Presenté costos y beneficios de cada opción."
> **R:** "Elegimos la opción 1. El lanzamiento fue exitoso y completamos el 20% restante en el siguiente sprint. El PM valoró la transparencia y la propuesta de opciones más que si simplemente hubiera dicho 'no llego'."

---

### "Describe una situación donde tuviste que lidiar con deuda técnica mientras el equipo también tenía presión de features."

**Qué evalúan:** Tu capacidad de balancear velocidad de corto plazo vs. sostenibilidad. Un semi-senior debería poder articular este trade-off con claridad.

**Lo que quieren escuchar:**
- Que entiendes que la deuda técnica no es inherentemente mala — es una decisión consciente
- Que sabes cómo visibilizarla y negociarla con el negocio
- Que tienes criterio para priorizar qué pagar primero

**Estructura sugerida:**
> "Identificamos que nuestro módulo de autenticación tenía código de 2019 sin tests y con dependencias obsoletas — era riesgoso pero 'funcionaba'. Convencí al equipo de dedicar 20% del tiempo de cada sprint a modernizarlo (la regla del boy scout: dejar el código mejor de cómo lo encontraste). En 3 sprints lo teníamos cubierto con tests e integrado con el nuevo sistema de DI. No bloqueamos features, pero tampoco ignoramos el riesgo."

---

### "¿Cómo explicas una decisión técnica compleja a alguien no técnico (PM, stakeholder, cliente)?"

**Qué evalúan:** Tu capacidad de comunicación cross-funcional, clave para roles semi-senior y senior.

**Lo que quieren escuchar:**
- Que adaptas el lenguaje a la audiencia (sin jerga)
- Que usas analogías o impacto de negocio en vez de detalles de implementación
- Que validas que el otro entendió

**Estructura sugerida:**
> "Cuando tengo que explicar algo técnico a alguien no técnico, primero pregunto qué saben del tema para no subestimarlos. Luego uso el impacto en negocio como puerta de entrada: en vez de 'vamos a refactorizar el módulo de autenticación para mejorar la cobertura de tests', digo 'vamos a reducir el riesgo de que una actualización de seguridad rompa el login de los usuarios'. El 'qué' antes del 'cómo'."

---

## 🔴 Nivel Senior

Las preguntas de cultura para seniors evalúan **liderazgo técnico**, gestión de conflictos de mayor impacto y toma de decisiones con consecuencias organizacionales.

---

### "Cuéntame de una decisión técnica que tomaste y resultó equivocada. ¿Cómo lo manejaste?"

**Qué evalúan:** Tu capacidad de asumir responsabilidad de decisiones de mayor alcance, tu humildad técnica y cómo aprendes de errores que afectaron a otros.

**Lo que quieren escuchar:**
- Una decisión con real impacto (no trivial)
- Que asumiste la responsabilidad sin buscar culpables
- Que comunicaste el problema con transparencia
- Que implementaste un proceso para no repetirlo

**Estructura sugerida (STAR):**
> **S:** "Decidí adoptar microservicios para un sistema de mediano tamaño con un equipo de 4 personas."
> **T:** "La complejidad operativa creció rápidamente: múltiples repositorios, deployments independientes, debugging distribuido — todo sin la infraestructura adecuada."
> **A:** "Reconocí el error a los 3 meses. Convoqué una retro específica del tema, presenté los números (tiempo de onboarding +40%, incidentes por semana x2) y propuse consolidar en un monolito modular como paso intermedio."
> **R:** "La migración tardó un sprint. El equipo recuperó velocidad. Documenté un ADR explicando la decisión y el aprendizaje. Ahora defiendo activamente que microservicios es una solución para problemas de escala organizacional, no técnica."

---

### "¿Cómo manejas la situación en que un desarrollador de tu equipo tiene rendimiento consistentemente bajo?"

**Qué evalúan:** Tu capacidad de liderazgo técnico, empatía y gestión de personas difíciles sin evadir el problema.

**Lo que quieren escuchar:**
- Que buscas entender la causa antes de actuar (¿es falta de habilidad, motivación, contexto personal?)
- Que das feedback claro y con tiempo suficiente para mejorar
- Que escalar a management es el último recurso, no el primero

**Estructura sugerida:**
> "Primero intento entender la causa: ¿es un tema de habilidad técnica, de motivación, de algo personal? Tengo una 1:1 privada, comparto el feedback específico (no 'tu código es malo', sino 'en las últimas 3 semanas las estimaciones han estado muy fuera — quiero entender qué está pasando'). Acuerdo un plan de mejora con métricas claras y check-ins frecuentes. Si después de 4-6 semanas no hay mejora, involucro a management con toda la documentación del caso. Lo que no hago es ignorarlo — proteger al equipo también es liderazgo."

---

### "Describe cómo abordas la adopción de una nueva tecnología en tu equipo."

**Qué evalúan:** Tu criterio para no caer en hype, tu capacidad de gestionar cambio y cómo balanceas innovación con estabilidad.

**Lo que quieren escuchar:**
- Que evalúas con criterios objetivos (problema que resuelve, curva de aprendizaje, soporte, costos)
- Que involucras al equipo en la decisión
- Que tienes un proceso gradual (spike, PoC, piloto, adopción)

**Estructura sugerida:**
> "Sigo un proceso de 4 pasos: (1) identifico qué problema concreto resuelve la tecnología y si el problema existe realmente en nuestro equipo, (2) hago un spike técnico — un PoC de 2-3 días para evaluar la curva de aprendizaje real, (3) presento al equipo con una comparativa honesta incluyendo los contras, y (4) si hay consenso, pilotamos en un módulo de baja criticidad antes de adoptar globalmente. Lo que evito es adoptar tecnología por curiosidad personal o por FOMO de conferencias."

---

### "¿Cómo manejas un conflicto entre dos desarrolladores senior de tu equipo que no pueden llegar a un acuerdo técnico?"

**Qué evalúan:** Tu capacidad de mediar, facilitar decisiones y mantener el equipo cohesionado sin imponer tu autoridad.

**Lo que quieren escuchar:**
- Que estructuras el desacuerdo (¿es un problema de datos, de valores, de preferencias?)
- Que usas procesos objetivos (RFC, ADR, spike técnico) en vez de intuición
- Que mantienes el foco en el problema, no en las personas

**Estructura sugerida:**
> "Primero clarifiqué si era un desacuerdo técnico real o un tema de preferencias. Si es técnico, propongo un spike de 1-2 días donde cada uno implementa su propuesta en un branch y presentamos resultados medibles al equipo. Si es de preferencias (un 'me gusta más X que Y'), usamos el criterio de 'quien va a mantener el código tiene el voto de calidad'. Lo que no hago es imponer mi opinión como desempate — ese proceso destruye ownership."

---

### "¿Qué haces cuando la dirección técnica de la empresa va en una dirección con la que no estás de acuerdo?"

**Qué evalúan:** Tu capacidad de alinear sin perder tu voz técnica, y si sabes cuándo pick your battles.

**Lo que quieren escuchar:**
- Que expresas tu punto de vista con datos una vez, de forma constructiva
- Que una vez tomada la decisión, la ejecutas con el mismo compromiso
- Que diferencias entre "no estoy de acuerdo pero puedo vivir con esto" y "esto va contra mis valores"

**Estructura sugerida:**
> "Expreso mi desacuerdo una vez con claridad, datos y alternativas. Si la decisión es diferente, pregunto qué información consideraron que yo no estaba viendo — a veces hay contexto de negocio o restricciones que no conozco. Una vez tomada la decisión, la ejecuto con el mismo compromiso que si fuera mía. La única excepción es si la decisión genera riesgos de seguridad, legales o éticos — en ese caso escalo con documentación clara, no con presión."

---

## Preguntas universales (todos los niveles)

Estas preguntas aparecen en entrevistas de cualquier nivel. La profundidad de la respuesta esperada varía.

| Pregunta | Qué evalúan | Nivel de profundidad esperado |
|----------|-------------|-------------------------------|
| "¿Por qué quieres cambiar de trabajo?" | Honestidad, motivaciones reales | Igual en todos los niveles |
| "¿Dónde te ves en 3 años?" | Ambición, alineación con el rol | Mayor claridad en senior |
| "¿Qué haces para mantenerte actualizado técnicamente?" | Curiosidad, aprendizaje continuo | Mayor especificidad en senior |
| "¿Cómo es tu proceso de onboarding en un proyecto nuevo?" | Autonomía, criterio, comunicación | Más estratégico en senior |
| "¿Qué tipo de equipo o empresa no sería un buen fit para ti?" | Autoconocimiento | Igual en todos los niveles |

:::warning Trampa frecuente en "¿Por qué quieres cambiar?"
Nunca hables mal de tu empresa o equipo anterior. Aunque tengas razones totalmente válidas, los entrevistadores lo interpretan como señal de que podrías hablar mal de ellos después. Reformula en positivo: "Busco [lo que quieres], no huyo de [lo que no quieres]".
:::
