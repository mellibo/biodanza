using System;
using System.IO;
using System.Linq;
using System.Text;
using CommandLine;
using CommandLine.Text;
using NPOI.HSSF.UserModel;
using NPOI.SS.UserModel;

namespace Biodanza.Model
{
    public class BioCol
    {
        private HSSFWorkbook hssfWorkbook;

        public string PathColeccion { get; set; }

        public string Excel { get; set; }

        public int ColumnLink { get; set; }

        public int ColumnCdPista { get; set; }

        public string Hoja { get; set; }
        public int ColumnTitulo { get; set; }
        public int ColumnInterprete { get; set; }

        public string Action { get; set; }

        public int ColumnCarpeta { get; set; }
        public int ColumnMusica { get; set; }


        public ResultadoOperacion HyperLinks()
        {
            var filePatterns = File.ReadAllLines("FormatosArchivosMusica.txt");
            var folderPatterns = File.ReadAllLines("FormatosCarpetas.txt");
            var searchFile = new FileSearch()
            {
                FilePatterns = filePatterns,
                FolderPatterns = folderPatterns,
                PathMusicas = PathColeccion
            };
            var ro= GetExcel();
            if (!ro.Ok) return ro;
            try
            {
                using (var fs = File.OpenRead(Excel))
                {
                    hssfWorkbook = new HSSFWorkbook(fs);
                }

            }
            catch (Exception e)
            {
                return ResultadoOperacion.Fail($"No se pudo abrir el excel {Excel}. Error: {e.Message}.");
            }
            var sheet = hssfWorkbook.GetSheet(Hoja);
            if (sheet == null) return ResultadoOperacion.Fail($"La hoja {Hoja} no existe en el archivo {Excel}");
            var row = 1;
            var linkStyle = hssfWorkbook.CreateCellStyle();
            linkStyle.Alignment = HorizontalAlignment.Center;
            var fontWindings3 = hssfWorkbook.CreateFont();
            fontWindings3.FontName = "Wingdings 3";
            fontWindings3.FontHeightInPoints = 16;
            linkStyle.SetFont(fontWindings3);
            var filas = 0; var filasError = 0;
            while (true)
            {
                var xlRow = sheet.GetRow(row);
                if (xlRow == null) break;
                filas++;
                var cell = xlRow.GetCell(ColumnCdPista);
                row++;
                var cdPista = cell?.StringCellValue;
                if (cdPista?.Length != 5)
                {
                    Console.WriteLine("FilaExcel: {1}. {0}.", $"cdPista Incorrecto ({cdPista})", row);
                    continue;
                }
                int i;
                if (!int.TryParse(cdPista.Substring(0,2), out i))
                {
                    Console.WriteLine("FilaExcel: {1}. {0}.", $"cdPista Incorrecto ({cdPista})", row);
                    continue;
                }
                if (!int.TryParse(cdPista.Substring(3,2), out i))
                {
                    Console.WriteLine("FilaExcel: {1}. {0}.", $"cdPista Incorrecto ({cdPista})", row);
                    continue;
                }
                if (row >= 10000) break;
                var itemdata = new ItemData() { CdPista = cdPista, Coleccion = "" };
                if (ColumnInterprete > -1)
                {
                    cell = xlRow.GetCell(ColumnInterprete);
                    itemdata.Interprete = cell?.StringCellValue;
                }
                if (ColumnTitulo > -1)
                {
                    cell = xlRow.GetCell(ColumnTitulo);
                    itemdata.Titulo = cell?.StringCellValue;
                }
                var resultadoOperacion = searchFile.GetFile(itemdata);
                if (!resultadoOperacion.Ok)
                {
                    filasError++;
                    Console.WriteLine("FilaExcel: {1}. {0}.", resultadoOperacion.Mensaje, row);
                    continue;
                }
                cell = xlRow.GetCell(ColumnLink) ?? xlRow.CreateCell(ColumnLink, CellType.String);
                var cellHyperlink = new HSSFHyperlink(HyperlinkType.File)
                {
                    Address = resultadoOperacion.Mensaje.Substring(1)
                };
                cell.Hyperlink = cellHyperlink;
                cell.SetCellValue("u"); //en font Windings 3 es play
                cell.CellStyle = linkStyle;
                if (ColumnCarpeta >= 0)
                {
                    cell = xlRow.GetCell(ColumnCarpeta) ?? xlRow.CreateCell(ColumnCarpeta, CellType.String);
                    cell.SetCellValue(itemdata.Carpeta);
                }
                if (ColumnMusica >= 0)
                {
                    cell = xlRow.GetCell(ColumnMusica) ?? xlRow.CreateCell(ColumnMusica, CellType.String);
                    cell.SetCellValue(itemdata.Archivo);
                }
            }
            
            using (var fs = File.OpenWrite(Excel))
            {
                hssfWorkbook.Write(fs);
            }
            return new ResultadoOperacion { Ok = true,Mensaje = $"Se procesaron {filas} del excel, de las cuales {filasError} filas no se encontro el archivo de música."};
        }

