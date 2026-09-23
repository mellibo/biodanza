#!/usr/bin/env python
"""Extrae del PDF "CIMEB catálogo IBF 2012 (Editado Hipervínculos)" cada
ejercicio con su grupo, texto (consigna, objetivo, etc.) y músicas asociadas
(clave CD-pista, título, artista, duración, comentario), y lo escribe como
JSON con la misma forma que importar-cimeb-2018.cjs (ver DatosCimeb en
UI-react/src/types.ts), más "clave" y "comentario" por música.

No se usa pdftotext porque en este PDF (editado para agregar hipervínculos)
pierde/estropea el ÚLTIMO carácter de cada fragmento de texto -- ej. la
clave "01-04" sale "01-0√". PyMuPDF (get_texttrace) devuelve ese último
carácter como fragmento aparte y correcto, por eso se reconstruyen los
renglones a partir de los fragmentos.

Uso: python importar-cimeb-2012.py <archivo.pdf> [salida.json]
Requiere: pip install pymupdf
"""
import json
import re
import sys

import pymupdf

INICIO_CUERPO = 'Todas las Rondas de Biodanza'  # primera página con contenido (antes está el índice)
FIN_CUERPO = "SEGUNDA PARTE"  # las páginas siguientes son anexos


def celdas(page):
    spans = []
    for s in page.get_texttrace():
        t = ''.join(chr(c[0]) for c in s['chars'])
        if not t.strip():
            continue
        x0, y0, x1, y1 = s['bbox']
        spans.append(dict(t=t, x0=x0, x1=x1, y=y1, font=s['font'], size=s['size'], color=s['color']))
    spans.sort(key=lambda s: s['y'])
    grupos = []
    for s in spans:
        if grupos and abs(grupos[-1][-1]['y'] - s['y']) < 2.5:
            grupos[-1].append(s)
        else:
            grupos.append([s])
    lineas = []
    for g in grupos:
        g.sort(key=lambda s: s['x0'])
        cs = []
        for s in g:
            c = cs[-1] if cs else None
            if c and s['x0'] - c['x1'] < 2.0 and abs(s['size'] - c['size']) < .1:
                c['t'] += s['t']
                c['x1'] = s['x1']
            else:
                cs.append(dict(s))
        lineas.append(dict(y=g[0]['y'], celdas=cs))
    return lineas


def blanco(c):
    return all(v > .9 for v in c['color'])


def parsear(pdf):
    doc = pymupdf.open(pdf)
    grupo = ''
    ejercicios = []
    ej = None
    seccion = None
    musica = None
    empezo = False
    for pn in range(len(doc)):
        page = doc[pn]
        if not empezo:
            empezo = INICIO_CUERPO in page.get_text()
            if not empezo:
                continue
        if FIN_CUERPO in page.get_text()[:40]:
            break
        for l in celdas(page):
            if l['y'] > 795 or l['y'] < 34:
                continue  # pie de página / "Click para Ir al Indice"
            c0 = l['celdas'][0]
            texto = ' '.join(c['t'].strip() for c in l['celdas'])
            bold = 'Bold' in c0['font']
            if c0['size'] >= 10.9 and bold and c0['x0'] < 55 and 'Italic' not in c0['font']:
                if blanco(c0):
                    grupo = re.sub(r'\s+', ' ', c0['t']).strip()
                else:
                    ej = {'nombre': texto.strip(), 'grupo': grupo, 'secciones': {}, 'musicas': []}
                    ejercicios.append(ej)
                    seccion = None
                    musica = None
                continue
            if ej is None:
                continue
            if 'BoldItalic' in c0['font'] and c0['size'] >= 10.9:
                seccion = re.sub(r'\s*:\s*$', '', c0['t']).strip()
                musica = None
                if seccion != 'Música':
                    ej['secciones'].setdefault(seccion, [])
                continue
            # fila de música: clave "01-04" + título en negrita + artista + duración
            if re.fullmatch(r'\d{2}-\d{2}', c0['t'].strip()) and len(l['celdas']) >= 2:
                cd, pista = map(int, c0['t'].strip().split('-'))
                musica = {
                    'clave': c0['t'].strip(),
                    'titulo': l['celdas'][1]['t'].strip(),
                    'artista': l['celdas'][2]['t'].strip() if len(l['celdas']) > 2 else '',
                    'duracion': l['celdas'][3]['t'].strip() if len(l['celdas']) > 3 else '',
                    'comentario': '',
                    'referencias': [{'coleccion': 'IBF', 'cd': cd, 'pista': pista}],
                }
                ej['musicas'].append(musica)
                continue
            if musica is not None and len(l['celdas']) == 1 and c0['x0'] > 80 and 'Bold' in c0['font'] and c0['x0'] < 95:
                musica['titulo'] += ' ' + c0['t'].strip()  # título en varios renglones
                continue
            if musica is not None and 'Italic' in c0['font'] and c0['size'] < 9.5 and c0['x0'] > 80:
                musica['comentario'] = (musica['comentario'] + ' ' + texto).strip()
                continue
            if seccion is None:
                seccion = 'Descripción'
                ej['secciones'].setdefault(seccion, [])
            if seccion != 'Música':
                ej['secciones'].setdefault(seccion, []).append(texto)
    salida = []
    for e in ejercicios:
        partes = [(k, ' '.join(v).strip()) for k, v in e['secciones'].items() if ' '.join(v).strip()]
        detalle = '<br/>'.join((k + ': ' if k != 'Descripción' else '') + v for k, v in partes)
        salida.append({'nombre': e['nombre'], 'grupo': e['grupo'], 'detalle': detalle, 'musicas': e['musicas']})
    return salida


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    ejercicios = parsear(sys.argv[1])
    destino = sys.argv[2] if len(sys.argv) > 2 else 'cimeb2012.json'
    with open(destino, 'w', encoding='utf-8') as f:
        json.dump({'fuente': 'CIMEB 2012', 'ejercicios': ejercicios}, f, ensure_ascii=False, indent=2)
    print('Ejercicios: %d, músicas: %d' % (len(ejercicios), sum(len(e['musicas']) for e in ejercicios)))
