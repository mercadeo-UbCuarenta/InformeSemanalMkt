# Informe Semanal de Marketing · UB Cuarenta — guía para Codex (rediseño, desde la semana 10.4)

Esta guía **reemplaza** la de `C:\Users\UB40\Documents\Informe Semanal\nuevo-informe\AGENTS.md` (diseño anterior). Trabaja **solo** en este repositorio, rama `rediseno-fury`.

## Reparto del trabajo
- **Claude (Fury)** arma cada lunes el paquete de datos `nuevo-informe/datos_<semana>.json` y las fotos en `evidencias/<semana>/`, y lo sube a la rama `rediseno-fury`.
- **Codex** monta el informe con la plantilla nueva, lo revisa y lo publica **solo cuando Sebastián lo apruebe**.
- No cambies cifras ni textos de los datos. Si algo no cuadra, avísale a Sebastián; no lo "corrijas".

## Archivos
| Archivo | Qué es |
|---|---|
| `nuevo-informe/informe_template.html` | Plantilla maestra del rediseño (HTML+CSS+JS). Los datos entran en `__DATA__`. Cambios de diseño solo aquí. |
| `nuevo-informe/datos_<semana>.json` | Paquete de datos (base, asana, fotos, soporte, campanas, crm, crmCampaigns, budget, viejo, logos). Lo genera Claude. |
| `nuevo-informe/build.py` | Inyecta el paquete en la plantilla y escribe `index.html` e `informe-semanal.html` en la raíz. |
| `evidencias/<semana>/` | Fotos de la semana (rutas relativas). |
| `nuevo-informe/REDISENO.md` | Decisiones del rediseño. |

## Cómo montar la semana
```bash
git fetch origin && git checkout rediseno-fury && git pull
py nuevo-informe/build.py 10.4        # o python3
```
Debe terminar en `fotos faltantes: 0`.

## Reglas del rediseño (no cambiar sin que Sebastián lo pida)
1. **Todas:** panel general igual que antes (Performance).
2. **Cada marca abre en Ejecución.** Pestañas: Ejecución · Performance · CRM · Presupuesto · Análisis.
3. **Ejecución por pilares:** Atracción (Vitrinas, BTL, Activaciones, Eventos, Espacios Gratis CC, Redes Sociales, Pauta Digital) · Conversión (Punto de Pago, POP, Ecommerce, Catálogo, Endomarketing) · Fidelización (CRM, Automatizadas).
4. Fotos en **carrusel con flechas**, cada una con el nombre de la tienda. Acciones sin foto: solo nombre, categoría y fechas (sin "falta soporte").
5. Secciones **"Campañas activas en la semana"** y **"La próxima semana"**.
6. **CRM en 4 preguntas**; el detalle queda en un desplegable.
7. **Redacción para Gerencia:** ningún texto visible menciona herramientas ni procesos internos (Asana, Woowup, Looker, Mahalo, HIOPOS, Shopify, Excel, "tarea", "segmento #", "LY"). Se dice "año anterior", "corte anterior", etc.
8. El informe **no abre pestañas nuevas** ni tiene enlaces externos.
9. **Semana 10.2 se deja tal como está.**

## Reglas de datos (las aplica Claude; tú solo verifica)
- Semana retail lunes–domingo; pertenece al mes de su jueves. Comparativo: misma semana retail del año anterior.
- Venta: Mahalo (Levi's, Wiseman, canal digital) y HIOPOS (Desigual). Desigual Acqua excluida.
- Tráfico: exterior, interno y captura de tiendas. Canal digital: sesiones de la tienda online.
- Meta y año anterior: SEGUIMIENTO PV de cada mes.
- Nunca subir a Git exports con datos de clientes, tokens ni contraseñas.

## Checklist antes de pedir aprobación
- [ ] `build.py` sin errores y `fotos faltantes: 0`.
- [ ] Abrir `index.html` (servir con `py -m http.server 8765`) sin errores de consola en Todas y en cada marca. Solo se acepta el error de miniaturas de semanas viejas sin internet.
- [ ] Cada marca abre en Ejecución; carrusel funciona; campañas activas y próxima semana se ven.
- [ ] Ancho de celular (~390 px) sin scroll horizontal.
- [ ] Buscar en el HTML visible: ningún nombre de herramienta interna.
- [ ] Ningún `target="_blank"`.

## Publicar (solo con aprobación expresa de Sebastián)
`main` es lo que ve Gerencia (GitHub Pages). Con su OK:
```bash
git add index.html informe-semanal.html evidencias/<semana> nuevo-informe/
git commit -m "Publicar informe semana <semana> (rediseño)"
git checkout main && git merge --no-ff rediseno-fury && git push origin main
```
Luego comprobar la página pública; el push no equivale a despliegue validado.
