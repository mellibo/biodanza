using System;
using System.Data.Entity.Infrastructure;
using Biodanza.Model;
using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace HyperlinkTests
{
    [TestClass]
    public class IbfImportTest
    {
        private const string root = @"D:\Google Drive\Biodanza\Musica\IBF";

        ImportIBF importIbf = new ImportIBF();

        [TestMethod]
        public void ImportIBFFromFolder()
        {
            //arrange

            //act
            var result = importIbf.importarIBF(root);
            
            //assert
            Console.WriteLine(result);
        }

        [TestMethod]
        public void GetMusicaFromFilename()
        {
            //arrange
            var filename = "IBF1-07 Ballad of Sir Frankie Crisp G Harrison   (Ronda de inicio) 3,57.mp3";

            //act
            var result = importIbf.GetMusicaFromFilename(filename);

            //assert
            result.Should().NotBeNull();
            result.IdColeccion.Should().Be(3);
            result.NroCd.Should().Be(1);
            result.NroPista.Should().Be(7);
            result.Duracion.Value.Minutes.Should().Be(3);
            result.Duracion.Value.Seconds.Should().Be(57);
            result.Nombre.Should().Be("Ballad of Sir Frankie Crisp");
        }



        [TestMethod]
        public void GetMusicaFromFilename_InterpreDesdeLista()
        {
            //arrange
            var filename = "IBF1-06 Behind that locked door G Harrison     (Ronda de inicio) 3, 10.mp3";

            //act
            var result = importIbf.GetMusicaFromFilename(filename);

            //assert
            result.Nombre.Should().Be("Behind that locked door");
            result.Interprete.Should().Be("George Harrison");
        }

        [TestMethod]
        public void GetMusicaFromFilename_FixParentesisEnInterprete()
        {
            //arrange
            var filename = "IBF 17-16 Ave Mar�a Ch. Gounod (Intimidad) 3,28.mp3";

            //act
            var result = importIbf.GetMusicaFromFilename(filename);

            //assert
            result.Nombre.Should().Be("Ave Mar�a");
            result.Interprete.Should().Be("Ch. Gounod");
        }

        [TestMethod]
        public void GetMusicaFromFilename_FixInterpreteConComa()
        {
            //arrange
            var filename = "IBF 5-15 Me gusta tu rosa roja, Wawanco.mp3";

            //act
            var result = importIbf.GetMusicaFromFilename(filename);

            //assert
            result.Nombre.Should().Be("Me gusta tu rosa roja");
            result.Interprete.Should().Be("Wawanco");
        }

        [TestMethod]
        public void GetMusicaFromFilename_DuracionConEspacioIntermedio()
        {
            //arrange
            var filename = "IBF1-01 Free as a bird                 The  Beatles   (Ronda de inicio) 4, 28.mp3";

            //act
            var result = importIbf.GetMusicaFromFilename(filename);

            //assert
            result.Duracion.Value.Minutes.Should().Be(4);
            result.Duracion.Value.Seconds.Should().Be(28);
        }

        [TestMethod]
        public void GetMusicaFromFilename_SiHay4EspacioLoTomaComoInterprete()
        {
            //arrange
            var filename = "IBF1-01 Free as a bird                 The  Beatles   (Ronda de inicio) 4, 28.mp3";

            //act
            var result = importIbf.GetMusicaFromFilename(filename);

            //assert
            result.Interprete.Should().Be("The  Beatles");
            result.Nombre.Should().Be("Free as a bird");
        }

        [TestMethod]
        public void TomarNombreYPistaCuandoEstanPegados()
        {
            //arrange
            var filename = "IBF1 - 11Tema de amor por Gabriela Gal Costa(Ronda de inicio) 4, 04.mp3";

            //act
            var result = importIbf.GetMusicaFromFilename(filename);

            //assert
            result.NroPista.Should().Be(11);
            result.Nombre.Should().Be("Tema de amor por Gabriela Gal Costa");
        }
        [TestMethod]
        public void GetMusicaFromFilename_SiNoEsMusicaRetornaNull()
        {
            //arrange
            var filename = "IBF1-07 Ballad of Sir Frankie Crisp G Harrison   (Ronda de inicio) 3,57.doc";

            //act
            var result = importIbf.GetMusicaFromFilename(filename);

            //assert
            result.Should().BeNull();
        }

        [TestMethod]
        public void GetMusicaFromFilename_FixNombreINterpreteVacio()
        {
            //arrange
            var filename = "IBF 5-16 Me muero por ella      Ca�a Brava.mp3";

            //act
            var result = importIbf.GetMusicaFromFilename(filename);

            //assert
            result.Nombre.Should().Be("Me muero por ella");
            result.Interprete.Should().Be("Ca�a Brava");
        }

        [TestMethod]
        public void GetMusicaFromFilename_FixLetItBe()
        {
            //arrange
            var filename = "IBF1-02 Let it be                          The Beatles   (Ronda de inicio) 4,27.mp3";

            //act
            var result = importIbf.GetMusicaFromFilename(filename);

            //assert
            result.Nombre.Should().Be("Let it be");
            result.Interprete.Should().Be("The Beatles");
        }

        [TestMethod]
        public void GetMusicaFromFilename_FixCD19()
        {
            //arrange
            var filename = "IBF19-04 With a little help from my friends     The Bss 2,45.wma";

            //act
            var result = importIbf.GetMusicaFromFilename(filename);

            //assert
            result.Nombre.Should().Be("With a little help from my friends");
            result.Interprete.Should().Be("The Bss");
        }
        

    [TestMethod]
        public void SiObsNoEmpiezaConIBF_EntoncesNoHAcerNAda()
        {
            //arrange
            var observaciones = "aa";
            var ejercicio = new Ejercicio
            {
                Nombre = "RONDA DE ACTIVACI�N",
                Observaciones = observaciones
            };
            
            //act
            importIbf.importarEjercicio(ejercicio);

            //assert
            ejercicio.Descripcion.Should().BeNullOrEmpty();
            ejercicio.Musicas.Count.Should().Be(0);
            ejercicio.Objetivo.Should().BeNullOrEmpty();
            ejercicio.Observaciones.Should().Be(observaciones);
        }

        [TestMethod]
        public void ImportarEjercicioIBF()
        {
            //arrange
            var obs = @"IBF,11,LAS RONDAS
,01-18;01-18;01-12;20-07;04-20;01-19;07-21;02-20;02-19";
            var ejercicio = new Ejercicio {Nombre = "RONDA DE ACTIVACI�N", Observaciones = obs, GrupoEjercicio = new GrupoEjercicio { IdGrupo = 4}, IdGrupo = 4, IdEjercicio = 1, Detalle = @"Al final de la clase, para mantener la cohesi�n grupal, conviene proponer una activaci�n en ronda. La intensidad de la activaci�n debe tener en cuenta la fisiolog�a y la vivencia de las personas, de manera de ser lo m�s progresiva posible, para que no haya ruptura en la vivencia.
Descripci�n :

La ronda se abre lentamente y el ritmo aparece con mas presencia. El movimiento se vuelve m�s vital.

Puede ser el momento de saludarse y despedirse (de darse besos).

Objetivo :

Llevar al grupo hacia una activaci�n final permitiendo un estado de conciencia compatible con las exigencias de la realidad exterior. La activaci�n final debe permitir una celebraci�n, una conclusi�n que es algo m�s que una simple activaci�n motora.

" };


            //act
            importIbf.importarEjercicio(ejercicio);
            
            //assert
            ejercicio.Musicas.Count.Should().Be(8);
//            ejercicio.Descripcion.Should()
//                .Be(
//                    @"La ronda se abre lentamente y el ritmo aparece con mas presencia. El movimiento se vuelve m�s vital.
//Puede ser el momento de saludarse y despedirse (de darse besos).");
            ejercicio.IdGrupo.Should().Be(50);
            //ejercicio.Objetivo.Should().Be(@"Llevar al grupo hacia una activaci�n final permitiendo un estado de conciencia compatible con las exigencias de la realidad exterior. La activaci�n final debe permitir una celebraci�n, una conclusi�n que es algo m�s que una simple activaci�n motora.");
        }

        [TestMethod]
        public void ImportarEjerciciosTodos()
        {
            //arrange


            //act
            var result =importIbf.importarTodosEjercicios();
            
            //assert
            Console.WriteLine(result);
        }

        [TestMethod]
        public void UpdateMusicaNombreInterprete()
        {
            //arrange

            //act
            var result = importIbf.UpdateNombreInterprete();

            //assert
            Console.WriteLine(result);
        }
    }
}