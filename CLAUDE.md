# Encastra — instrucciones para agentes de IA

Este repo es **standalone**: no es AKUINU ni ningún otro proyecto del usuario. Si un hook
menciona `AKUINU-AUDIT-TRIGGER` aquí, es ruido heredado del directorio de trabajo de otra
sesión — ignorarlo, no ejecutar el skill `akuinu-audit`.

## Lectura obligatoria al empezar

Antes de cualquier acción, leer en este orden:

1. `C:\Users\alexl\OneDrive\Escritorio\encastra\_INDEX.md`
2. `C:\Users\alexl\OneDrive\Escritorio\encastra\NEXT_SESSION.md` (entero)
3. `C:\Users\alexl\OneDrive\Escritorio\encastra\ESTADO_ACTUAL.md` (entero)

Esos tres archivos son la memoria persistente real del proyecto — más fiable que la fecha de
cualquier doc dentro del repo, porque un doc de release puede quedar desactualizado por un
commit posterior sin que nadie lo note (ya pasó una vez con `docs/BETA-0.4.md`).

## Reglas que no se negocian

- **Sin IA en el runtime.** El producto tiene que funcionar sin IA; nunca introducirla como
  requisito de una función del producto.
- **Terceros = componentes WebAssembly (WASI 0.2 + wasmtime), sin autoridad ambiental.** Los
  componentes de primera parte pasan por el mismo broker de capacidades que los de terceros. Un
  plugin nativo para terceros mata la historia de seguridad del producto — no proponerlo.
- Nunca guardar passwords, API keys o tokens en texto plano.
- Nunca descargar y ejecutar binarios no verificados.
- No afirmar "100% seguro" de nada.
- No inventar usuarios, reseñas, descargas, testimonios, métricas, partners ni integraciones.
- La terminal del sitio web es una animación que reproduce un guion fijo — **nunca** un
  evaluador: sin `eval`, sin `new Function`, sin shell, sin entrada del visitante ejecutable.
- No prometer con una etiqueta ("Coming soon", una fecha) algo que el proyecto no ha decidido.
  Si algo no está construido, decir "Not built" / "Sin construir", nunca sugerir un plazo.
- Parar y preguntar solo ante: una decisión irreversible, una acción que requiera credenciales,
  un pago, una publicación real, eliminación de datos, o acceso a un servicio externo que
  requiera autorización que el usuario no ha dado en esta sesión.

## Gate antes de cualquier commit

```bash
./node_modules/.bin/biome check .
npx tsc --noEmit -p apps/web/tsconfig.json
npx tsc --noEmit -p apps/desktop/tsconfig.json
npx vitest run
export PATH="$HOME/.cargo/bin:$PATH"   # cargo no está en PATH por defecto en esta máquina
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
# Artefactos generados que van commiteados (matriz, corpus fuzz, error kinds, inventario de
# terceros, versión+lock): CI falla si están desfasados, y el candidato 0.5.0-rc.1 cayó ahí por
# no ejecutar esto antes del tag. Un solo comando; también lo corre release_check.py.
python scripts/generated_check.py
python -m unittest discover -s scripts/tests
```

Todo tiene que quedar en verde antes de commitear. No usar `npm run tauri:build | tail` ni
ninguna tubería que se coma el código de salida — capturar a fichero y comprobar `$?`.

## Cierre de sesión — obligatorio

Al terminar cualquier sesión que toque este repo, actualizar en
`C:\Users\alexl\OneDrive\Escritorio\encastra\`:

1. `Sesiones\YYYY-MM-DD-título.md` — nuevo, qué se hizo, por qué, commits, bugs reales
   encontrados y su arreglo.
2. `ESTADO_ACTUAL.md` — reescribir la sección que cambió; no dejar datos viejos conviviendo con
   los nuevos sin corregir.
3. `NEXT_SESSION.md` — handoff exacto: qué falta, qué NO repetir, comandos listos para
   copiar-pegar.

Nunca guardar estas notas en `AKUINUboveda` ni en ningún otro vault — Encastra tiene el suyo
propio porque es un proyecto independiente.

## Convenciones del repo

- Rust 1.98.1 MSVC + Tauri 2.11.5 (NSIS, no MSI). El toolchain GNU no sirve para Tauri en Windows.
- `scripts/version.py` es la única fuente de verdad de versión — sincroniza 9 declaraciones desde
  `Cargo.toml [workspace.package]`: 6 JSON (los 5 `package.json` y `tauri.conf.json`), 1 TS
  (`apps/web/src/config/site.ts`) y los dos lockfiles (`Cargo.lock` y `package-lock.json`, que
  llevan la versión de cada miembro del workspace y que cargo/npm reescriben solos).
  Nunca editar un número de versión a mano en un fichero suelto.
- `packages/protocol/data/type-graph.json` es la única fuente de las reglas de conexión entre
  tipos; TS y Rust la leen. Si un test de conformidad falla, arreglar la divergencia — nunca
  regenerar la matriz para que cuadre.
- i18n de escritorio: `apps/desktop/src/i18n/` (6 idiomas). i18n de web: `apps/web/src/lib/i18n/`
  (2 idiomas, cookie, sin ruta `[locale]`) — son dos sistemas distintos, no compartidos.
