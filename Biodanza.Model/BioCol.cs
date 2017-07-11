using System;
using System.IO;
using System.Linq;
using CommandLine;
using CommandLine.Text;
using NPOI.HSSF.UserModel;
using NPOI.SS.UserModel;

namespace Biodanza.Model
{
    public class BioCol
    {
        private HSSFWorkbook hssfWorkbook;

        [Option('p',"path", HelpText = "Path raiz de la colecci�n", Required = false)]
        public string PathColeccion { get; set; }

        [Option('e', "excel", HelpText = "nombre del excel de la colecci�n", Required = false)]
        public string Excel { get; set; }

        [Option('t', "coltitulo", HelpText = "N�mero de columna con el nombre del tema (arranca de 0)", Required = true)]
        public int ColumnTitulo { get; set; }

        [Option('n', "colnumero", HelpText = "N�mero de columna con el n�mero de tema (arranca de 0)", Required = true)]
        public int ColumnCdPista { get; set; }

        [Option('h', "hoja", HelpText = "N�mero de hoja del excel a procesar (arranca de 0)", Required = true)]
        public int Hoja { get; set; }

        [Option('a', "accion", HelpText = "accion a realizar: h = agregar links, x = quitar links", Required = false)]
        public string Action { get; set; }

        [HelpOption]
        public string GetUsage()
        {
            var help = new HelpText
            {
                AdditionalNewLineAfterOption = true,
                AddDashesToOption = true
            };
            help.AddPreOptionsLine("<>");
            help.AddPreOptionsLine("Usage: ");
            help.AddOptions(this);
            return help;
        }
    
    public void HyperLinks()
        {
            using (var fs = File.OpenRead(Path.Combine(PathColeccion, Excel)))
            {
                hssfWorkbook = new HSSFWorkbook(fs);
            }
            var sheet = hssfWorkbook.GetSheetAt(Hoja);
            var row = 1;
            var linkStyle = hssfWorkbook.CreateCellStyle();
            linkStyle.Alignment = HorizontalAlignment.Center;
            var fontWindings3 = hssfWorkbook.CreateFont();
            fontWindings3.FontName = "Wingdings 3";
            fontWindings3.FontHeightInPoints = 16;
            linkStyle.SetFont(fontWindings3);
            while (true)
            {
                var xlRow = sheet.GetRow(row);
                if (xlRow == null) break;
                var cell = xlRow.GetCell(ColumnCdPista);
                row++;
                var cdPista = cell?.StringCellValue;
                if (cdPista?.Length != 5) break;
                var file = GetFileFromCD_Pista(PathColeccion, cdPista);
                if (string.IsNullOrEmpty(file))
                {
                    Console.WriteLine("musica no encontrada. Pista: {0}. FilaExcel: {1}", cdPista, row);
                    continue;
                }
                cell = xlRow.GetCell(ColumnTitulo) ?? xlRow.CreateCell(ColumnTitulo, CellType.String);
                var cellHyperlink = new HSSFHyperlink(HyperlinkType.File) {Address = file};
                cell.Hyperlink = cellHyperlink;
                cell.SetCellValue("u"); //en font Windings 3 es play
                cell.CellStyle = linkStyle;
            }
            using (var fs = File.OpenWrite(Path.Combine(PathColeccion, Excel)))
            {
                hssfWorkbook.Write(fs);
            }
        }
        public void CleanHyperLinks(int col)
        {
            using (var fs = File.OpenRead(Path.Combine(PathColeccion, Excel)))
            {
                hssfWorkbook = new HSSFWorkbook(fs);
            }
            var sheet = hssfWorkbook.GetSheetAt(Hoja);
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
            using (var fs = File.OpenWrite(Path.Combine(PathColeccion, Excel)))
            {
                hssfWorkbook.Write(fs);
            }
        }

        public static string GetFileFromCD_Pista(string root, string cdPista)
        {
            var folder = cdPista.Substring(0, 2);
            var pista = cdPista.Substring(3, 2);
            var colFolder = Directory.GetDirectories(root, folder + "*").FirstOrDefault();
            if (colFolder == null) return null;

            var files = Directory.GetFiles(colFolder, pista + "*");
            if (files.Length == 1) return files[0].Substring(root.Length + 1);
            if (!pista.StartsWith("0")) return null;
            files = Directory.GetFiles(colFolder, pista.Substring(1) + "*");
            if (files.Length == 1) return files[0].Substring(root.Length + 1);
            if (files.Length <= 1) return null;
            int i;
            var file = files.FirstOrDefault(x => !int.TryParse(x.Substring(1, 1), out i));
            return file.Substring(root.Length + 1);
        }
    }
}
