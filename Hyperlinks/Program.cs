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
            var bio = new BioCol();
            if (!CommandLine.Parser.Default.ParseArguments(args, bio))
            {
                return;
            }
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
