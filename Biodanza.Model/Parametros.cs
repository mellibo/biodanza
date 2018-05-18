using CommandLine;
using CommandLine.Text;

namespace Biodanza.Model
{
    public class Parametros
    {
        [Option('p', "path", HelpText = "Path raiz de la colección", Required = false)]
        public string PathColeccion { get; set; }

        [Option('e', "excel", HelpText = "nombre del excel de la colección", Required = false)]
        public string Excel { get; set; }

        [Option('t', "coltitulo", HelpText = "Número de columna con el nombre del tema (arranca de 0)", Required = false)]
        public int ColumnTitulo { get; set; }

        [Option('n', "colnumero", HelpText = "Número de columna con el número de tema (arranca de 0)", Required = false)]
        public int ColumnCdPista { get; set; }

        [Option('h', "hoja", HelpText = "Número de hoja del excel a procesar (arranca de 0)", Required = false)]
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

    }
}