namespace Biodanza.Model
{
    public class ItemData
    {
        public string CdPista { get; set; }
        public string Carpeta { get; set; }
        public string Archivo { get; set; }
        public string Titulo { get; set; }
        public string Interprete { get; set; }
        public string Ejercicio { get; set; }
        public string TipoEjercicio { get; set; }
        public string Lineas { get; set; }
        public string DetalleEjercicio { get; set; }
        public string Grupo { get; set; }


        public int NroCd => string.IsNullOrWhiteSpace(CdPista) || CdPista.Length != 5 ? 0 : int.Parse(CdPista.Substring(0, 2));
        public int NroPista => string.IsNullOrWhiteSpace(CdPista) || CdPista.Length != 5 ? 0 : int.Parse(CdPista.Substring(3, 2));

        public override string ToString()
        {
            return $"Colecion: {Coleccion} ; CdPisto: {CdPista}; Carpeta: {Carpeta}; Titulo: {Titulo}; Interprete: {Interprete}; Ejercicio: {Ejercicio}";
        }

        public string Coleccion { get; set; }
    }
}