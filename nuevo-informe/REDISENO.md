
## Cambio de dueño y rediseño (24 oct 2026)
- **Fury administra el informe** (antes Codex en el PC). Se construye en la nube y se publica en el repo GitHub `mercadeo-UbCuarenta/InformeSemanalMkt` (GitHub Pages, mismo enlace para Gerencia). Flujo: Fury arma el borrador → Sebastián lo revisa con Fury → solo con su aprobación se publica.
- **Plazo:** el informe se envía a Gerencia todos los lunes antes de las 5 p. m.; si el lunes es festivo en Colombia, el martes antes de las 5 p. m.
- **Pedido de Gerencia:** más protagonismo a la ejecución de marketing que al performance.
  - Panel general (Todas): se deja igual.
  - Panel de cada marca: arranca en **Ejecución** (pestañas: Ejecución · Performance · CRM · Presupuesto · Análisis; al elegir una marca abre en Ejecución).
  - Ejecución por **pilares**: Atracción (Vitrinas, BTL, Activaciones, Eventos, Espacios Gratis CC, Redes Sociales, Pauta Digital), Conversión (Punto de Pago, POP, Ecommerce, Catálogo, Endomarketing), Fidelización (CRM, Automatizadas + tabla de envíos CRM). Tarjeta por acción con foto de portada, categoría, campaña, fechas y estado (con registro fotográfico / falta soporte / ejecutada / en curso); clic abre la galería. Acciones sin fotos en lista compacta. Acciones de ≤4 días muestran venta de la marca esos días vs. mismos días de la semana anterior (y captura de tráfico en Atracción).
  - **CRM en 4 preguntas** con cifra, variación y frase de lectura: ¿Crece la base de clientes? (total RFM vs. foto anterior) · ¿Quién nos está comprando? (% venta de recurrentes + recuperados, nuevos) · ¿Se nos están yendo clientes buenos? (en riesgo + a punto de inactivarse + no podemos perderlos) · ¿Qué enviamos y cuánto vendió? (campañas, enviados, venta atribuida). El detalle anterior queda en un desplegable.
- Borrador del rediseño (datos 10.3): artifact "Informe Semanal (borrador)" https://claude.ai/artifact/GneM4X8bQwVSWajNud8JqF. Plantilla nueva extraída del index.html publicado (const PKG=<datos> + código).
- Pendientes de la migración: acceso de escritura de Claude al repo de GitHub; traer del PC los scripts y fuentes (`nuevo-informe/`) o rehacerlos en la nube; exports de Mahalo ahora en Drive → Mahalo (exports) → Ventas.

### Ajustes del 24 oct (segunda revisión)
- Fotos: carrusel con flechas en cada tarjeta (ya no se amplían). Cada foto lleva el nombre de la tienda, sacado del nombre del adjunto en Asana (ej. "LEVIS FONTANR.jpeg" → Fontanar), comparando contra los nombres de tienda (todas las palabras del nombre; "22A"/"16A" → Providencia).
- Acciones sin registro fotográfico: solo nombre, categoría y fechas de ejecución (sin "falta soporte" ni estado).
- Nueva sección "Campañas activas en la semana": subtareas de la tarea de temporada de cada marca en Asana (Levi's Línea 1216302546050167, Outlet 1216356438988514, Desigual 1216302443509084, Wiseman 1216424390277826) con fechas que tocan la semana; muestra el detalle de la descripción de la tarea (sin líneas de Fuente, Tablero ni "Creada por Claude"). Marca "Nueva esta semana" / "Termina <fecha>".
- Nueva sección "La próxima semana": campañas y acciones de Asana con fechas en la semana siguiente; separa las que arrancan de las que continúan.
- Datos nuevos del paquete: `campanas` [{u,n,a,b,notas}] y `fotos[].tienda`.

### Regla de redacción (24 oct)
- Los textos que ve Gerencia no mencionan herramientas ni procesos internos (Asana, Woowup, Looker, Mahalo, Shopify, Excel, "tarea", "segmento #", "LY"). Se describe qué muestra cada módulo en lenguaje de negocio ("Promociones y dinámicas comerciales vigentes en las tiendas", "año anterior", "corte anterior").
- Plantilla maestra del rediseño: template_v2 (scratchpad de la sesión; se subirá al repo como `nuevo-informe/informe_template.html`).
- Acceso de escritura de Claude al repo GitHub mercadeo-UbCuarenta/InformeSemanalMkt: habilitado el 24 oct.
