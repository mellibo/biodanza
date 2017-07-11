using System;
using System.Collections.Generic;
using System.Data.Entity.Validation;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Security.Policy;
using System.Text;

namespace Biodanza.Model
{
    public class ImportIBF
    {
        private readonly IDictionary<string, string> _interpretes;
        BiodanzaEntities db;

        public ImportIBF()
        {
            _interpretes = GetInterpretes();
            db = new BiodanzaEntities();
        }

        public string importarTodosEjercicios()
        {
            var ejercicios = db.Ejercicios.Where(x => x.Observaciones.StartsWith("IBF,"));
            var errores = new StringBuilder();
            foreach (var ejercicio in ejercicios)
            {
                errores.Append(importarEjercicio(ejercicio));
            }
            db.SaveChanges();
            return errores.ToString();
        }

        public string importarEjercicio(Ejercicio ejercicio)
        {
            var campos = ejercicio.Observaciones.Split(',');
            var musicas = campos[3].Split(';');
            foreach (var codMusica in musicas)
            {
                if (string.IsNullOrEmpty(codMusica.Trim())) continue;
                var cd = int.Parse(codMusica.Substring(0, 2));
                var pista = int.Parse(codMusica.Substring(3, 2));
                const int idColeccionIbf = 3;
                var grupo = campos[2].Replace("\r", "").Replace("\n", "");
                ejercicio.IdGrupo = db.GrupoEjercicios.First(x => x.Nombre == grupo).IdGrupo;
                if (ejercicio.Musicas.Any(x => x.NroCd == cd && x.NroPista == pista && x.IdColeccion == idColeccionIbf)) continue;
                var musica = db.Musicas.FirstOrDefault(x => x.NroCd == cd && x.NroPista == pista && x.IdColeccion == idColeccionIbf);
                if (musica == null) return "Musica no encontrada: " + codMusica + "\r\n";
                ejercicio.Musicas.Add(musica);
            }
            return null;
        }

        public Musica GetMusicaFromFilename(string filename)
        {
            //var filename = "IBF1-07 Ballad of Sir Frankie Crisp G Harrison   (Ronda de inicio) 3,57.mp3";
            if (!(filename.ToLower().EndsWith(".mp3") ||filename.ToLower().EndsWith(".wma"))) return null;
            var musica = new Musica
            {
                Archivo = filename,
                IdColeccion = 3
            };
            var str = filename.Substring(3);
            musica.Duracion = GetDuracion(ref str);
            var guion = str.IndexOf("-");
            musica.NroCd = int.Parse(str.Substring(0, guion));
            var str1 = str.Substring(guion + 1, 5);
            var length = 5;
            int pista = 0;
            while (length != 0 && !int.TryParse(str1.Substring(0,length), out pista)) length--;
            musica.NroPista = pista;
            musica.Nombre = str.Substring(str.IndexOf(musica.NroPista.ToString(), guion) + musica.NroPista.ToString().Length).Trim();
            musica.Nombre = musica.Nombre.Substring(0, musica.Nombre.Length - 4);
            musica.Interprete = "";
            int finNombre = 0;
            var hasInterprete = false;
            if (musica.Nombre.IndexOf("(") > -1) finNombre = musica.Nombre.IndexOf("(");
            if (finNombre == 0 && musica.Nombre.IndexOf(",") > -1)
            {
                finNombre = musica.Nombre.IndexOf(",");
                hasInterprete = true;
                //while (musica.Nombre[finNombre] != ' ') finNombre--;
            }

            if (finNombre > 0)
            {
                if (hasInterprete) musica.Interprete = musica.Nombre.Substring(finNombre + 1).Trim();
                musica.Nombre = musica.Nombre.Substring(0, finNombre).Trim();
            }
            var interprete = _interpretes.Keys.FirstOrDefault(x => musica.Nombre.IndexOf(x) != -1);
            if (interprete != null)
            {
                musica.Nombre = musica.Nombre.Substring(0, musica.Nombre.IndexOf(interprete)).Trim();
                musica.Interprete = _interpretes[interprete];
            } else
            {
                if (musica.Nombre.IndexOf("    ") > -1)
                {
                    var musicaNombre = musica.Nombre;
                    musica.Nombre = musicaNombre.Substring(0, musicaNombre.IndexOf("    ")).Trim();
                    musica.Interprete = musicaNombre.Substring(musicaNombre.IndexOf("    ")).Trim();
                }
            }
            if (str.Length < 15) return musica;
            return musica;
        }

        private static TimeSpan? GetDuracion(ref string str)
        {
            string str1;
            if (str.Length <= 10 || str.IndexOf(",", str.Length - 10) == -1) return null;
            str1 = str.Substring(0, str.Length - 4);
            str1 = str1.Substring(str1.Length - 6);

            var arr = str1.Split(',');
            str1 = arr[0];
            var mins = "";
            foreach (var c in str1)
            {
                if (char.IsDigit(c))
                {
                    mins = mins + c;
                }
            }

            str1 = arr[1];
            var secs = "";
            foreach (var c in str1)
            {
                if (char.IsDigit(c)) secs = secs + c;
            }
            str = str.Replace(mins + "," + secs, "").Replace(mins + " ," + secs, "").Replace(mins + ", " + secs, "");
            if (mins.Length == 1) mins = "0" + mins;
            if (secs.Length == 1) secs = "0" + secs;

            var duracion = "00:" + mins + ":" + secs;
            TimeSpan tm;
            TimeSpan.TryParse(duracion, out tm);
            return tm;
        }

        public string importarIBF(string path)
        {
            var db = new BiodanzaEntities();
            db.Database.ExecuteSqlCommand("DELETE FROM Musica WHERE IdColeccion = 3");
            var result = new StringBuilder();
            foreach (var folder in Directory.GetDirectories(path, "IBF*"))
            {
                foreach (var filename in Directory.GetFiles(folder))
                {
                    var musica = GetMusicaFromFilename(Path.GetFileName(filename));
                    if (musica == null)
                    {
                        result.AppendFormat("{0}; no reconocido", filename);
                        continue;
                    }
                    musica.Carpeta = Directory.GetParent(filename).Name;
                    if (db.Musicas.FirstOrDefault(x => x.NroCd == musica.NroCd && x.NroPista == musica.NroPista && x.IdColeccion == 3) != null) continue;
                    db.Musicas.Add(musica);
                }
            }
            try
            {
                db.SaveChanges();
            }
            catch (DbEntityValidationException e)
            {
                var errorMessages = e.EntityValidationErrors
                    .SelectMany(x => x.ValidationErrors)
                    .Select(x => x.ErrorMessage);
                Console.WriteLine(errorMessages);
                throw;
            }
            return result.ToString();
        }

        private IDictionary<string, string> GetInterpretes()
        {
            var ret = new Dictionary<string,string>();
            var list = (new BiodanzaEntities()).Interpretes.OrderByDescending(x => x.Interprete1.Length);
            foreach (var interprete in list)
            {
                ret.Add(interprete.Interprete1, interprete.NombreCorrecto);
            }
            return ret;
        }
    }
}
