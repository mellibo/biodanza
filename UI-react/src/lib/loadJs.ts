// Puerto de loadJsService.js -- inyecta un <script src="..."> clásico para
// chequear si un archivo existe en una ruta relativa. Bajo file://,
// fetch()/XHR fallan por CORS, pero cargar un <script> no está sujeto a esa
// restricción, así que esto funciona igual que en la app AngularJS
// (se usa como chequeo de existencia, no para ejecutar el contenido --
// en cargarMusicaController.js:90 se usa contra un .xlsx, que ni siquiera
// es JS válido, pero el evento onerror solo dispara ante una falla real de
// red/archivo-no-encontrado, no por el tipo de contenido).
export function checkFileExists(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = (error) => reject(error)
    document.head.appendChild(script)
  })
}
