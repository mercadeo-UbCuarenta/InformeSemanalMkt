"""Genera el informe publicable a partir de la plantilla nueva y el paquete de datos de la semana.
Uso (desde la raíz del repo):  python nuevo-informe/build.py 10.4
Escribe index.html e informe-semanal.html en la raíz. Las fotos se leen de evidencias/<semana>/ por ruta relativa."""
import sys, os, json
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sem = sys.argv[1] if len(sys.argv) > 1 else '10.4'
U = dict(encoding='utf-8')
tpl = open('nuevo-informe/informe_template.html', **U).read()
datos = open(f'nuevo-informe/datos_{sem}.json', **U).read()
pkg = json.loads(datos)
assert '__DATA__' in tpl, 'La plantilla no tiene el marcador __DATA__'
faltan = [f"evidencias/{w}/{f['f']}" for w, l in pkg['fotos'].items() for f in l if not os.path.exists(f"evidencias/{w}/{f['f']}")]
html = tpl.replace('__DATA__', datos)
for out in ('index.html', 'informe-semanal.html'):
    open(out, 'w', **U).write(html)
print('OK', sem, len(html), 'bytes |', len(pkg['base']['semanas']), 'semanas | fotos faltantes:', len(faltan))
for f in faltan[:20]: print('  falta', f)
