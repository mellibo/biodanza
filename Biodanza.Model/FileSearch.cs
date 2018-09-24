using System;
using System.IO;
using System.Linq;

namespace Biodanza.Model
{
    public class FileSearch
    {
        public string PathMusicas;

        public string[] FilePatterns { get; set; }

        public string[] FolderPatterns { get; set; }

        public ResultadoOperacion GetFile(ItemData itemData)
        {
            if (itemData.NroCd == 0 || itemData.NroPista == 0) return ResultadoOperacion.Fail("CdPista Invalido: " + itemData);
            string colFolder = null;
            foreach (var pattern in FolderPatterns)
            {
                var searchPattern = GetPattern(pattern, itemData);
                colFolder = Directory.GetDirectories(Path.Combine(PathMusicas, itemData.Coleccion), searchPattern).FirstOrDefault();
                if (colFolder != null) break;
            }
            if (colFolder == null)
                return ResultadoOperacion.Fail("Carpeta no encontrada. " + itemData);
            string[] files = { };
            var msg = "";
            foreach (var pattern in FilePatterns)
            {
                var searchPattern = GetPattern(pattern, itemData);
                files = Directory.GetFiles(colFolder, searchPattern);
                if (files.Length == 0) continue;
                if (files.Length == 1)
                {
                    itemData.Archivo = Path.GetFileName(files[0]);
                    itemData.Carpeta = Path.GetDirectoryName(files[0].Substring(PathMusicas.Length + 1));
                    return new ResultadoOperacion { Mensaje = files[0].Substring(PathMusicas.Length) };
                }
                if (string.IsNullOrWhiteSpace(msg))
                {
                    msg = $"busqueda: {searchPattern}. Hay {files.Length} archivos y debe haber 1 solo.  {itemData}.: " + Environment.NewLine;
                    foreach (var file in files)
                    {
                        msg += "    " + file + Environment.NewLine;
                    }

                }
            }
            if (files.Length == 0 && string.IsNullOrWhiteSpace(msg))
                msg = "Archivo de música no encontrado. " + itemData;
            return ResultadoOperacion.Fail(msg);
            //if (!pista.StartsWith("0")) return null;
            //files = Directory.GetFiles(colFolder, pista.Substring(1) + "*");
            //if (files.Length == 1) return files[0].Substring(root.Length);
            //if (files.Length <= 1) return null;
            //int i;
            //var file = files.FirstOrDefault(x => !int.TryParse(x.Substring(1, 1), out i));
            //return file.Substring(root.Length);
        }
        private static string GetPattern(string pattern, ItemData itemData)
        {
            if (itemData.NroPista > 9)
            {
                pattern = pattern.Replace("0{pista}", "{pista}");
            }
            if (itemData.NroCd > 9)
            {
                pattern = pattern.Replace("0{cd}", "{cd}");
            }
            var search = pattern.ToLower().Replace("{cd}", itemData.NroCd.ToString()).Replace("{pista}", itemData.NroPista.ToString()).Replace("{carpeta}", itemData.Carpeta).Replace("{titulo}".Replace(" ","?"), itemData.Titulo).Replace("{tipoejercicio}", itemData.TipoEjercicio).Replace("{lineas}", itemData.Lineas).Replace("{interprete}".Replace(" ", "?"), itemData.Interprete).Replace("{ejercicio}", itemData.Ejercicio);
            return search.Replace(":", "").Replace(@"/", "").Replace(@"\", "");
        }

    }
}