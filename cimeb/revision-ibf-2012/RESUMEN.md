# Revisión: catálogo CIMEB IBF 2012 (PDF Ezequiel, junio 2025) vs. lo cargado en la app

Se compara el PDF contra los ejercicios IBF del catálogo base
(`UI-react/src/data/ejercicios.generated.ts`) y contra el Excel de la colección
IBF (`UI/musica/IBF/IBF.xlsx`), que es de donde salen las músicas de cada
ejercicio. Se regenera con:

```
python scripts/importar-cimeb-2012.py <pdf> cimeb/cimeb2012.json
cd scripts && node revisar-cimeb-2012.cjs ../cimeb/cimeb2012.json ../cimeb/revision-ibf-2012
```

## Ejercicios

- El PDF tiene **232 ejercicios** y la app tiene **232 ejercicios IBF**: están **todos cargados**
  (`ejercicios-sin-cargar.csv` vacío).
- **6 se llaman distinto** (`ejercicios-nombre-distinto.csv`), ej. el PDF dice
  "RONDA DE INICIACIÓN (o RONDA DE INTEGRACIÓN INICIAL)" y la app "RONDA INICIO/INTEGRACIÓN";
  "DANZA PULSANTE DE CORAZÓN A CORAZÓN" en el PDF vs. "DANZA DE TRANSPORTE DE CORAZÓN A CORAZÓN".
- **Detalle (consigna/descripción):** ninguno vacío ni distinto en lo sustancial.
- **Grupo:** 39 ejercicios están en otro grupo (`ejercicios-datos.csv`): el PDF los
  pone en "LOS JUEGOS" y la app en "DANZAS VARIAS" (el PDF no tiene el grupo "DANZAS VARIAS").
  Es una diferencia de clasificación, no un error de carga.

## Músicas

El PDF referencia 415 músicas distintas (CD 01 a 21); el Excel de IBF tiene 387 (CD 01 a 20).

| Diferencia | Cantidad | Detalle |
|---|---|---|
| Vínculo ejercicio-música del PDF que falta en la app | 119 | `musicas-vinculos.csv` |
| ...de esos, la música existe en el Excel pero no está asociada al ejercicio | 64 | ej. "RONDA DE ACTIVACIÓN": el PDF trae 60 músicas y la app solo 8 |
| ...de esos, la clave CD-pista no existe en el Excel | 55 | 42 son del **CD 21** (no está en la colección) y 13 son pistas nuevas de otros CDs (01:20, 03:18-19, 04:19-21, 05:22-23, 17:16, 19:18-19, etc.) |
| Vínculo de la app que no está en el PDF | 14 | ej. "DANZAR PARA EL OTRO", "MOVIMIENTO SEGMENTARIO DE CUELLO DE A DOS" |
| Misma clave, canción distinta entre PDF y Excel | 58 | `musicas-titulo-distinto.csv` |

Sobre las **claves con canción distinta**: 30 son de los CD **19 y 20**. En el
Excel/disco esos son los "IBF19 Complementario 1" e "IBF20 Complementario II"
(ej. 20-01 = "When you smile"), mientras que en el PDF 20-01 = "Ay Fond Kiss"
(que en el disco está como IBF19-01): la numeración de los complementarios del
PDF no coincide con la del disco. El resto son sobre todo CD 05 (el PDF
tiene 23 pistas y el disco 21, hay un corrimiento desde 05:11), y varios
títulos que solo están traducidos/abreviados distinto ("Aleluya" vs.
"Hallelujah"), que no son errores.

**Conclusión:** los ejercicios y su texto están completos; lo que **no** está bien es el
vínculo con las músicas: faltan ~119 vínculos, hay 14 de más, y para los CD 05, 19, 20
(y 21, que no existe) la clave del PDF no apunta a la misma canción que la del disco,
así que **no conviene importar los vínculos del PDF tal cual**: habría que mapear esos
CD por título/intérprete.

## Vínculos que faltan: cómo se agregan

`scripts/mapear-vinculos-cimeb-2012.cjs` lleva cada música del PDF a la clave que
tiene en el disco (por título/intérprete cuando la clave del PDF no coincide: los
CD 20 y 21 del PDF son los 19 y 20 del disco, y el CD 05 está corrido desde la
pista 11) y arma `cimeb/vinculos-ibf-2012.json` con **95 vínculos en 30 ejercicios**.

Para aplicarlos: con la colección IBF cargada, en **Cargar Ejercicios** usar
**Importar CIMEB (JSON)** y elegir `cimeb/vinculos-ibf-2012.json`. Solo agrega
vínculos (los ejercicios ya existen; no modifica su texto, grupo ni origen).

Quedan **120 apariciones (54 músicas distintas) sin ubicar**, porque no existen en el
disco (CD 19 y 21 del PDF, pistas nuevas) o la clave del disco es otra canción:
`vinculos-sin-ubicar.csv`. Esas hay que cargarlas primero como música.