        private ResultadoOperacion GetExcel()
        {
            Excel = Path.Combine(PathColeccion, Path.GetFileName(PathColeccion) + ".xls");
            if (!File.Exists(Excel))
            {
                Excel = Path.Combine(PathColeccion, Path.GetFileName(PathColeccion) + ".xlsx");
                if (!File.Exists(Excel))
                {
                    {
                        return ResultadoOperacion.Fail("No se encontro el archivo excel de la coleccion: " +
                                                       Path.GetDirectoryName(PathColeccion) + ".xls");
                        
                    }
                }
            }
            return new ResultadoOperacion {Ok = true};
        }

        public ResultadoOperacion CleanHyperLinks(int col)
        {
            var ro = GetExcel();
            if (!ro.Ok) return ro;
            using (var fs = File.OpenRead(Excel))
            {
                hssfWorkbook = new HSSFWorkbook(fs);
            }
            var sheet = hssfWorkbook.GetSheet(Hoja);
            var row = 1;
            while (true)
            {
                var xlRow = sheet.GetRow(row);
                if (xlRow == null) break;
                var cell = xlRow.GetCell(col);
                row++;
                if (cell == null) continue;
                cell.Hyperlink = null;
            }
            using (var fs = File.OpenWrite(Excel))
            {
                hssfWorkbook.Write(fs);
            }
            return new ResultadoOperacion() {Ok = true};
        }

        //public static string GetFileFromCD_Pista(string root, string cdPista, string[] folderPatterns,
        //    string[] filePatterns)
        //{
        //    var folder = cdPista.Substring(0, 2);
        //    var pista = cdPista.Substring(3, 2);
        //    string colFolder = null;
        //    foreach (var pattern in folderPatterns)
        //    {
        //        colFolder = Directory.GetDirectories(root, GetPattern(pattern, folder)).FirstOrDefault();
        //        if (colFolder != null) break;
        //    }
        //    if (colFolder == null) return null;
        //    foreach (var pattern in filePatterns)
        //    {
        //        var files = Directory.GetFiles(colFolder, GetPattern(pattern, folder, pista));
        //        if (files.Length == 1) return files[0].Substring(root.Length);
        //    }
        //    return null;
        //    if (!pista.StartsWith("0")) return null;
        //    files = Directory.GetFiles(colFolder, pista.Substring(1) + "*");
        //    if (files.Length == 1) return files[0].Substring(root.Length);
        //    if (files.Length <= 1) return null;
        //    int i;
        //    var file = files.FirstOrDefault(x => !int.TryParse(x.Substring(1, 1), out i));
        //    return file.Substring(root.Length);
        //}

        //private static string GetPattern(string pattern, string cd, string pista = "")
        //{
        //    int i;
        //    if (int.TryParse(pista, out i))
        //    {
        //        if (i > 9)
        //        {
        //            pattern = pattern.Replace("0{pista}", "{pista}");
        //        }
        //    }
        //    if (int.TryParse(cd, out i))
        //    {
        //        if (i > 9)
        //        {
        //            pattern = pattern.Replace("0{cd}", "{cd}");
        //        }
        //    }
        //    return pattern.ToLower().Replace("{cd}", cd).Replace("{pista}", pista);
        //}

        //public string UpdateCarpetaYArchivoEnDb(string root)
        //{
        //    var ret = new StringBuilder();

        //    var db = new BiodanzaEntities();

        //    var musicas = db.Musicas.Where(x => x.IdColeccion == 1);
        //    foreach (var musica in musicas)
        //    {
        //        var file = GetFileFromCD_Pista(root,
        //            musica.NroCd.ToString().PadLeft(2, '0') + "." + musica.NroPista.ToString().PadLeft(2, '0'),
        //            new[] {"{cd}*"}, new[] {"{pista}*"});
        //        var archivo = Path.GetFileName(file);
        //        var carpeta = Path.GetDirectoryName(file);
        //        musica.Archivo = archivo;
        //        musica.Carpeta = carpeta;
        //    }
        //    db.SaveChanges();
        //    return ret.ToString();
        //}
    }
}