# Configuración de la tienda en el admin (Medusa 2.19)

Cómo dejar una tienda lista para vender **desde cero**, rellenando los campos del panel.
Esto va **después** de `CLIENT_SETUP.md` (código y variables) y es independiente del deploy.

> **Por qué existe este documento.** Ni el código ni las variables de entorno hacen que una
> tienda pueda cobrar. Hay una capa de configuración —impuestos, stock, envíos, canales—
> que solo vive en la base de datos y que se rellena a mano en el panel. Si falta cualquier
> pieza, el checkout se rompe **sin ningún mensaje de error útil**: unas veces devuelve un
> 500, otras simplemente no aparecen métodos de envío.
>
> Las trampas de la sección final no salen de la documentación de Medusa: salieron de
> intentar completar un pedido real y chocar contra ellas.

**El panel está en francés**, así que las etiquetas van en francés tal cual aparecen en
pantalla, sacadas del fichero de traducción de Medusa. La explicación va en castellano.

---

## Ficha de la comerciante

Todo el documento se apoya en este perfil. Si cambia algo de aquí, revisa las secciones
marcadas con ⚠️.

| Dato | Valor |
|---|---|
| Actividad | Creación artesanal: **bijoux en bois** y **lampes en bois** |
| Taller | **Dijon** (Côte-d'Or, Bourgogne) |
| Clientela | Mayoritariamente **local, en Dijon** |
| Régimen de IVA | **Franchise en base de TVA** — no cobra IVA todavía |
| Envíos | **Manuales**: los prepara y despacha ella |
| Transportista | **Sin decidir** (Colissimo, Mondial Relay…) |
| Colecciones | **Sin definir** todavía |
| Zona de venta | **Solo Francia** al lanzar |

### Dos consecuencias de este perfil

**1. No cobra IVA → las tasas van al 0 %, pero la región fiscal SIGUE siendo obligatoria.**
Son dos cosas distintas y se confunden: el *tipo* es 0 %, pero la *región fiscal* tiene que
existir y tener proveedor. Sin ella el checkout devuelve un 500.
En sus facturas debe aparecer: **«TVA non applicable, article 293 B du CGI»**.

**2. Envío manual → ella decide el precio, no se calcula solo.**
Verificado en el código del proveedor manual de Medusa: `canCalculate()` devuelve `false`.
No existe cálculo automático de portes. En el formulario, `Type de prix` **solo puede ser
`Fixe`**, y el importe lo pone ella.

> Esto responde a la duda de si hay que calcular el envío: **no**. Ella fija una tarifa
> plana por tipo de producto. Y no hace falta decidir el transportista para configurar la
> tienda — solo el precio que va a cobrar.

---

## Orden de ejecución

El orden **no es opcional**: cada bloque necesita que exista el anterior. Si creas el
producto antes que el perfil de envío, no podrás asignárselo y tendrás que volver atrás.

```
1. Región de venta        →  define moneda y país
2. Región fiscal          →  necesita el país del paso 1
3. Canal de venta         →  suele venir creado
4. Emplacement (Dijon)    →  necesita el canal del paso 3
5. Fournisseur de livraison  →  se activa DENTRO del emplacement
6. Zona de servicio       →  necesita el emplacement
7. Perfiles de envío      →  independiente, pero antes que las opciones
8. Opciones de envío      →  necesitan 5, 6 y 7
9. Productos              →  necesitan 7 y 3
10. Inventario            →  necesita 9 y 4
```

---

## 1. Región de venta — `Paramètres → Régions`

| Campo | Valor |
|---|---|
| Nom | `France` |
| Devise | `EUR` |
| Pays | **solo** `France` |
| Fournisseurs de paiement | `Stripe` ✅ |
| Taxes automatiques | activado |

⚠️ **Solo Francia al lanzar.** Vender a otro país de la UE convierte la factura en
obligatoria (venta a distancia intracomunitaria) y, pasando de 10.000 €/año de ventas B2C
intra-UE, obliga a IVA de destino y registro OSS. Añadir países después son dos clics.

---

## 2. Región fiscal — `Paramètres → Régions fiscales` ⚠️ **la que rompe el checkout**

| Campo | Valor |
|---|---|
| Pays | `France` |
| **Fournisseur de taxes** | **`System`** ← obligatorio |
| Taux par défaut | `0` |
| Nom du taux | `TVA non applicable — art. 293 B du CGI` |

> **La trampa número uno.** Una región fiscal sin proveedor hace que guardar la dirección
> de envío devuelva **HTTP 500**. El comprador no pasa del primer paso del checkout.
>
> El formulario de creación **exige** el proveedor, así que si la creas tú desde el panel
> no puedes equivocarte. El problema aparece con las regiones que deja el **seed de demo**,
> que se crean sin proveedor saltándose esa validación. Si partes de una base con datos de
> demo: **borra esas regiones y créalas de nuevo** desde el panel.

Cuando empiece a cobrar IVA, aquí es donde se cambia el 0 por el 20 — sin tocar código.

---

## 3. Canal de venta — `Paramètres → Canaux de vente`

Normalmente ya existe `Default Sales Channel`. Si creas uno nuevo:

| Campo | Valor |
|---|---|
| Nom | `Boutique en ligne` |
| Description | `Vente en ligne — livraison France et retrait à Dijon` |

Anota cuál usas: **el mismo** tiene que aparecer en el emplacement, en los productos y en
la publishable key. Si los tres no coinciden, la tienda sale vacía.

---

## 4. Emplacement de stock — `Paramètres → Emplacements et livraison`

| Campo | Valor |
|---|---|
| Nom | `Atelier Dijon` |
| Adresse | *(la dirección real del taller)* |
| Ville | `Dijon` |
| Code postal | `21000` |
| Pays | `France` |
| **Canaux de vente connectés** | el del paso 3 ✅ |

⚠️ Sin conectar el canal de venta, el stock **no es vendible**: los productos salen
agotados aunque tengan unidades.

---

## 5. Fournisseur de livraison ⚠️ **cambió de sitio en Medusa 2.19**

En la página del emplacement, tarjeta **`Fournisseurs de livraison connectés`** →
botón **`Connecter les fournisseurs`** → marcar:

> ☑️ **Manual Fulfillment**  *(id interno: `manual_manual`)*

**Esto ya no se elige dentro del formulario de la opción de envío.** Ahora se activa por
emplacement, en una tarjeta aparte. Si te lo saltas, el desplegable
`Fournisseur de livraison` del paso 8 sale **vacío** y no puedes guardar la opción.

`Manual Fulfillment` es el correcto para ella: significa que prepara y despacha a mano, sin
integración con transportista. Es también el motivo de que el precio sea fijo.

---

## 6. Zona de servicio — dentro del emplacement

Sección **`Livraison`** → crear el conjunto y su zona:

| Campo | Valor |
|---|---|
| Fulfillment set | `Livraison depuis Dijon` |
| Zone de service | `France métropolitaine` |
| Pays de la zone | `France` |

⚠️ Si la zona se queda sin países, no habrá métodos de envío para ninguna dirección.

Si ofrece recogida, crea **un segundo conjunto de tipo `Retrait`** con su propia zona
(`Retrait Dijon`, país `France`).

---

## 7. Perfiles de envío — `Configuration de la livraison → Profils de livraison`

Un perfil agrupa productos que se envían igual. La etiqueta del panel lo dice bien:
*«Grouper les produits par besoins de livraison»*.

**Aquí hay una decisión real que tomar**, porque sus dos familias de producto no pesan igual:

| Producto | Peso / volumen | Coste de envío |
|---|---|---|
| Bijoux en bois | ~50–250 g, sobre acolchado | Barato |
| Lampes en bois | 1–5 kg, caja voluminosa | Bastante más caro |

**Opción A — un solo perfil** (más simple)
Un perfil `Standard` y una tarifa única. Solo compensa si cobra un precio intermedio y
asume perder algo en las lámparas.

**Opción B — dos perfiles** ✅ *recomendado para ella*

| Perfil | Productos |
|---|---|
| `Bijoux` | Joyería |
| `Luminaires` | Lámparas |

Cada perfil lleva sus propias opciones de envío con su propio precio. Es exactamente para
lo que existen los perfiles, y evita que un colgante pague el porte de una lámpara.

> ⚠️ Si arrastras datos de demo, cuidado: suele haber dos perfiles con nombres casi
> idénticos (`Default` y `Default Shipping Profile`) y solo uno tiene opciones colgando.
> Empezando de cero no tienes este problema.

---

## 8. Opciones de envío — dentro de cada zona de servicio

Pantalla: **`Créer une option de livraison pour {zona}`**.

⚠️ Asegúrate de estar en la pestaña **`Options de livraison`** y no en
**`Options de retour`** — la segunda es para devoluciones y no sirve para vender.

### Los campos, y cuáles se eligen vs cuáles se escriben

| Campo | Tipo | Qué poner |
|---|---|---|
| `Nom` | escribes | Nombre que ve el comprador |
| `Profil de livraison` | **eliges** | El del paso 7 |
| `Fournisseur de livraison` | **eliges** | `Manual Fulfillment` |
| `Type de prix` | eliges | **`Fixe`** (el único válido con envío manual) |
| Prix EUR | escribes | Lo decide ella |
| `Activer en magasin` | ✅ | Si no, no aparece en la tienda |
| **Type · Étiquette** | escribes | Texto libre |
| **Type · Description** | escribes | Texto libre |
| **Type · Code** | escribes | Minúsculas, sin espacios ni acentos |

> **`Shipping option type` no se crea en otro sitio.** Son tres campos de texto libre en la
> misma pantalla — solo describen el envío al comprador. Es el punto donde más se atasca la
> gente al venir de la versión anterior.

### Las cuatro opciones a crear

**Perfil `Bijoux`, zona `France métropolitaine`**

| Campo | Valor |
|---|---|
| Nom | `Livraison suivie — bijoux` |
| Type · Étiquette | `Standard` |
| Type · Description | `Expédition sous 2 à 3 jours ouvrés.` |
| Type · Code | `bijoux-standard` |
| Type de prix | `Fixe` |
| Prix | **~5,50 €** *(orientativo — lo fija ella)* |

**Perfil `Luminaires`, zona `France métropolitaine`**

| Campo | Valor |
|---|---|
| Nom | `Livraison suivie — luminaires` |
| Type · Étiquette | `Colis volumineux` |
| Type · Description | `Expédition sous 3 à 5 jours ouvrés, emballage renforcé.` |
| Type · Code | `luminaires-standard` |
| Type de prix | `Fixe` |
| Prix | **~12,00 €** *(orientativo — lo fija ella)* |

**Recogida en el taller — una por perfil**, zona `Retrait Dijon`

| Campo | Valor |
|---|---|
| Nom | `Retrait à l'atelier (Dijon)` |
| Type · Étiquette | `Retrait` |
| Type · Description | `Retrait gratuit à l'atelier, sur rendez-vous.` |
| Type · Code | `retrait-dijon` |
| Type de prix | `Fixe` |
| Prix | **0,00 €** |

> 💡 **La recogida merece la pena en su caso.** Su clientela es de Dijon: le ahorra portes
> a ella y al comprador, y le lleva gente al taller. Ojo — hace falta **una opción de
> recogida por cada perfil de envío**, o los productos del perfil que falte no la ofrecerán.

**Los precios son orientativos.** Con envío manual no hay tarifa automática: tiene que mirar
lo que le cuesta de verdad en la oficina de correos o el punto relais y poner ese importe.
Cambiarlo después es un campo.

---

## 9. Productos — `Produits → Créer`

### Estructura sugerida

Sin colecciones definidas todavía, empieza por **tipos de producto**, que son la división
estable de su catálogo. Las colecciones (`Hiver 2026`, `Collection Chêne`…) se añaden luego
sin tocar nada.

| Type de produit | Para |
|---|---|
| `Bijoux` | Colgantes, pendientes, pulseras |
| `Luminaires` | Lámparas de mesa, apliques, suspensiones |

### Campos obligatorios de cada producto

| Campo | Valor |
|---|---|
| Titre | Nombre comercial de la pieza |
| Handle | Se genera solo; en minúsculas y sin acentos |
| Description | Materia, dimensiones, acabado, tiempo de fabricación |
| **Statut** | **`Publié`** ⚠️ en borrador no se vende |
| **Profil de livraison** | `Bijoux` o `Luminaires` ⚠️ **según la familia** |
| **Canaux de vente** | El del paso 3 ⚠️ |
| Type de produit | `Bijoux` / `Luminaires` |
| Matière | `Chêne`, `Noyer`, `Frêne`… |
| Pays d'origine | `France` |
| Poids | En gramos — anótalo aunque el envío sea fijo |

### Dos ejemplos completos

**Pendentif en chêne**

| Campo | Valor |
|---|---|
| Titre | `Pendentif géométrique en chêne` |
| Description | `Pendentif taillé et poncé à la main dans du chêne massif, huilé au naturel. 4 × 3 cm, cordon en coton ciré réglable. Chaque pièce est unique : le veinage varie d'un exemplaire à l'autre.` |
| Type | `Bijoux` · Profil `Bijoux` |
| Poids | `40` g |
| Prix | `38,00 €` |
| SKU | `BIJ-PEN-CHE-01` |

**Lampe à poser en noyer**

| Campo | Valor |
|---|---|
| Titre | `Lampe à poser en noyer` |
| Description | `Lampe à poser en noyer massif, tournée et assemblée à l'atelier. Hauteur 32 cm, abat-jour en lin écru. Câble textile de 1,80 m avec interrupteur, douille E27. Ampoule non fournie.` |
| Type | `Luminaires` · Profil `Luminaires` |
| Poids | `1800` g |
| Dimensions | `32 × 18 × 18` cm |
| Prix | `145,00 €` |
| SKU | `LUM-TAB-NOY-01` |

### Variantes

Para piezas artesanales, la variante suele ser la **esencia de madera** o el **acabado**:

- Opción `Essence` → `Chêne`, `Noyer`, `Frêne`
- Opción `Finition` → `Huilé naturel`, `Teinté foncé`

Si una pieza es única y no tiene variaciones, deja la variante por defecto y ya está. **No
inventes variantes que no existen**: cada una es una línea de inventario que hay que
mantener.

---

## 10. Inventario — `Inventaire`

Para cada SKU: **`Gérer les emplacements`** → `Atelier Dijon` → cantidad real en taller.

| Campo | Valor |
|---|---|
| Gérer l'inventaire | ✅ activado |
| Autoriser les commandes en rupture | ❌ desactivado |
| Quantité | Las unidades que tenga hechas |

⚠️ **Sin cantidad en un emplacement conectado al canal de venta, el producto sale agotado.**
Es el fallo silencioso más frecuente: el producto se ve en la tienda pero no se puede añadir
al carrito.

> Para piezas únicas: cantidad `1`. Cuando se venda, el producto desaparece solo de la
> tienda — que es justo el comportamiento que quiere una artesana.

---

## 11. Publishable key — `Paramètres → Clés API publiables`

Que esté asociada al canal de venta del paso 3, y que su valor esté en
`storefront/.env.local` → `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`.

Si no coinciden, la tienda no muestra ni un producto y **no da ningún error**.

---

## Prueba de compra con Stripe

Con claves `sk_test_` / `pk_test_` **no hay cobro real**.

| Tarjeta | Número | Para qué |
|---|---|---|
| ✅ Aprobada | `4242 4242 4242 4242` | El caso normal, sin 3D Secure |
| 🔐 Con 3DS | `4000 0025 0000 3155` | Abre la ventana de autenticación |
| ❌ Rechazada | `4000 0000 0000 0002` | Tarjeta denegada |
| 💸 Sin fondos | `4000 0000 0000 9995` | Saldo insuficiente |

Para todas: fecha futura (`12 / 34`), CVC de 3 cifras (`123`), código postal `21000`.

Dirección de prueba:

```
Camille Martin
14 rue de la Liberté
21000 Dijon
France
+33 6 12 34 56 78
camille.martin@example.fr
```

---

## Las seis trampas, por orden de dónde te bloquean

Ninguna da un mensaje que explique el problema. Están ordenadas por el punto del recorrido
en el que aparecen:

| # | Si falta | Síntoma |
|---|---|---|
| 1 | Producto en **`Brouillon`** | Ni aparece en la tienda |
| 2 | Producto **sin canal de venta** | Ni aparece en la tienda |
| 3 | Emplacement **sin canal de venta** conectado | Producto agotado |
| 4 | Inventario **sin cantidad** | No se puede añadir al carrito |
| 5 | **Proveedor de taxes** vacío en la región fiscal | **HTTP 500** al guardar la dirección |
| 6 | Producto en un **perfil de envío sin opciones** | Checkout sin métodos de envío |

Las 5 y 6 son las peores: llegas al checkout convencido de que todo está bien.

---

## Verificación final

En este orden. Si falla uno, el problema está en el bloque correspondiente.

- [ ] El producto se ve en la tienda → bloques 3, 9
- [ ] Se puede añadir al carrito → bloque 10
- [ ] La dirección de envío se guarda **sin error 500** → bloque 2
- [ ] Aparecen los métodos de envío con el precio correcto → bloques 5, 6, 7, 8
- [ ] La recogida en Dijon aparece como opción → bloque 8
- [ ] El total muestra **0 € de IVA** → bloque 2
- [ ] El pago con `4242…` se completa → Stripe
- [ ] El pedido aparece en `Commandes` del panel
- [ ] Marcar el pedido como preparado dispara el email «va en camino»

Un pedido completo de principio a fin es la única prueba que vale. Que el panel no dé
errores no significa que se pueda comprar.

---

## Lo que queda por decidir con ella

| Pendiente | Hace falta para | Se puede cambiar después |
|---|---|---|
| Transportista (Colissimo, Mondial Relay…) | Nada — solo el precio | Sí |
| Precio real de los portes | Bloque 8 | Sí, es un campo |
| Nombres de las colecciones | Nada — los tipos bastan | Sí |
| ¿Ofrece recogida en el taller? | Bloques 6 y 8 | Sí |
| Cuándo empieza a cobrar IVA | Bloque 2 | Sí, cambiar 0 → 20 |

Ninguno bloquea el montaje. Se puede dejar la tienda lista y ajustar estos cinco al final.
