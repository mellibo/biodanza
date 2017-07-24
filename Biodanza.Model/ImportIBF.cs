using System;
using System.Collections.Generic;
using System.Data;
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
            var cmd = db.Database.Connection.CreateCommand();
            cmd.CommandText =
                @"  UPDATE Ejercicios SET Observaciones = REPLACE(Observaciones,'DANZAS DE SHIVA, DE VISHNU Y DE BRAHMA','DANZAS DE SHIVA DE VISHNU Y DE BRAHMA')where Observaciones like '%DANZAS DE SHIVA, DE VISHNU Y DE BRAHMA%'";
            cmd.CommandType = CommandType.Text;
            db.Database.Connection.Open();
            cmd.ExecuteNonQuery();
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
            var result = new StringBuilder();
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
                if (musica == null)
                {
                    result.AppendLine("Musica no encontrada: " + codMusica);
                    continue;
                }
                ejercicio.Musicas.Add(musica);
            }
            return result.ToString();
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

        public string UpdateNombreInterprete()
        {
            var result = new StringBuilder();
            var db =new BiodanzaEntities();
            var list = db.tempMusicas;
            foreach (var tempMusica in list)
            {
                var musica =
                    db.Musicas.FirstOrDefault(
                        x => x.NroCd == tempMusica.NroCd && x.NroPista == tempMusica.NroPista && x.IdColeccion == 3);
                if (musica == null)
                {
                    result.AppendLine($"{tempMusica.NroCd};{tempMusica.NroPista}");
                    continue;
                }
                var arr = tempMusica.texto.Split(';');
                if (arr.Length < 4)
                {
                    result.AppendLine($"{tempMusica.NroCd};{tempMusica.NroPista};{tempMusica.texto}");
                    continue;
                }
                musica.Nombre = arr[1].Trim();
                if (arr[2].IndexOf("(") > -1)
                {
                    arr[2] = arr[2].Substring(0, arr[2].IndexOf("(") - 1);
                }
                musica.Interprete = arr[2].Trim();
                TimeSpan ts;
                if (TimeSpan.TryParse("00:" + arr[3], out ts))
                {
                    musica.Duracion = ts;
                }
            }
            var musica1 = db.Musicas.First(x => x.NroCd == 15 && x.NroPista == 4 && x.IdColeccion == 3);
            musica1.Nombre = "Oikan Ayns Bethlehem (Birth In Bethlehem)";
            musica1.Interprete = "Christian, Emma";
            musica1.Duracion = new TimeSpan(0,5,14);

            musica1 = db.Musicas.First(x => x.NroCd == 16 && x.NroPista == 20 && x.IdColeccion == 3);
            musica1.Nombre = "Andante - Sinfonia in Si bemolle Maggiore";
            musica1.Interprete = "Salieri, Francesco";
            musica1.Duracion = new TimeSpan(0,3,44);

            musica1 = db.Musicas.First(x => x.NroCd == 18 && x.NroPista == 1 && x.IdColeccion == 3);
            musica1.Nombre = "I wish you were here (parte 1)";
            musica1.Interprete = "Pink Floyd";
            musica1.Duracion = new TimeSpan(0,3,54);

            musica1 = db.Musicas.First(x => x.NroCd == 18 && x.NroPista == 13 && x.IdColeccion == 3);
            musica1.Nombre = "I wish you were here (parte 1)";
            musica1.Interprete = "Pink Floyd";
            musica1.Duracion = new TimeSpan(0,3,54);

            db.SaveChanges();
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
