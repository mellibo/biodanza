using System.Collections.Generic;

namespace Biodanza.Model
{
    public class ResultadoOperacion
    {
        public bool Ok { get; set; }
        public string Mensaje { get; set; }

        public ResultadoOperacion()
        {
            Ok = true;
        }

        public static ResultadoOperacion Fail(string msg)
        {
            return new ResultadoOperacion { Ok = false, Mensaje = msg };
        }
        public static ResultadoOperacionEntidad<T> EntidadOk<T>(T entidad, string msg = "")
        {
            return new ResultadoOperacionEntidad<T> { Ok = true, Mensaje = msg, Entidad = entidad };
        }
        public static ResultadoOperacionLista<T> ListaOk<T>(IEnumerable<T> lista, string msg = "")
        {
            return new ResultadoOperacionLista<T>() { Ok = true, Mensaje = msg, Lista = lista };
        }
    }

    public class ResultadoOperacionEntidad<T> : ResultadoOperacion
    {
        public T Entidad { get; set; }
    }
    public class ResultadoOperacionLista<T> : ResultadoOperacion
    {
        public IEnumerable<T> Lista { get; set; }
        public static ResultadoOperacionLista<T1> Fail<T1>(string msg)
        {
            return new ResultadoOperacionLista<T1>() { Ok = false, Mensaje = msg };
        }
    }
}