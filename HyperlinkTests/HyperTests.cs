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
        private const string root = @"D:\Google Drive\Biodanza\Musica\";

        private FileSearch getFileSearch()
        {
            return new FileSearch
            {
                PathMusicas = root,
                FilePatterns = new[] {"0{pista}*", "{pista}*"},
                FolderPatterns = new[] {"BsAs 0{cd}*","BsAs {cd}*"}
            };
        }

        [TestMethod]
        public void GetFileFromCD_Bug01por10_HoldOn()
        {
            var fs = getFileSearch();
            var itemData = new ItemData {CdPista = "09.10", Coleccion = "BsAs"};

            var result = fs.GetFile(itemData);

            Console.WriteLine(result.Mensaje);
            result.Ok.Should().Be(true);
            result.Mensaje.Should().Be(@"BsAs\BsAs 09\10 10 Hold on.mp3");
        }

        [TestMethod]
        public void GetFileFromCD_Bug10por1_HoldOn()
        {
            var fs = getFileSearch();
            var itemData = new ItemData { CdPista = "07.10", Coleccion = "BsAs" };

            var result = fs.GetFile(itemData);

            Console.WriteLine(result.Mensaje);
            result.Ok.Should().Be(true);
            result.Mensaje.Should().Be(@"BsAs\BsAs 07\10 10 My darling child.mp3");
        }

        [TestMethod]
        public void GetFileFromCD_PistaString_2Digitos()
        {
            var fs = getFileSearch();
            var itemData = new ItemData { CdPista = "43.10", Coleccion = "BsAs" };

            var result = fs.GetFile(itemData);

            Console.WriteLine(result.Mensaje);
            result.Ok.Should().Be(true);
            File.Exists(Path.Combine(root, result.Mensaje)).Should().BeTrue();
        }

        [TestMethod]
        public void GetFileFromCD_PistaString_1DigitoPista()
        {
            var fs = getFileSearch();
            var itemData = new ItemData { CdPista = "43.01", Coleccion = "BsAs" };

            var result = fs.GetFile(itemData);

            Console.WriteLine(result.Mensaje);
            result.Ok.Should().Be(true);
            File.Exists(Path.Combine(root, result.Mensaje)).Should().BeTrue();
        }


        [TestMethod]
        public void AddHyperLinkTest()
        {
            //arrange
            var bio = new BioCol();
            bio.PathColeccion = @"D:\Google Drive\Biodanza\Otras Musicas\Buenos Aires";
            bio.Excel = "CDs_BsAs_54 Danzas.xls";
            bio.ColumnCdPista = 0;
            bio.ColumnLink = 2;
            bio.Hoja = 4;

            //act
            bio.HyperLinks();

            //assert
        }

        //[TestMethod]
        //public void UpdateCarpetaYArchivo()
        //{
        //    //arrange
        //    var bio = new BioCol();

        //    //act
        //    bio.UpdateCarpetaYArchivoEnDb(@"D:\Google Drive\Biodanza\Musica\BsAs\");
        //    //assert
        //}
    }
}