# Roadmap a producción

Ruta de construcción para llevar este starter a producción **para un cliente nuevo**.
Detalle de cada punto en [`CLIENT_SETUP.md`](./CLIENT_SETUP.md) (personalización) y
[`PRODUCTION_DEPLOY.md`](./PRODUCTION_DEPLOY.md) (deploy).

**Stack de destino:** servidor europeo + Coolify + Postgres 16 + Redis 7 + Cloudflare R2
+ Stripe + Resend + Sentry + Better Stack.

**Un servidor de 16 GB compartido por 2–3 clientes pequeños**, un proyecto de Coolify por
cliente, y Coolify compila la app en el propio servidor: sin CI, sin registros de
imágenes, una pieza menos que mantener. El cliente que crece pasa a un VPS dedicado
→ ver [Fase 5](#fase-5--infraestructura-servidor-compartido).

---

## Cómo se usa este roadmap

Cada fase termina en una **🚪 Puerta**: una condición verificable. **No se pasa a la
siguiente fase sin cumplirla.** No es burocracia — cada puerta evita un tipo concreto
de retrabajo:

- Saltarse la Fase 1 hace que reconstruyas regiones e impuestos después de cargar el catálogo.
- Saltarse la Fase 3 te lleva a producción sin saber que los emails fallan.
- Saltarse la Fase 6 abre una tienda con secretos por defecto y la base de datos expuesta.

Las fases 0–4 se hacen **en local, sin gastar un céntimo en servidor**. La infraestructura
(Fase 5) es lo último que se contrata.

**Progreso estimado del starter base: ~70%.** La app está lista (pagos, emails,
notificaciones, catálogo, observabilidad) sobre **Medusa 2.19.0**, con los Dockerfiles
de las dos apps y un seed de configuración apto para producción. La instrumentación de
errores está **cableada en los dos paquetes** y es no-op sin DSN: para cada cliente solo
hay que dar de alta las cuentas y pegar las claves. Falta personalización por cliente +
infra.

---

## Fase 0 — Base funcionando en local

**Objetivo:** confirmar que el starter arranca **antes** de tocar nada. Si algo falla
aquí, no es culpa de tus cambios.

- [ ] `cd medusa && cp .env.template .env` y rellenar lo mínimo (DB, Redis, S3 local)
- [ ] `docker compose up -d` desde `medusa/` (Postgres, Redis, MinIO)
- [ ] `corepack yarn && corepack yarn build && corepack yarn medusa db:migrate`
- [ ] `corepack yarn seed` + crear usuario admin
- [ ] `cd storefront && cp .env.template .env.local`, pegar la publishable key del admin
- [ ] Ambos `yarn dev` levantados

**🚪 Puerta:** un pedido de prueba completo de principio a fin en local — añadir al
carrito, checkout con tarjeta de test de Stripe, pedido visible en el admin.

---

## Fase 1 — Ficha legal y fiscal del cliente

**Objetivo:** responder las preguntas que **determinan el código**. Va antes que la
marca porque cambia regiones, impuestos y facturación, y rehacer eso después de
importar el catálogo duele.

- [ ] **País de tributación** del cliente (no dónde vende — dónde declara)
- [ ] **Forma jurídica y régimen de IVA**
  - 🇫🇷 Francia: ¿*micro-entreprise* en **franchise en base de TVA**? Umbrales 2026 para
    venta de mercancías: **85.000 €** (base) / 93.500 € (majoré).
    - **Sí** → no cobra IVA. Las regiones fiscales al **0 %** del seed son **correctas**.
      Obligatorio incluir en las facturas: «TVA non applicable, article 293 B du CGI».
    - **No** → hay que configurar los tipos de IVA reales en el admin (Settings → Tax Regions).
      El seed los crea **vacíos**: sin esto la tienda cobra 0 % de IVA.
- [ ] **Países donde va a vender.** Por defecto `seed-config.ts` abre solo `fr` (constantes
  `COUNTRIES` y `CURRENCY_CODE` al principio del archivo; hay una lista de ejemplo de la UE
  comentada debajo). Ajustarlo **antes** de la primera ejecución: después, la región no se
  toca desde el script sino en el admin.
  - Recomendación: **dejar solo el país del cliente al lanzar.** Vender a otro país de la
    UE convierte la factura en **obligatoria** (venta a distancia intracomunitaria), y
    superar 10.000 €/año de ventas B2C intra-UE obliga a IVA de destino + registro **OSS**.
  - `gb` ya no es UE: aduanas. Fuera salvo petición expresa.
  - Es reversible sin código: Settings → Regions en el admin.
- [ ] **¿Vende a empresas (B2B)?**
  - Sí → necesita capturar el **NIF / n.º de TVA** en el checkout. **Hoy no existe ese campo**
    (`storefront/src/modules/checkout/components/billing_address/index.tsx` solo tiene `company`).
    Es desarrollo adicional, presupuéstalo.
- [ ] **Facturación**: decidir la vía antes de lanzar
  - **No construir facturas dentro de Medusa.** Ni numeración, ni PDFs. En España sería
    ilegal (Verifactu, RD 1007/2023, sanciones hasta 50.000 €) y en Francia no cumple el
    formato exigido. Medusa lleva pedidos; el software certificado lleva facturas.
  - Volumen bajo → manual desde el software del contable. Volumen alto o B2B →
    integración con herramienta con API (Pennylane, Sellsy, Tiime, Holded, B2Brouter).
- [ ] 🇫🇷 **Calendario de facturación electrónica** — confirmar con su experto-contable:
  - **1 sept 2026:** todas las empresas deben poder **recibir** facturas electrónicas
    → necesita cuenta en una **Plateforme Agréée (PA)**. Es trámite administrativo, **no toca el código**.
  - **1 sept 2027:** TPE/PME deben **emitir** + hacer **e-reporting** de las ventas B2C
    (datos agregados por día, vía la PA). **Esto sí tocará Medusa** → ver Fase 8.

**🚪 Puerta:** documento con las respuestas, validado por el contable del cliente.
Sin esto no se toca ni una línea.

---

## Fase 2 — Marca, contenido y catálogo

**Objetivo:** que la tienda sea del cliente, no del starter.

- [ ] `storefront/src/lib/brand.ts` — nombre, descripción, SEO de home/store/about.
      **Cubre todo el storefront**: header, footer, checkout, titles y sitemap
- [ ] `medusa/.env` → **`STORE_NAME`** — cubre **todos los emails** (asuntos, cuerpo,
      cabecera y pie). Estos dos sitios son los únicos: no hay ni un nombre escrito a
      mano en componentes ni en plantillas
- [ ] `storefront/public/images/og-default.jpg` (preview en redes)
- [ ] Variables: `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_BASE_URL`
- [ ] **Regiones**: dejar solo las decididas en la Fase 1 (admin → Settings → Regions)
- [ ] **Impuestos**: configurar los tipos según la Fase 1 (o confirmar que 0 % es correcto)
- [ ] **Páginas legales** — hoy son plantillas genéricas, hay que redactarlas con el cliente:
      `privacy-policy`, `terms-of-use`, `cookie-policy`. 🇫🇷 Añadir **Mentions légales**
      (obligatorias en Francia) y **CGV**.
- [ ] Importar el catálogo CSV del cliente (admin → Products → Import)
- [ ] Sustituir las imágenes del seed por las del cliente. En producción no se ejecuta
      `seed-demo.ts` (sofás de demo), solo `seed-config.ts`: ver `PRODUCTION_DEPLOY.md` §7

**🚪 Puerta:** navegar la tienda entera sin encontrar ni un texto o imagen del starter
("Sofa Society", "Mi Tienda", sofás de demo).

---

## Fase 3 — Emails, notificaciones y observabilidad

**Objetivo:** que el cliente **se entere** de que ha vendido, y que tú te enteres si eso se rompe.

**Qué envía el sistema hoy** (verificado en código):

| Email | A quién | Cuándo |
|---|---|---|
| `order-placed` | Comprador | Cada pedido |
| `order-update` | Comprador | Cada fulfillment (despacho) |
| `order-placed-merchant` | **Comerciante** | Cada pedido — requiere `MERCHANT_NOTIFICATION_EMAIL` |
| `customer-welcome` | Cliente | Solo al registrarse con cuenta |
| `auth-password-reset` | Cliente | A petición |

Más una notificación en la **campanita del admin** por cada pedido (sin configuración).

⚠️ **Stripe NO envía ningún email al comprador.** Medusa nunca le pasa `receipt_email`.
El comprador recibe **un solo email** por su compra: la confirmación de Medusa. No le
digas al cliente que Stripe manda un recibo.

- [ ] **Traducir las plantillas** de `medusa/src/modules/resend/emails/` al idioma del
      cliente. Están en inglés — pero el **nombre de la tienda y el email de contacto ya
      son variables** (`STORE_NAME` y `EMAIL_REPLY_TO`): solo hay que traducir el texto,
      sin tocar ni un literal de marca. Revisar también los `subjects` en `emails/index.ts`.
- [ ] `RESEND_FROM` con el dominio del cliente
- [ ] `EMAIL_REPLY_TO` → buzón real (`contact@`), para que las respuestas lleguen a alguien
- [ ] **`MERCHANT_NOTIFICATION_EMAIL`** → buzón que el cliente mire de verdad.
      **Sin esta variable no se envía el aviso de venta.**
- [ ] Enseñar al cliente a activar en **su** cuenta Stripe (cero código, 2 minutos):
      Settings → Profile → Communication preferences → *Successful payments*, y las push
      de la app móvil de Stripe. Es una señal de venta independiente de Resend.
- [ ] **Dimensionar la cuota.** Resend gratis: **100 emails/día**, 3.000/mes.
      A 3 emails por venta son ~33 pedidos/día de techo; recomendado no pasar de ~20/día
      sostenidos. Si el cliente proyecta más, Resend Pro son 20 $/mes sin límite diario.
      Alternativa gratuita mayor: Brevo (300/día) — módulo ya escrito y comentado en
      `medusa-config.js`, pero **estampa "Sent with Brevo"** en cada email.

### Alertas: enterarte tú antes que el cliente

> 🔁 **El código ya está hecho en el repo base.** Aquí solo quedan cuentas, claves y
> dominios, que son distintos en cada tienda. No hay nada que programar.

Tres capas que **no se solapan**: cada una ve lo que las otras dos no pueden ver.

| Capa | Herramienta | Detecta | Si falta |
|---|---|---|---|
| Errores backend | Sentry (proyecto Medusa) | Excepción dentro de Medusa | Los 500 del checkout pasan desapercibidos |
| Errores frontend | Sentry (proyecto storefront) | Pantalla rota para el comprador | Pierdes ventas sin enterarte |
| Disponibilidad | Better Stack | Que no responde **nadie** | Una caída del VPS es silencio absoluto |

La tercera capa es la que no se puede sustituir con las otras: Sentry reporta **desde
dentro** del proceso. Si el VPS se queda sin RAM, si Coolify no levanta el contenedor
tras un redeploy o si caduca el certificado, no queda proceso vivo que avise y Sentry
se queda mudo.

- [ ] **Dos proyectos en Sentry**, no uno: `<cliente>-medusa` y `<cliente>-storefront`.
      Separarlos permite silenciar el ruido de uno sin perder de vista el otro.
- [ ] `SENTRY_DSN` (backend, en `medusa/.env`) y `NEXT_PUBLIC_SENTRY_DSN`
      (storefront). El del storefront viaja al navegador a propósito: un DSN solo
      permite **enviar** eventos, nunca leerlos.
- [ ] **Crear la regla de alerta en cada proyecto de Sentry.** Sin la regla el error se
      queda en el dashboard y nadie lo mira; es el paso que se olvida siempre.
- [ ] **Better Stack** (plan gratuito: 10 monitores). Dos monitores, cada 3 minutos:
      - `https://<dominio-cliente>/api/health` → storefront
      - `https://api.<dominio-cliente>/health` → Medusa
      Están separados a propósito: cuando salte la alerta ya sabes **cuál** de los dos
      ha caído, sin ir a mirar.
- [ ] Avisos de Better Stack a **email + push del móvil**. El email solo no vale: una
      caída a las 23:00 un sábado tiene que sonar.
- [ ] Activar el **badge de status page** solo si el cliente lo pide. Por defecto no:
      expone las caídas a sus propios compradores.

**🚪 Puerta:** cuatro comprobaciones, en este orden.

1. Pedido de prueba que dispara y entrega **los 3 emails** (comprador, comerciante, y el
   de envío al marcar fulfillment), con la campanita del admin mostrando el pedido.
2. Error provocado a propósito en Resend que **llega a Sentry como alerta** (no solo al
   dashboard: la alerta tiene que salir del navegador).
3. Error provocado en el storefront que llega al **otro** proyecto de Sentry.
4. **Apagar el contenedor a mano** y comprobar que Better Stack te despierta el móvil
   **antes de que a ti se te ocurra mirar**. Es la única prueba que valida el objetivo
   real de esta fase; las tres anteriores solo validan las tuberías.

---

## Fase 4 — Código listo para desplegar

**Objetivo:** que el repo se pueda construir y arrancar en un servidor, sin sorpresas.

> 🔁 **Los puntos de "preparación del starter" se hacen UNA SOLA VEZ**, en el repo base.
> Cuando clones para un cliente nuevo ya vienen hechos y esta fase se reduce a los cuatro
> últimos puntos.

### Cómo se despliega: Coolify compila en el propio servidor

Es el camino por defecto, **elegido a conciencia**: haces `git push` y Coolify se
encarga. Sin CI, sin registros de imágenes, sin tokens que caducan. Una pieza menos que
mantener cuando llevas varias tiendas a la vez.

El peaje es conocido y asumido:

- Compilar pide **~3–4 GB extra** de RAM durante 15–25 minutos. En el servidor
  compartido de la Fase 5 se reserva ese hueco **una sola vez**, con las compilaciones
  limitadas a una a la vez.
- Cada despliegue tarda esos 15–25 minutos (más la espera si otro cliente está
  compilando), y durante ese rato el servidor va cargado. Con el tráfico de comercios
  pequeños, nadie lo nota.
- **No hay rollback instantáneo**: revertir un despliegue malo es revertir el commit y
  esperar otra compilación.

Es cambiar algo de RAM del servidor compartido por simplicidad. Decisión correcta a esta
escala. Si algún día los despliegues de 20 minutos molestan, está la
[opción avanzada](#opción-avanzada--compilar-en-github-actions) al final de la Fase 5.

### Preparación del starter (una vez)

- [x] ~~**`storefront/next.config.js`: activar `output: "standalone"`**~~ ✅ **HECHO en el
      starter** (`next.config.js`, `output: "standalone"`).
      Next empaqueta solo las librerías que usa de verdad, en vez de `node_modules`
      entero (555 MB en disco, casi todo herramientas de desarrollo que el servidor
      nunca ejecuta). La imagen baja de ~1,2 GB a ~200 MB.
      Aunque compiles en el VPS **merece la pena igual**: menos disco y despliegues
      más rápidos.
      ⚠️ Esto **no afecta a las fotos de producto** — viven en R2 y nunca entran en la
      imagen Docker. "Imagen" aquí es el paquete de la app, no un JPG.
- [x] ~~**`storefront/Dockerfile` y `medusa/Dockerfile`**~~ ✅ **HECHOS en el starter**,
      con sus `.dockerignore`. Node 22 (la rama 20 dejó de tener soporte en abril de
      2026) sobre Debian slim, no Alpine: `sharp` —que redimensiona las fotos de
      producto— da problemas de binarios con musl.
      El storefront usa `output: "standalone"`, así que la imagen lleva solo las
      dependencias rastreadas y no los `node_modules` enteros. El backend fija
      `NODE_ENV=production` en la propia imagen, de modo que el guard de secretos queda
      activo aunque se olvide la variable en Coolify.
      ⚠️ **Las `NEXT_PUBLIC_*` hay que marcarlas como Build Args en Coolify**: se
      incrustan al compilar, no al arrancar.
- [x] ~~**`medusa-config.js`: registrar los módulos de Redis**~~ ✅ **HECHO en el starter.**
      Registrados `cache-redis`, `event-bus-redis` y `workflow-engine-redis`.
      **Es fiabilidad, no rendimiento**: antes el bus de eventos vivía en memoria, así que
      si Medusa se reiniciaba entre el cobro y el envío de los emails el evento se perdía
      **sin cola ni reintento** y la clienta no se enteraba de que había vendido. A poco
      volumen es más grave, no menos: perder 1 pedido de 20 es el 5 % del mes.
      ⚠️ **`REDIS_URL` pasa a ser obligatoria**: sin ella Medusa ya no arranca. Es
      deliberado — mejor un error ruidoso que una caída silenciosa a memoria volátil
- [x] ~~**`storefront/package.json`: mover `axios` de `dependencies` a `devDependencies`.**~~
      ✅ **HECHO en el starter** (`443d5eb`). Solo lo usa `e2e/data/seed.ts` (helper de
      los tests de Playwright): nunca entra en el bundle ni en la imagen Docker, y ya no
      saca el crítico falso `axios > form-data` en `yarn audit`.
- [x] ~~**Medusa 2.8.8 → 2.19.0**~~ ✅ **HECHO en el starter** (`b906014`). Cierra las
      vulnerabilidades de MikroORM que 2.8.8 no dejaba parchear.
- [x] ~~**Seed separado en configuración y demo**~~ ✅ **HECHO en el starter.**
      `seed-config.ts` (región, envíos, impuestos, publishable key; idempotente, apto
      para producción) y `seed-demo.ts` (catálogo de demo, solo local).
- [x] ~~**Invalidación de la caché del catálogo del storefront**~~ ✅ **HECHO en el
      starter** (PR #1, `fc98528`). Antes el catálogo se cacheaba con `force-cache` y
      nada lo invalidaba: lo cambiado en el admin **no se veía en la tienda hasta el
      siguiente despliegue**. Ahora:
      - El subscriber `revalidate-storefront` avisa a `/api/revalidate` del storefront
        al cambiar productos, variantes, colecciones, categorías, tipos, materiales o
        colores. Se ve con un F5 normal en segundos.
      - Red de seguridad: TTL de 5 min en el catálogo y de 1 h en regiones, envíos y
        métodos de pago. El stock va aparte con TTL de 30 s, para que las ventas no
        invaliden el catálogo.
      - Si el storefront está caído, el guardado en el admin no se bloquea: el fallo
        va al log y a Sentry, y el cambio se ve al caducar el TTL.
      ⚠️ **`REVALIDATE_SECRET` tiene que valer lo mismo en el backend y en el
      storefront**: si difieren, los avisos se rechazan con 401 y todo va con 5 min
      de retraso.
      Solo cubre el TTL (sin evento): las listas de precios y añadir o quitar
      productos desde la página de una colección.

### Por cada cliente

- [ ] `storefront/next.config.js` — añadir el dominio de R2 del cliente en `remotePatterns`
- [ ] `corepack yarn build` en `medusa/` y `yarn build` en `storefront/`: **ambos sin errores**
- [ ] `yarn lint` en `storefront/` limpio (es lo que corre el CI)
- [ ] Commit + push a `main` (rama de producción del proyecto del cliente; en la base se
      trabaja en `medusa-2.19`)

**🚪 Puerta:** los dos builds pasan en limpio desde cero y el CI de GitHub está verde.

---

## Fase 5 — Infraestructura (servidor compartido)

**Objetivo:** levantar el entorno. Primer gasto real.

**Modelo por defecto: un servidor de 16 GB compartido por 2–3 clientes pequeños**
(Hetzner u OVH), con Coolify compilando en el propio servidor. Cada cliente vive en su
**propio proyecto de Coolify**, con su Postgres, su Redis y sus variables: no comparten
base de datos, ni credenciales, ni claves de Stripe.

Por qué compartir y no un VPS por cliente: un comercio pequeño usa una fracción mínima de
un servidor. Lo que dimensionaba el VPS de 8 GB era la **compilación** (+3 GB durante
15–25 min), no la tienda. Con las compilaciones en cola de una en una, ese pico se paga
**una vez por servidor** y no una vez por cliente.

El VPS dedicado no desaparece: es adonde se muda un cliente cuando crece o cuando pide
aislamiento (criterios más abajo). Como cada cliente es un proyecto de Coolify
independiente con sus backups fuera del servidor, mudarlo es restaurar en otra máquina y
cambiar el DNS.

### Presupuesto de memoria (16 GB, 3 clientes)

| Pieza | Por cliente | × 3 clientes |
|---|---|---|
| Backend Medusa | `1G` | 3 GB |
| Storefront Next | `768M` | 2,25 GB |
| Postgres | `512M` | 1,5 GB |
| Redis | `128M` | 0,4 GB |
| **Subtotal tiendas** | **~2,4 GB** | **~7,2 GB** |
| Coolify (panel, su Postgres/Redis, proxy) | — | ~1,5 GB |
| **Una** compilación en curso | — | ~3–4 GB |
| Margen para el sistema y la caché de disco | — | ~3,5 GB |

Con 3 clientes el servidor queda en torno al 75 % en el peor momento (una compilación en
marcha). **Un cuarto cliente no cabe** sin quitar margen: o nuevo servidor, o mudar al
que más consume a un VPS dedicado.

⛔ **Esto solo cuadra con las compilaciones limitadas a 1.** Dos compilaciones a la vez
son +6–8 GB y el servidor empieza a matar procesos, empezando a menudo por un Postgres.

### Elección de proveedor

Los medios van a Cloudflare R2, así que el disco del servidor casi no crece y el tráfico
de salida es solo HTML/JSON. Cualquier cuota incluida sobra.

| Proveedor | Perfil 16 GB | Nota |
|---|---|---|
| ⭐ **Hetzner CAX31 (ARM)** | 8 vCPU / 16 GB | 🇩🇪 La mejor relación precio/RAM. **El stock es su punto débil.** Todo el stack tiene imágenes arm64 y, compilando en el propio servidor, no hay cross-compilación |
| ⭐ **OVHcloud VPS** (gama de 16 GB o más) | según gama | 🇫🇷 Tráfico ilimitado y backup automático del VPS incluido. Datacenters en Francia: argumento comercial directo |
| **Hetzner CPX / CCX** | 16 GB | 🇩🇪 x86. Verifica ubicación: los datacenters de EE. UU. y la gama CCX (vCPU dedicado) cuestan bastante más |
| **Netcup** | 16 GB | 🇩🇪🇦🇹 Alternativa sólida si OVH y Hetzner fallan |
| Contabo | 16 GB+ | ⚠️ El más barato, pero disco lento: mala idea con varios Postgres |

Precios orientativos: **comprueba precio y stock al contratar**, cambian a menudo.
Alemania y Suiza también valen para el RGPD: solo hace falta un proveedor francés si el
cliente lo pide expresamente.

⚠️ El backup automático del VPS que incluye OVH es una **instantánea de la máquina en el
mismo proveedor**. Viene bien para reconstruir el servidor, pero **no sustituye** el
backup de Postgres fuera del servidor (ver más abajo).

### Coste y permanencia

El servidor se reparte entre los clientes que aloja: que cada uno lo vea como una línea
de su factura (su parte del servidor + backups), desde el primer mes.

La regla con la permanencia sigue siendo **no comprometerte con el proveedor más de lo
que tus clientes se comprometen contigo**:

- [ ] **Mientras el servidor no tenga ninguna tienda en producción → sin permanencia.**
      Un proyecto puede caerse (el cliente no aprueba, cambia de idea, se retrasa).
- [ ] **Con tiendas vivas y clientes pagando mantenimiento → 12 meses**, en la
      renovación. Un servidor compartido es aún más estable que uno dedicado: aunque se
      vaya un cliente, el servidor sigue lleno con los demás.

### Montaje del servidor (una vez por servidor)

> **Sistema:** **Ubuntu 24.04 LTS**. Elegir siempre la LTS: Coolify la soporta
> oficialmente y trae 5 años de parches de seguridad.

- [ ] Contratar el servidor + instalar Coolify
- [ ] **Swap de 4 GB** (red de seguridad barata, recomendada por Coolify)
- [ ] **Compilaciones simultáneas = 1**: en Coolify, configuración del servidor →
      **Concurrent Builds** = `1`. El valor por defecto permite varias a
      la vez, y es justo lo que el presupuesto de memoria de arriba no aguanta. Los
      despliegues que coincidan esperan en cola: con clientes que despliegan pocas veces
      al mes, casi nunca pasa.
- [ ] Cron semanal de `docker system prune -af` (si no, el disco se llena en unos meses).
      Solo imágenes y capas sin usar: **nunca con `--volumes`**, que borraría los datos
      de los Postgres de los clientes
- [ ] **Destino de backups**: Coolify → *S3 Storages* → un S3 (Cloudflare R2 u otro
      compatible) con un bucket de backups **distinto** del de las fotos de producto
- [ ] Firewall y SSH según la Fase 6 (sirve para todos los clientes del servidor)

### Alta de un cliente (una vez por cliente)

- [ ] Coolify: **un proyecto nuevo por cliente** (`<cliente>`), con su entorno
      `production`. Dentro, y solo dentro de ese proyecto:
      - **Postgres 16** y **Redis 7** como servicios gestionados, con las credenciales que
        genera Coolify. **Nunca** marcar *Make it publicly available*
      - Apps `medusa-backend` y `storefront` **desde el repo Git del cliente, rama
        `main`**, con su Dockerfile (detalle en `PRODUCTION_DEPLOY.md` §2)
      - Variables de entorno de ese cliente (listado completo en `PRODUCTION_DEPLOY.md` §3).
        Secretos generados para él: nada copiado de otro cliente
- [ ] Cloudflare R2: bucket de fotos + CORS + API token **restringido a ese bucket**
- [ ] Dominio + DNS apuntando al servidor + **SSL emitido** (Let's Encrypt vía Coolify)
- [ ] Primer despliegue en orden: backend (migraciones) → `seed-config` → usuario admin →
      publishable key en el storefront → rebuild del storefront (`PRODUCTION_DEPLOY.md` §7)
- [ ] **Verificar dominio en Resend**: registros **SPF, DKIM y DMARC** en DNS.
      Sin esto los emails van a spam o se rechazan.

### Límites de memoria por contenedor

En cada app o servicio de Coolify → *Advanced* / *Resource Limits* → límite de memoria.
**No son opcionales en un servidor compartido**: sin ellos, un cliente con un pico se
lleva por delante a los demás.

- [ ] Backend Medusa `1G` · Storefront `768M` · Postgres `512M` · Redis `128M`
      *(con el límite puesto, Node detecta el cgroup y ajusta su memoria solo. Sin
      límite, V8 reserva ~2 GB de heap y **nunca los devuelve al sistema**)*
- [ ] Postgres: `shared_buffers=128MB`, `max_connections=50`, `work_mem=4MB`
- [ ] Redis: `maxmemory 100mb`, `maxmemory-policy noeviction`
      *(el techo va por debajo del límite del contenedor. `noeviction` y no
      `allkeys-lru`: aquí Redis también guarda la cola de eventos y el estado de los
      workflows, y con LRU podría descartar un evento de pedido pendiente para liberar
      memoria. Mejor un error visible que un email de pedido perdido)*
- [ ] **Cloudflare delante del storefront**, con caché sobre `/_next/image`: quita del
      servidor el trabajo de redimensionar fotos, que es su mayor gasto de CPU

### Backups de Postgres fuera del servidor

Si el servidor se pierde, se pierden **todos** los clientes a la vez. Por eso el backup
de cada base de datos sale del servidor.

- [ ] En cada Postgres de cliente → *Backups* → programación diaria **`0 3 * * *`**
      (03:00, fuera de horas de compra), con destino el S3 del montaje.
- [ ] **Retención: 14 días en S3** y **2 copias locales** en el servidor (sirven para
      restaurar rápido, no para un desastre).
- [ ] Ruta separada por cliente dentro del bucket de backups, para poder entregar o
      borrar los backups de uno sin tocar a los demás.
- [ ] Token del bucket de backups **solo** con acceso a ese bucket, y distinto del token
      de las fotos.
- [ ] **Restauración probada** antes de abrir cada tienda (Fase 6) y después una vez al
      trimestre. Un backup no verificado no es un backup.

**🚪 Puerta:** `https://api.dominio.com/health` responde OK, el admin carga en `/app` con
SSL válido, y el storefront carga con SSL válido. Además: **un despliegue completo de las
dos apps sin que muera por falta de memoria** con las demás tiendas del servidor en
marcha, `docker stats` con todos los contenedores por debajo de su límite, y **un backup
de Postgres visible en R2**.
*(Nota: `/health` solo existe con `medusa start`, el comando de producción. En
`medusa develop` no está.)*

### Cuándo pasar un cliente a un VPS dedicado

Basta con que se cumpla **uno** de estos criterios:

- [ ] **Tráfico o ventas sostenidos por encima de lo "pequeño"**: más de ~1.000 pedidos o
      ~50.000 visitas al mes durante dos meses seguidos, o catálogo de más de ~2.000
      productos.
- [ ] **Sus contenedores tocan el límite de memoria** de forma repetida, o necesitaría
      subirlos tanto que ya no caben los demás clientes.
- [ ] **Satura la cola de compilación**: despliega varias veces por semana y hace esperar
      a los demás.
- [ ] **Aislamiento contractual**: el cliente lo pide (auditoría, contrato de encargo de
      tratamiento RGPD, datos sensibles) o quiere que el servidor sea suyo.
- [ ] **Necesidades propias de disponibilidad**: un SLA, una ventana de mantenimiento
      distinta o un pico previsto (rebajas, campaña en medios) que no debe afectar a los
      demás.
- [ ] **El servidor compartido va justo**: RAM sostenida por encima del ~80 % o disco por
      encima del ~70 %. Se muda primero al cliente que más consume.

**Cómo se muda:** VPS dedicado de 8 GB (suficiente para uno solo) → Coolify → mismo
proyecto → restaurar el último backup de Postgres → desplegar → cambiar el DNS. Las
fotos siguen en R2 y no se mueven.

### ¿Cuánto aguanta este montaje?

Cifras orientativas **por cliente** para una tienda de moda con Cloudflare delante.

| | Cliente en servidor compartido | Cliente en VPS dedicado 8 GB |
|---|---|---|
| Visitas al mes | hasta ~50.000 | hasta ~150.000 |
| Pedidos al mes | hasta ~1.000 | hasta ~2.000 |
| Productos en catálogo | hasta ~2.000 | hasta ~2.000 |

**Un comercio pequeño francés está a años luz de estos límites.** El caso típico —10 a 50
pedidos al mes con 2.000–10.000 visitas— usa una fracción de su parte del servidor.

⚠️ **Cuidado al estimar visitas a partir de ventas.** La conversión normal en e-commerce
es del **1–3 %**, así que:

- 100 pedidos/mes ≈ **5.000** visitas/mes
- 500 pedidos/mes ≈ **25.000** visitas/mes
- 1.000 visitas/mes ≈ **10–30** pedidos/mes

Si el cliente espera 100–500 ventas mensuales necesita entre 5.000 y 25.000 visitas: eso
es presupuesto de marketing, no de servidor. Conviene aclararlo **antes** de firmar.

**El límite que llega antes que el servidor son los emails.** Resend gratis son 3.000
emails/mes y el sistema manda 3 por venta (ver Fase 3): techo de **~1.000 pedidos/mes**.
La cuota de correo se agota mucho antes que la RAM.

### Opción avanzada — compilar en GitHub Actions

**No hace falta hoy.** Se documenta por si más adelante los despliegues de 20 minutos o
la cola de compilación estorban, con muchos clientes o mucha frecuencia de cambios.

La idea: GitHub Actions compila las dos imágenes y las publica en **GHCR**; Coolify solo
se las descarga y las arranca. El servidor deja de compilar.

| | Compilando en el servidor (actual) | Compilando en Actions |
|---|---|---|
| Memoria reservada para compilar | ~3–4 GB por servidor | **ninguna**: cabe algún cliente más |
| Duración del despliegue | 15–25 min, en cola | **1–2 min**, sin cola |
| Rollback | revertir commit + recompilar | **redesplegar la imagen anterior** |
| Piezas que mantener | ninguna | workflow, GHCR, tokens, **por cada repo de cliente** |
| ARM (Hetzner CAX) | nativo, sin fricción | cross-compilación lenta o runners de pago |

**Por qué no es el camino por defecto:** con el servidor compartido, el coste de compilar
en él ya se reparte entre todos los clientes. El CI sería una pieza más que mantener y
depurar en cada repo, y con comercios pequeños que despliegan una vez al mes no compensa.

**Se puede adoptar cliente a cliente, cuando quieras**, sin tocar nada más: el Dockerfile
es exactamente el mismo, solo cambia quién lo ejecuta. Ojo a los ~2.000 minutos/mes
gratuitos de Actions en repos privados, compartidos entre todos tus repos.

---

## Fase 6 — Auditoría de seguridad

**Objetivo:** cerrar la casa antes de abrirla al público. **Obligatoria.** Nada de esto
es opcional y ninguno es caro — lo caro es saltárselo.

### Secretos
- [ ] **`NODE_ENV=production` definida en Coolify.** Va la primera porque de ella
      dependen las demás comprobaciones: el CLI de Medusa asume `development` si no
      está, y con eso el guard de secretos del punto siguiente **no se activa**
- [ ] `JWT_SECRET` y `COOKIE_SECRET` generados con `openssl rand -hex 32`.
      Con `NODE_ENV=production` Medusa **se niega a arrancar** si falta alguno, si vale
      `supersecret` o si tiene menos de 32 caracteres (`resolveSigningSecret` en
      `medusa-config.js`). Ya no puede colarse en silencio, pero sigue siendo el primer
      punto a verificar: el error aparece en el despliegue, no antes
- [ ] Secretos distintos entre local y producción, y distintos por cliente
- [ ] `.env` **no** commiteado (ya está en `.gitignore`, verifícalo con `git log -- medusa/.env`)
- [ ] Ninguna clave secreta en variables `NEXT_PUBLIC_*` — **son públicas en el navegador**
- [ ] `REVALIDATE_SECRET` definido, no trivial y **con el mismo valor en el backend y
      en el storefront** (si difieren, el storefront rechaza los avisos con 401)
- [ ] Claves de API con el mínimo alcance: token R2 solo a su bucket, API key de Resend
      solo de envío

### Red y servidor
- [ ] **Postgres y Redis NO expuestos a internet.** Solo red interna de Coolify.
      Verifícalo desde fuera: `nc -zv IP 5432` y `nc -zv IP 6379` deben fallar
- [ ] Firewall solo con **22, 80, 443** abiertos. En OVH el firewall de red se
      configura en el panel del VPS; complétalo con `ufw` en la propia máquina, porque
      el de OVH no filtra el tráfico entre servicios locales
- [ ] SSH con **clave, sin contraseña** (`PasswordAuthentication no`); root sin login directo
- [ ] Actualizaciones de seguridad automáticas (`unattended-upgrades`)
- [ ] Panel de Coolify con contraseña fuerte y **2FA activado**

### Aplicación
- [ ] `STORE_CORS`, `ADMIN_CORS`, `AUTH_CORS` con los **dominios reales**. Nunca `*`
- [ ] HTTPS forzado con redirección desde HTTP, y HSTS activado
- [ ] Usuario admin con contraseña fuerte, guardada en gestor de contraseñas.
      Borrar cualquier usuario de prueba del seed
- [ ] `STRIPE_WEBHOOK_SECRET` configurado (ya está en `medusa/.env.template`).
      Corrección: sin él el webhook **no** acepta peticiones falsas — la verificación de
      firma lanza excepción y rechaza todo. El riesgo es funcional, no de seguridad:
      Stripe no puede confirmar los cobros y los pedidos se quedan colgados sin pagar
- [ ] `corepack yarn npm audit` en `medusa/` y `yarn audit` en `storefront/`:
      cero críticas o altas **en lo que se ejecuta en producción**.
      No vale el número bruto del informe: el grueso son herramientas de desarrollo
      (eslint, tailwind, webpack, playwright) que no entran en la imagen. Lo que hay
      que mirar es lo que se ejecuta en el servidor o llega al navegador.
- [ ] `robots.txt` **sin `Disallow: /`** (si no, Google no indexa nada)

### Datos y RGPD 🇫🇷
- [ ] **Backup automático de Postgres** configurado en Coolify, diario y **fuera del
      servidor** (R2/S3, 14 días de retención: ver Fase 5)
- [ ] **Restauración probada al menos una vez.** Un backup no verificado no es un backup
- [ ] Banner de consentimiento de cookies si hay analytics/marketing (obligatorio en la UE).
      Verificar qué recoge `@agilo/medusa-analytics-plugin` antes de lanzar
- [ ] Política de privacidad con: responsable del tratamiento, finalidad, plazo de
      conservación y cómo ejercer los derechos RGPD
- [ ] Vía real para atender borrado/acceso de datos personales

**🚪 Puerta:** checklist completo, con los puertos comprobados desde fuera y una
restauración de backup ejecutada de verdad.

---

## Fase 7 — Producción y verificación final

**Objetivo:** abrir, con Stripe cobrando de verdad.

- [ ] Stripe en **modo live**: claves live + webhook a `/hooks/payment/stripe_stripe`
- [ ] **Compra real** con tarjeta propia (importe pequeño) → el pago aparece en Stripe live
- [ ] Llegan: confirmación al comprador **y** aviso al comerciante
- [ ] Marcar el pedido como fulfilled → llega el email "va en camino"
- [ ] Campanita del admin muestra el pedido
- [ ] Reembolsar esa compra de prueba desde Stripe y confirmar que se procesa
- [ ] Subir una imagen de producto → se guarda en R2 y se ve en el storefront
- [ ] `sitemap.xml` con URLs reales → enviar a Google Search Console
- [ ] **Caché del catálogo:** cambiar dos veces seguidas un producto en el admin, y
      que cada cambio se vea con un F5 normal. Medir también el desfase de relojes del
      servidor (ver §9 de `PRODUCTION_DEPLOY.md`)
- [ ] Probar el checkout en **móvil real**, no solo en el simulador del navegador
- [ ] Entregar al cliente: credenciales del admin, cómo despachar un pedido, a quién
      llamar si algo falla

**🚪 Puerta:** una venta real de principio a fin, con su reembolso, y el cliente sabiendo
operar el admin sin ayuda.

---

## Fase 8 — Después del lanzamiento

- [ ] Vigilar **los dos proyectos de Sentry** la primera semana: los fallos de email
      salen en el del backend, las pantallas rotas en el del storefront
- [ ] Revisar el histórico de Better Stack al mes: microcaídas repetidas de 1-2 minutos
      suelen ser el VPS quedándose corto de RAM, no un fallo puntual
- [ ] Revisar el consumo de Resend al mes (límite de 3.000/mes en el plan gratis)
- [ ] Confirmar que los backups se están ejecutando de verdad
- [ ] 🇫🇷 **Antes de sept 2027:** conectar el e-reporting B2C. La vía normal es
      Medusa → herramienta de facturación → Plateforme Agréée → DGFiP.
      En Medusa es **un subscriber sobre `order.placed`** que hace POST a la API de la
      herramienta (~100 líneas, mismo patrón que los subscribers existentes).
      A escala micro, alternativa sin código: export CSV mensual que procesa la gestoría.
      Elige la herramienta de la Fase 1 pensando ya en esto para no migrar dos veces.

---

## Historial de fallos y cómo revertirlos

Registro de los fallos que ha provocado el propio starter, con el commit que los
introdujo y el que los arregló. Sirve para dos cosas: saber **exactamente** qué revertir
si algo sale mal en producción, y no perder tiempo sospechando del sitio equivocado.

### 14 ago 2026 — verificación en runtime de los cambios de monitoreo y despliegue

Los tres fallos tienen algo en común: **ninguno se veía compilando.** Los tres pasaban
`medusa build`, `tsc` y `yarn lint` sin una sola queja. Solo aparecieron al **ejecutar**
el servidor y al **levantar los contenedores**. Es el argumento para no dar por buena una
fase solo porque el build pase.

| # | Síntoma | Lo introdujo | Lo arregló |
|---|---|---|---|
| 1 | El backend no arranca: `Subscriber with id ... already exists` | `0786d2d` | `9399f7e` |
| 2 | El contenedor del backend no arranca; corepack intenta descargar yarn | `6388311` | `c57ddf3` |
| 3 | El build del storefront muere si el backend no responde | *(preexistente)* | `346790b` |

**1. Colisión de ids de subscriber.** Al envolver los seis subscribers con
`withErrorReporting`, todos pasaron a exportar la función interna del wrapper, con el
mismo nombre. Medusa deriva el id del subscriber de ese nombre. Se arregla conservando el
nombre del handler original.
Revertir todo el bloque de monitoreo del backend: `git revert 9399f7e 0786d2d`

**2. `yarn start` dentro del contenedor.** Corepack intentaba descargarse yarn 4.7.0 en
cada arranque —la tienda habría necesitado internet para encenderse— y además daba un
falso *"the project doesn't seem to have been installed"*. Se arregla llamando al binario
que ya viene en la imagen.
Revertir los Dockerfiles: `git revert c57ddf3 6388311`

**3. `generateStaticParams` sin `try/catch`.** Seis páginas llamaban al backend al
compilar sin capturar el error. **Esto venía del starter original**, no de los cambios de
esta sesión; nunca se había visto porque hasta ahora nadie había construido el storefront
en un contenedor aislado. Sigue sin cubrir `/_not-found`, que renderiza `Header` y
`Footer` y por tanto **necesita el backend vivo al compilar**: de ahí que el orden
backend → storefront de la Fase 5 sea obligatorio, no una recomendación.

**Lo que NO causó ningún fallo**, para no volver a sospechar de ello:

- El commit de seguridad `c117ed5` (secretos de firma + rutas de Stripe). El backend
  arranca y responde con él aplicado, en dev y en contenedor.
- **Ningún `.env` ni `.env.local` se ha movido ni tocado nunca.** Están en `.gitignore` y
  no aparecen en ningún commit — compruébalo con `git log --all -- medusa/.env`. Lo único
  que cambió fue `.env.template`, que es documentación y no lo lee ningún código.

---

## ¿Qué es un Dockerfile? (obligatorio para este stack)

Es la "receta" que empaqueta la app (código + Node + dependencias) en un contenedor que
corre idéntico en local y en el servidor. Con Coolify **se necesita uno por app**.

✅ **Los dos ya están en el repo** (`medusa/Dockerfile` y `storefront/Dockerfile`), con
sus `.dockerignore`, y son iguales para todos los clientes: no hay que escribirlos ni
copiarlos de ningún sitio. El del storefront ya aprovecha `output: "standalone"`
(~200 MB, no ~1,2 GB).

Quién ejecuta ese Dockerfile es una decisión aparte: **el propio servidor vía Coolify**
(lo que hacemos) o GitHub Actions (la opción avanzada del final de la Fase 5). El archivo
es el mismo en los dos casos.

## Pendiente no bloqueante (operación)

No impiden abrir la primera tienda, pero conviene resolverlos antes de tener varias en
producción. Van en la base, no en cada cliente.

- [ ] **Activar GitHub Actions en el repo de la base.** Es un fork de
  `Agilo/fashion-starter`, y en los forks GitHub deja los workflows desactivados hasta
  que se activan a mano (pestaña Actions → *enable*; por la API no se puede). Hasta hoy
  el lint de CI **no ha corrido nunca**: el PR #1 se fusionó con las comprobaciones
  hechas en local. Al activarlo, revisar que estén los 5 secretos que lee
  `.github/workflows/node.js.yml`. Comprobar lo mismo en cada repo de cliente que salga
  de un fork: sin esto, la puerta de la Fase 4 ("el CI de GitHub está verde") no se
  puede cumplir.

- [ ] **Entorno de staging.** Hoy lo único que hay es local y producción: la primera vez
  que un cambio corre en un contenedor real con Postgres y Redis de Coolify es en la
  tienda del cliente. Definir un staging (un proyecto de Coolify más en el servidor
  compartido, con BD propia, Stripe en modo test y `DISALLOW_ROBOTS=true`) y a qué rama
  sigue. Lo necesita además Apple Pay (ver Backlog): no se puede probar en localhost.
- [ ] **Flujo de los despliegues posteriores al primero.** `PRODUCTION_DEPLOY.md` solo
  cubre el primer despliegue. Falta documentar:
  - **Backup manual de Postgres antes de cualquier despliegue que traiga migraciones.**
    Las migraciones son irreversibles y el Post-deployment de Coolify no hace rollback:
    el backup diario puede tener hasta 24 h de pedidos de retraso.
  - **Cómo llega una actualización de la base (`medusa-2.19`) al repo de un cliente y de
    ahí a producción**: merge o cherry-pick hacia el `main` del cliente, qué se revisa
    antes (migraciones nuevas, variables nuevas en `.env.template`, cambios en los
    Dockerfiles), qué se prueba en staging y en qué orden se despliegan backend y
    storefront.
  - Qué hacer si una migración falla a mitad: restaurar el backup previo y volver al
    commit anterior.
- [ ] **Revisión de Dependabot.** No hay `.github/dependabot.yml`. Decidir si se activa,
  con qué ecosistemas y directorios (`medusa/` con Yarn 4 y `storefront/` con Yarn 1 son
  independientes), con qué frecuencia y agrupación de PR para no ahogarse en ellas, y
  quién revisa las alertas de seguridad: en la base y en cada repo de cliente. Ojo con
  los paquetes `@medusajs/*`: van fijados a la misma versión exacta y se suben todos
  juntos, nunca uno a uno.

## Backlog / opcional (solo si el cliente lo pide)

- [ ] **Google Pay / Apple Pay en el checkout** — **DECIDIDO: Opción A.** Pendiente de
  arrancar; empezar solo cuando el usuario lo pida.

  **El problema:** en el dashboard de Stripe es un toggle, pero **en este código no**. El
  checkout usa la API antigua de tarjeta (`<CardElement>` + `stripe.createToken` +
  `confirmCardPayment`) y los wallets solo funcionan con `<PaymentElement>` o
  `<ExpressCheckoutElement>`. Activarlo en Stripe sin tocar el código no hace aparecer
  ningún botón.

  **Opción A (la elegida) — botón express:** dejar el flujo de tarjeta intacto y añadir un
  `<ExpressCheckoutElement>` encima del paso 4 de pago. `StripeWrapper` ya monta
  `<Elements>` con `clientSecret`, que es justo lo que necesita.
  Ficheros: `storefront/src/modules/checkout/components/payment/index.tsx` (montar el
  elemento), `payment-card-button/index.tsx` y `payment-button/index.tsx` (saltarse el
  gating de `cardComplete` y de `payment_method_id`, que asumen tarjeta), reusando
  `usePlaceOrder()`.
  **Se commitea en la base**, no en el repo del cliente: lo heredan todos los clones.

  **Estimación (primera vez, en la base):** ~9-12 h — código 4-5 h, verificación de
  dominio 0,5 h, pruebas en dispositivo real 3-4 h, margen de incidencias 1-3 h.
  Con asistencia de Claude baja a ~6-7 h: el código se encoge, las pruebas no.
  **Facturar 9-12 h**, no 6: el riesgo de que Apple Pay dé guerra lo asume el dev.

  **Coste por cliente, una vez hecho en la base: ~1-1,5 h.** Toggle en su dashboard de
  Stripe (5 min) + verificar su dominio para Apple Pay (20 min) + compra real de prueba en
  iPhone y Chrome (30-45 min). Esa hora no se puede bajar: depende de la cuenta de Stripe
  y del dominio de cada cliente, no del código.

  **Requisito bloqueante para Apple Pay:** dominio verificado sobre HTTPS (fichero en
  `/.well-known/`, Stripe lo automatiza). **No se puede probar en localhost** — no empezar
  hasta tener el staging desplegado (ver "Pendiente no bloqueante"). Google Pay sí se prueba en Chrome sin
  nada extra.

  **Opción B (descartada por ahora) — migrar entero a `<PaymentElement>`:** 2-3 días.
  Elimina las rutas custom `medusa/src/api/store/custom/stripe/*` y habilita SEPA, Klarna,
  Bancontact, iDEAL, Link y el enrutado Cartes Bancaires con un toggle cada uno.
  **No reduce la hora por cliente de los wallets** — lo que da es que activar SEPA o Klarna
  pase de un día de desarrollo a 5 minutos de toggle.
  **Cuándo hacerla:** cuando un cliente pida SEPA, Klarna o iDEAL. Esas horas son inversión
  en la base, no se le facturan al cliente que solo pidió wallets.

- [ ] **Gestión de contenido editorial (páginas About / Inspiration)** — que el cliente
  edite él mismo esos textos/imágenes desde el admin. Hoy están hardcodeados en
  `storefront/src/app/[countryCode]/(main)/about/page.tsx` e `inspiration/page.tsx`
  (un dev debe editarlos y redesplegar).
  **Enfoque acordado (Opción 2):** módulo de contenido propio en Medusa (entidad tipo
  `page` con campos de texto/imagen) + ruta de admin para editarla — todo dentro de
  Medusa, sin CMS externo. Es **viable**; se construye cuando lo soliciten.
- [ ] **Campo NIF / n.º de TVA en el checkout** — necesario para vender a empresas
- [ ] **Recibo de pago de Stripe al comprador** — hoy no sale. Requiere código: el
  proveedor de Stripe de Medusa filtra los campos del PaymentIntent con una lista blanca
  de 11 y `receipt_email` no está. Habría que parchear el paquete, extender la clase del
  proveedor, o actualizar el PaymentIntent con un subscriber. **No recomendado para el
  starter**: frágil entre versiones de Medusa y la confirmación de Medusa ya cubre la
  función legal y comercial.
- [ ] **Emails de pedido cancelado / reembolsado** — no existen hoy
- [ ] **Suite E2E de Playwright (`storefront/e2e/`)** — **opcional, NO es puerta de
  producción.** Los tests existen y `pg` ya está instalado, así que no estorban ni
  bloquean el build; simplemente no se ejecutan.
  Ponerlos en verde son ~6-12 h porque prueban una tienda que ya no existe: buscan un
  producto "Sweatshirt" y rellenan direcciones de Denver, del seed del starter vanilla.
  Además hay que montar una BD de test aparte (la suite **borra y recrea** la base).
  Después, ~1-3 h por cliente, porque Playwright se agarra a textos y nombres de producto
  y cada tienda los cambia.
  **Cuándo compensa:** cuando lleves varias tiendas y toques el checkout a menudo.
  Mientras tanto lo cubre la compra real de la Fase 7, que son 10 minutos y prueba
  Stripe en modo live.

## Notas de entorno local (esta máquina)

Puertos remapeados por conflicto con otro proyecto (ver `CLAUDE.md`): backend `9002`,
Redis `6380`, MinIO `9090`/`9091`. Arranque: `docker compose up -d` desde `medusa/`,
luego `corepack yarn dev` en `medusa/` y en `storefront/`.

`yarn` no está en el PATH global de esta máquina: usa **`corepack yarn`** en `medusa/`
(Yarn 4). El storefront usa Yarn 1.
