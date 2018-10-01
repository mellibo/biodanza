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
        private static int ColumnNameToNumber(string columnName)
        {
            if (string.IsNullOrEmpty(columnName)) throw new ArgumentNullException(nameof(columnName));

            columnName = columnName.ToUpperInvariant();

            int sum = 0;

            for (int i = 0; i < columnName.Length; i++)
            {
                sum *= 26;
                sum += (columnName[i] - 'A' + 1);
            }

            return sum;
        }
        static void Main(string[] args)
        {
            var parametros = new Parametros();
            if (!CommandLine.Parser.Default.ParseArguments(args, parametros))
            {
                return;
            }
            if (!char.IsLetter(parametros.ColumnCdPista))
            {
                Console.WriteLine($"el parametro CdPista tiene un valor incorrecto ({parametros.ColumnCdPista}), debe ser la letra de la columna con el CdPista 00:00 " );
                Console.WriteLine(parametros.GetUsage());
                return;
            }
            if  (parametros.ColumnCarpeta != char.MinValue && !char.IsLetter(parametros.ColumnCarpeta))
            {
                Console.WriteLine($"el parametro ColumnaCarpeta tiene un valor incorrecto ({parametros.ColumnCarpeta}), debe ser la letra de la columna donde poner la carpeta del archivo." );
                Console.WriteLine(parametros.GetUsage());
                return;
            }
            if  (parametros.ColumnMusica != char.MinValue && !char.IsLetter(parametros.ColumnMusica))
            {
                Console.WriteLine($"el parametro ColumnaMusica tiene un valor incorrecto ({parametros.ColumnMusica}), debe ser la letra de la columna donde poner el nombre del archivo." );
                Console.WriteLine(parametros.GetUsage());
                return;
            }
            if  (parametros.ColumnInterprete != char.MinValue && !char.IsLetter(parametros.ColumnInterprete))
            {
                Console.WriteLine($"el parametro ColumnaInterprete tiene un valor incorrecto ({parametros.ColumnInterprete}), debe ser la letra de la columna donde poner el nombre del Interprete." );
                Console.WriteLine(parametros.GetUsage());
                return;
            }
            if  (!char.IsLetter(parametros.ColumnLink))
            {
                Console.WriteLine($"el parametro ColumnaLink tiene un valor incorrecto ({parametros.ColumnLink}), debe ser la letra de la columna donde poner el Hyperlink a la musica." );
                Console.WriteLine(parametros.GetUsage());
                return;
            }
            if  (parametros.ColumnTitulo != char.MinValue && !char.IsLetter(parametros.ColumnTitulo))
            {
                Console.WriteLine($"el parametro ColumnaTitulo tiene un valor incorrecto ({parametros.ColumnTitulo}), debe ser la letra de la columna donde poner el título de la música." );
                Console.WriteLine(parametros.GetUsage());
                return;
            }
            var bio = new BioCol()
            {
                Action = parametros.Action,
                ColumnCdPista = ColumnNameToNumber(parametros.ColumnCdPista.ToString()),
                Hoja = parametros.Hoja,
                PathColeccion = parametros.PathColeccion
                , ColumnLink = ColumnNameToNumber(parametros.ColumnLink.ToString())
                , ColumnCarpeta = ColumnNameToNumber(parametros.ColumnCarpeta.ToString())
                , ColumnMusica = ColumnNameToNumber(parametros.ColumnMusica.ToString())
                , ColumnTitulo = ColumnNameToNumber(parametros.ColumnTitulo.ToString())
                , ColumnInterprete = ColumnNameToNumber(parametros.ColumnInterprete.ToString())
            };

            //Console.WriteLine("procesando archivo {0}", Path.Combine(bio.PathColeccion, bio.Excel));
            //if (string.IsNullOrEmpty(bio.Action)) bio.Action = "h";
            ResultadoOperacion ro=null;
            switch (bio.Action)
            {
                case "h":
                    ro = bio.HyperLinks();
                    break;
                case "x":
                    ro = bio.CleanHyperLinks(bio.ColumnLink);
                    break;
            }
            Console.WriteLine(ro.Mensaje);
        }
    }
}
