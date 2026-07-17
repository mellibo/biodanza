// Una sola implementación de la normalización de texto que en la app
// AngularJS estaba repetida (con ligeras diferencias) en loaderService.js,
// services.js y main.js. Mismo algoritmo: mayúsculas, NFD, quitar diacríticos.
const COMBINING_MARKS = /[̀-ͯ]/g

export function normalize(text: string): string {
  return text.toUpperCase().normalize('NFD').replace(COMBINING_MARKS, '')
}

// Puerto de toValidJsVariableName (UI/app/scripts/main.js:121-124) -- genera
// el mismo slug de id que usa la app actual, para que ids calculados acá
// coincidan con los de datos ya guardados en localStorage por la app vieja.
export function toValidJsVariableName(nombre: string): string {
  return nombre
    .toLowerCase()
    .replace(/ | /g, '_')
    .replace(/"|'|,|\(|\)|“|”|-|:|\?|\/|~|\./g, '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .trim()
}

export function getEjercicioId(nombre: string): string {
  return toValidJsVariableName(nombre)
}

export function getMusicaId(coleccion: string, nroCd: string, nroPista: string): string {
  return 'x' + coleccion + '_' + nroCd + '_' + nroPista
}
