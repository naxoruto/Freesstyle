# Guía de componentes UI

> **Estado:** inventario inicial y proceso aprobados el 25 de noviembre de 2026. Implementación inicial de la biblioteca UI en curso; la migración del resto de páginas sigue pendiente.
>
> **Plan:** [Plan de trabajo, §10.1](../PLAN_DE_TRABAJO.md).

## Propósito

Freestyle Arena necesita un **sistema de diseño**: reglas visuales compartidas, tokens y componentes UI reutilizables. La biblioteca debe hacer que los controles comunes —en especial botones, campos, avisos y estados— mantengan el mismo lenguaje visual, comportamiento y accesibilidad en cada página.

La biblioteca no sustituye los componentes de dominio ni elimina la identidad de experiencias específicas. Se compone con patrones comunes cuando estos encajan.

## Auditoría inicial

La revisión de `apps/web/src` encontró:

- La auditoría inicial encontró que no había un componente transversal de botón, campo, panel, aviso ni estado vacío. UI-02 ya incorporó una primera base (`Button`, `TextField`, `TextArea`, `Panel`, `Alert`); aún quedan controles y páginas por migrar.
- Los botones principales presentan tratamientos distintos: Inicio/entrada usan esquinas redondeadas; Torneos suele usar bordes rectos y estilos definidos en cada control; lobby, póster, demo e inventario tienen clases propias.
- Los campos repiten clases visuales sin componente común y con diferencias de espaciado, foco y borde.
- `globals.css` supera las mil líneas y reúne tokens globales, animaciones y estilos específicos de Hero, catálogo, inventario, lobby, póster y demo. Tailwind se usa en paralelo.
- Las páginas/composiciones de mayor tamaño observadas son batalla (`battle/[id]/page.tsx`, ~800 líneas), torneo (`tournament/page.tsx`, ~490), juego Freestyler (~366), inventario (~288), `BattleLobby` (~261) y `BattleModeSelector` (~213). El tamaño orienta la revisión, pero no obliga por sí solo a crear componentes.
- Hay reutilización de dominio: `BattleModeSelector` aparece en lobby y creación/configuración del torneo; `BattleLobby`, `RubricPanel`, `ScoreBoard`, `Timer` y `WordDisplay` representan piezas de batalla; `BattlePosterDialog`, `HeroSection` y `OneVsOneDemo` son composiciones especializadas.
- `Toaster`, `showToast` y `useClipboard` ya existen como utilidades, aunque el feedback de error no es consistente en todas las páginas.

Este inventario es una línea base, no un mandato para convertir cada fragmento en componente. Se completará y ajustará mientras se inspeccionan/migran páginas.

## Catálogo inicial objetivo

### Fundamentos visuales

- Tokens para color, tipografía, espaciado, tamaños, bordes, foco y movimiento.
- Reglas de interacción comunes: hover, foco visible, carga, deshabilitado y error.
- Variantes de botón con intención clara: principal, secundario, texto/terciario, peligro y botón de icono.

### Componentes UI compartidos candidatos

| Componente | Responsabilidad |
|---|---|
| `Button` | Acción con variantes, tamaño, icono, carga y estado deshabilitado consistentes |
| `TextField` / `Textarea` | Etiqueta, descripción, error, límite y estados accesibles |
| `Select` / `SegmentedControl` | Elección entre opciones con selección y foco visibles |
| `Panel` | Contenedor con jerarquía, encabezado y espaciado común |
| `Alert` | Mensajes informativos, de éxito y error |
| `EmptyState` | Estado vacío con explicación y acción opcional |
| `PageHeader` | Título, descripción, navegación o acción contextual cuando el patrón se repite |
| `Dialog` | Base accesible reutilizable cuando los diálogos compartan comportamiento suficiente |

La lista es una guía para evaluar cada extracción. No se crean componentes que no tengan al menos un uso real o reutilización razonable identificada.

### Componentes de dominio que se conservan y evolucionan

Batalla: `BattleModeSelector`, `BattleLobby`, `RubricPanel`, `ScoreBoard`, `Timer`, `WordDisplay`, `BattlePosterDialog`.

