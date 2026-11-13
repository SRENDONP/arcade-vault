# GAME JAM — Mareas

> **Fecha:** 2026-11-13
> **Estado:** Borrador

## Cómo se ha interpretado el tema

"Mareas" es un nivel que sube y baja y que obliga a decidir dónde actuar. La jam (rutina semanal, un solo juego) lo lee como un puzle de emparejar piezas marinas en el que el agua sube a intervalos fijos y solo se contiene emparejando contra ella: el reflujo.

El catálogo tiene un único `PUZZLE` (CAÍDA, piezas que caen) y ninguno de decisión pausada, así que este tema cubre un hueco de categoría y de mecánica.

## Comparación

| Juego   | `id`      | Categoría | Color | Mecánica principal                                                       | Esfuerzo | Encaje con el catálogo                                                             |
| ------- | --------- | --------- | ----- | ------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------- |
| REFLUJO | `reflujo` | PUZZLE    | cyan  | Intercambiar piezas vecinas para formar grupos; la marea sube y solo baja con grupos que tocan lo sumergido | medio    | Bueno: segundo PUZZLE, mecánica distinta de CAÍDA; necesita entrada y portada nuevas |

Spec: [`juego-reflujo.md`](juego-reflujo.md)

## Decisiones tomadas (Decisión del agente)

Es una ejecución de la rutina semanal, sin preguntas al usuario; estas decisiones son del agente, con su motivo en el spec:

- **Un solo juego:** la rutina pide uno. Se priorizó el detalle del spec frente a variantes.
- **Categoría PUZZLE y color cian:** cubre el hueco de puzle de decisión pausada y el cian es el color del agua.
- **Piezas sumergidas inmóviles:** el giro propio del tema; la marea se vence emparejando, no esperando.
- **Reloj de la marea detenido durante la resolución:** no castiga las cadenas largas.
- **Forma y color por tipo de pieza:** accesibilidad y legibilidad en el skin Retro.
- **Valores de partida:** marea cada 9 s (mínimo 3 s), reflujo de 1 o 2 filas, nivel cada 10 grupos. Se ajustan jugando.
- **Catálogo:** `best: 0` y `plays: "0"`, sin inventar estadísticas.
- **Sin colisión de ids:** `reflujo` no existe en `lib/games.ts`, ni en la memoria de game-jam, ni en las sugerencias de `game-planner`.

## Recomendación

Implementar **REFLUJO**: es el único juego de la jam, añade variedad de ritmo (puzle pausado) frente a los reflejos de los otros seis juegos y reutiliza el patrón de skins de CAÍDA. Riesgo principal: el equilibrio de la marea; los valores están en constantes para afinarlos.

## Siguiente paso

1. Revisar el spec y pedir los cambios que hagan falta.
2. Moverlo a `specs/NN-juego-reflujo.md`:
   - el siguiente número libre hoy es el 14;
   - sustituir `NN` por `14` en el título;
   - poner el estado en `Aprobado`.
3. Lanzar `/spec-impl-game 14-juego-reflujo`.
