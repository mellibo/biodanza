using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Biodanza.Model;

namespace Hyperlinks
{
    class Program
    {
        static void Main(string[] args)
        {
            var parametros = new Parametros();
            if (!CommandLine.Parser.Default.ParseArguments(args, parametros))
            {
                Console.WriteLine(parametros.GetUsage());
//                return;
            }
            var bio = new BioCol()
            {
                Action = parametros.Action,
                ColumnCdPista = parametros.ColumnCdPista,
                ColumnTitulo = parametros.ColumnTitulo,
                Excel = parametros.Excel,
                Hoja = parametros.Hoja,
                PathColeccion = parametros.PathColeccion
            };

            if (string.IsNullOrEmpty(bio.PathColeccion)) bio.PathColeccion = Directory.GetCurrentDirectory();
            if (string.IsNullOrEmpty(bio.Excel))
            {
                var xls = Directory.GetFiles(bio.PathColeccion, "*.xls?").FirstOrDefault();
                if (string.IsNullOrEmpty(xls))
                {
                    Console.WriteLine("excel no encontrado");
                    return;
                }
                bio.Excel = xls;
            }
            Console.WriteLine("procesando archivo {0}", Path.Combine(bio.PathColeccion, bio.Excel));
            if (string.IsNullOrEmpty(bio.Action)) bio.Action = "h";
            switch (bio.Action)
            {
                case "h":
                    bio.HyperLinks();
                    break;
                case "x":
                    bio.CleanHyperLinks(bio.ColumnTitulo);
                    break;
            }

        }
    }
}
