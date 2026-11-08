# GAME JAM — Invasores

> **Fecha:** 2026-11-07
> **Estado:** Borrador

## Cómo se ha interpretado el tema

"Invasores" es una amenaza que avanza desde fuera y una superficie que hay que defender. La jam la lee de tres maneras:

- **Defensa horizontal:** INVASORES, la más fiel a la sugerencia de `game-planner` y la que da vida a la entrada simulada `invasores` del catálogo.
- **Rompecabezas:** COLMENA, una colmena de colores que crece desde el techo.
- **Asedio radial:** ASEDIO, un planeta atacado desde todos los flancos.

## Comparación

| Juego     | `id`        | Categoría | Color   | Mecánica principal                                         | Esfuerzo   | Encaje con el catálogo                                                                      |
| --------- | ----------- | --------- | ------- | ---------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| INVASORES | `invasores` | SHOOTER   | green   | Cañón horizontal contra una formación que cambia de figura | medio      | Excelente: el id, la portada `cover-invaders` y la ficha ya existen; elimina un simulador   |
| COLMENA   | `colmena`   | PUZZLE    | magenta | Disparo vertical de colores; grupos de 3+ revientan        | bajo-medio | Bueno: segundo PUZZLE y el color menos repetido; necesita entrada y portada nuevas          |
| ASEDIO    | `asedio`    | SHOOTER   | cyan    | Cañón en órbita, defensa radial con pulso                  | medio      | Flojo: sería el tercer SHOOTER y su sensación se acerca a ROCAS; necesita entrada y portada |

Specs:

- [`juego-invasores.md`](juego-invasores.md)
- [`juego-colmena.md`](juego-colmena.md)
- [`juego-asedio.md`](juego-asedio.md)

## Decisiones tomadas con el usuario

- **INVASORES, cambio de figura "por tiempo o por bajas":**
  - Cambia cada 12 s o al caer 1/3 y 2/3 de la formación, lo que llegue antes.
  - Durante los 0,8 s del cambio los invasores no disparan y valen el doble.
- **INVASORES, escudo de fase:** 1 carga inicial, máximo 3, +1 carga cada 8 aciertos seguidos; cada carga absorbe un impacto.
- **INVASORES, disparo:** hasta 2 balas en pantalla y 0,25 s entre disparos.
- **Juegos de la jam:** se escriben los tres, INVASORES, COLMENA y ASEDIO.

Decisiones propias destacadas (motivo en cada spec):

- En INVASORES, la formación se ancla por su línea inferior, así que un cambio de figura nunca la acerca al suelo.
- En COLMENA, la rejilla es cuadrada y el disparo solo vertical.
- En ASEDIO, el tiro lejano vale ×2.
- Los juegos nuevos entran con `best: 0` y `plays: "0"`, sin inventar estadísticas.

## Recomendación

Implementar primero **INVASORES**:

- Es el objetivo del usuario y la sugerencia de `game-planner`.
- No necesita entrada de catálogo ni portada nuevas: solo se registra en `PLAYABLE` y se ajusta el texto `long`.
- Convierte en jugable un juego que hoy usa el simulador.
- Puede apoyarse en `games/rocas/` para el bucle, las balas y la integración.

Después, **COLMENA**: es el de menor esfuerzo, aporta variedad de categoría (PUZZLE) y no se solapa con nada del catálogo. **ASEDIO** queda como opción posterior, porque añadiría un tercer SHOOTER.

## Siguiente paso

1. Revisar los tres specs y pedir los cambios que hagan falta.
2. Para el elegido (recomendado: INVASORES), moverlo a `specs/10-juego-invasores.md`:
   - el siguiente número libre hoy es el 10;
   - sustituir `NN` por `10` en el título;
   - poner el estado `Aprobado`.
3. Lanzar `/spec-impl 10-juego-invasores` en la rama `spec-10-juego-invasores`.
