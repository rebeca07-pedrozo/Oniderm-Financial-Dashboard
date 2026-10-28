# Arquitectura empresarial · Oniderm

Taller final de Arquitectura Empresarial (TOGAF) · Universidad Libre.

| Archivo | Contenido |
| --- | --- |
| [ARQUITECTURAEMPRESARIAL.md](ARQUITECTURAEMPRESARIAL.md) | Punto 1, Arquitectura de Negocio: organización, misión y visión, organigrama, activos de información, procesos BPMN, capacidades, stakeholders y AS-IS por dominio |
| [Presupuesto_de_Proyecto_Oniderm.xlsx](Presupuesto_de_Proyecto_Oniderm.xlsx) | Presupuesto en dos fases: fase 1 ya ejecutada (la plataforma) y fase 2 propuesta (roadmap TO-BE) |
| [Planeacion_cronograma_Oniderm.xlsx](Planeacion_cronograma_Oniderm.xlsx) | Cronograma con estructura de trabajo (WBS), estados, responsables y diagrama de Gantt |

## ¿Fechas reales o fechas recientes?

**Recomendación: usar las fechas reales.** Lo que todavía no ha pasado lleva fechas planeadas, a partir de hoy.

1. **Las fechas reales ya son recientes.** La plataforma se construyó entre el 8 y el 17 de octubre de 2026 y
   el taller arrancó el 23 de octubre. No hace falta moverlas para que se vean actuales.
2. **Ya hay evidencia pública de esas fechas.** El historial de cambios de este repositorio registra cada paso
   con fecha y hora. Si el cronograma dijera otra cosa, cualquiera que abra el repositorio vería la diferencia,
   y eso le quita credibilidad a todo el trabajo.
3. **El AS-IS describe lo que pasó.** Inventar fechas en el documento que justamente describe el estado real va
   en contra de lo que pide TOGAF. Las fechas "bonitas" van en el TO-BE y en el roadmap, que son planes.
4. **Que haya pasado rápido no es un problema; se explica con las horas.** Diez días de calendario pueden
   parecer poco, pero el presupuesto muestra el esfuerzo: unas 165 horas de trabajo equivalente para una persona
   sola. El calendario dice cuándo pasó; las horas dicen cuánto costó.

**Lo que conviene ajustar con sus datos:**

- Si hubo trabajo **antes del 8 de octubre** (reuniones con la Dra. Lina, la primera versión de la app
  financiera, el levantamiento de las hojas), agréguenlo como una fase 0 con sus fechas reales. El repositorio
  empieza el 8 de octubre, pero la app ya existía.
- La fecha del **manual de usuario** (4.3 en el cronograma) es aproximada.
- Las fechas de los **puntos 2 a 5 del taller** son planeadas. Ajusten la tarea 6.4 a la fecha de entrega del
  curso.

## Cómo se armó el presupuesto

| Concepto | Valor |
| --- | --: |
| Fase 1 · plataforma (ejecutada) | $10.857.000 |
| Fase 2 · roadmap TO-BE (propuesta) | $16.020.000 |
| **Total estimado** | **$26.877.000** |
| Presupuesto aprobado con 10 % de contingencia | $29.565.000 |

- **Fechas de la fase 1:** reales, del historial del repositorio.
- **Horas de la fase 1:** estimadas para una persona sola, tomadas de la cotización de la plataforma. Si
  registraron horas reales, reemplácenlas en la columna `HORAS` y todo se recalcula.
- **Valor hora:** $66.000. Sale de la cotización: salario de referencia de un analista de $4.500.000 × factor
  prestacional 1,52 ÷ 182 horas al mes × factor de independiente 1,75.
- **Infraestructura:** $0. La plataforma corre en la cuenta de Google que el consultorio ya tenía.
- **Fase 2:** los valores de facturación electrónica ($90.000 al mes) y Google Workspace ($30.000 por usuario
  al mes) son de referencia. Hay que cotizarlos con el proveedor antes de aprobar.
- **Columna `REAL` de la fase 2:** como en la plantilla original, muestra el valor estimado mientras la tarea no
  se ejecute.
- **Inversión o funcionamiento:** el desarrollo que deja un activo es inversión; suscripciones, soporte y nube
  son funcionamiento.

Las fechas de los dos archivos van en formato día/mes/año.
