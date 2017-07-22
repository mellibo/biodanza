using System;
using System.IO;
using Biodanza.Model;
using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace HyperlinkTests
{
    [TestClass]
    public class HyperTests
    {
        private const string root = @"D:\Google Drive\Biodanza\Musica\BsAs\";

        [TestMethod]
        public void GetFileFromCD_PistaString_2Digitos()
        {
            var cd_pista = "43.10";

            var result = BioCol.GetFileFromCD_Pista(root, cd_pista);

            Console.WriteLine(result);
            File.Exists(Path.Combine(root, result)).Should().BeTrue();
        }

        [TestMethod]
        public void GetFileFromCD_PistaString_1DigitoPista()
        {
            //arrange
            var cd_pista = "43.01";

            //act
            var result = BioCol.GetFileFromCD_Pista(root, cd_pista);

            //assert
            Console.WriteLine(result);
            File.Exists(Path.Combine(root, result)).Should().BeTrue();
        }


        [TestMethod]
        public void AddHyperLinkTest()
        {
            //arrange
            var bio = new BioCol();
            bio.PathColeccion = @"D:\Google Drive\Biodanza\Otras Musicas\Buenos Aires";
            bio.Excel = "CDs_BsAs_54 Danzas.xls";
            bio.ColumnCdPista = 0;
            bio.ColumnTitulo = 2;
            bio.Hoja = 4;

            //act
            bio.HyperLinks();

            //assert
        }

        [TestMethod]
        public void UpdateCarpetaYArchivo()
        {
            //arrange
            var bio = new BioCol();

            //act
            bio.UpdateCarpetaYArchivoEnDb(@"D:\Google Drive\Biodanza\Musica\BsAs\");
            //assert
        }
    }
}