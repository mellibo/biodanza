using CommandLine;
using CommandLine.Text;

namespace Biodanza.Model
{
    public class Parametros
    {
        [Option(shortName: 'p', longName:  "path", HelpText = "Carpeta de la colección de música" , Required = true)]
        public string PathColeccion { get; set; }

        [Option('l', "colLink", HelpText = "columna en donde poner el hyperlink al archivo de musica", Required = true)]
        public char ColumnLink { get; set; }

        [Option('n', "colnumero", HelpText = "columna con el CdPista de tema", Required = true)]
        public char ColumnCdPista { get; set; }

        [Option('m', "colMusica", HelpText = "columna donde poner el nombre del archivo de musica", Required = false)]
        public char ColumnMusica { get; set; }

        [Option('c', "colCarpeta", HelpText = "columna donde poner el nombre de la carpeta del archivo de musica", Required = false)]
        public char ColumnCarpeta { get; set; }

        [Option('t', "colTitulo", HelpText = "columna del titulo de la música (nombre de la canción)", Required = false)]
        public char ColumnTitulo { get; set; }

        [Option('i', "colInterprete", HelpText = "columna del Interprete de la música", Required = false)]
        public char ColumnInterprete { get; set; }

        [Option('h', "hoja", HelpText = "Nombre de la hoja del excel a procesar", Required = true)]
        public string Hoja { get; set; }

        [Option('a', "accion", HelpText = "accion a realizar: h = agregar links, x = quitar links", Required = false, DefaultValue = "h")]
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