Experiencias/páginas: `HeroSection`, `OneVsOneDemo`, patrones del catálogo e inventario, y futuras composiciones de torneo. Estos pueden componerse usando `Button`, campos, paneles y avisos compartidos sin borrar su diseño particular.

## Regla para funcionalidades nuevas

Antes de implementar interfaz nueva:

1. Consultar este catálogo y buscar usos existentes en `apps/web/src/components`.
2. Reutilizar la pieza actual si su semántica coincide; si falta una variante, ampliarla sin romper sus consumidores.
3. Extraer un componente nuevo cuando tenga responsabilidad nombrable y más de un uso previsto/real, o cuando reduzca de forma clara la complejidad de una composición grande.
4. Evitar componentes genéricos cargados de excepciones. Si el patrón es único (por ejemplo, una ficha del catálogo o un control visual de demo), mantenerlo local y documentar la razón si se aparta de los fundamentos comunes.
5. Registrar en esta guía el nuevo componente, su propósito, variantes, consumidores y fecha; actualizar el plan/registro central cuando el estado cambie.

## Orden de migración

1. Terminar inventario de patrones y definir tokens/contratos de accesibilidad.
2. Implementar y mostrar ejemplos de las primitivas UI en un entorno comprobable.
3. Migrar por grupos de flujo: Inicio y entrada; batalla; torneo; juego diario; catálogo e inventario.
4. Dividir páginas grandes en componentes de sección al mismo tiempo que se migran, manteniendo datos y reglas de negocio en su capa correspondiente.
5. Retirar estilos duplicados solo después de comprobar que no tengan consumidores y que el render migrado conserve estados y responsive.

La prioridad de migración se coordina con T12/WEB-01, T11–T13/WEB-02 y el resto de fases; no se interpreta como permiso para posponer correcciones urgentes de producto. Cada etapa incluye su verificación funcional, visual, móvil y accesible.

## Registro de componentes

Actualizar esta tabla al crear, fusionar, renombrar o retirar componentes compartidos.

| Nombre | Tipo | Ubicación/consumidores | Estado |
|---|---|---|---|
| `BattleModeSelector` | Dominio, reutilizable | `components/BattleModeSelector.tsx`; lobby, creación de batalla y torneo | Existente; sus opciones usan `Button` |
| `BattleLobby` | Composición de dominio | `components/BattleLobby.tsx`; lobby de batalla | Existente; sus acciones usan `Button` |
| `RubricPanel`, `ScoreBoard`, `Timer`, `WordDisplay` | Dominio | `components/`; batalla | Existentes |
| `BattlePosterDialog` | Dominio | `components/`; lobby y resultado de batalla | Reutiliza `Dialog`, `Button` y `Alert` |
| `HeroSection`, `OneVsOneDemo` | Experiencia | `components/`; inicio/demo | Existentes, con identidad propia |
| `Button`, `ButtonLink` | UI base | `components/ui/Button.tsx`; Inicio, inscripción, torneo, batalla, lobby, rúbrica y cartel | Implementación inicial; variantes principal, secundario, ghost, peligro y opción |
| `TextField`, `TextArea` | UI base | `components/ui/Field.tsx`; Inicio, creación de torneo, inscripciones y voto por patrón | Implementación inicial; etiquetas y ayuda accesibles |
| `Panel`, `Alert` | UI base | `components/ui/Panel.tsx`, `components/ui/Alert.tsx`; torneo, recuperación/votos de batalla y cartel | Implementación inicial |
| `Dialog` | UI base | `components/ui/Dialog.tsx`; editar formato, roles, MC presenciales y cartelera | Implementado el 26/11/2026; modal nativo, foco contenido, Escape, fondo inerte y restauración de foco/scroll |
| `Select`, `SegmentedControl`, `EmptyState`, `PageHeader` | UI base | Pendiente de usos y diseño en siguientes etapas | Planificados; aún no implementados |

El lobby usa `Button variant="option"` para personas y roles con emojis, y `TextField` para los nombres de MC presenciales. Antes de crear otra ventana emergente, reutilizar `Dialog`; el contenido específico sigue siendo del flujo de dominio.
