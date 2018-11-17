
app.controller('cargarMusicaController', ['$scope', '$window', '$location', 'loadJsService', 'loaderService', '$uibModal', 'NgTableParams', 'alertService', '$rootScope', 'playerService', '$localStorage', function ($scope, $window, $location, loadJsService, loaderService, $uibModal, NgTableParams, alertService, $rootScope, playerService, $localStorage) {
    $scope.pathMusicas = getCurrentPath() + "musica/";

    $scope.reset = () => {
        $scope.data = {
            wb: null,
            sheets: [],
            sampleRows: [],
            tableParams: new NgTableParams({ count: 15 }),
            totalOk: 0,
            totalLeidos: 0,
            totalError: 0,
            validado: false
            , carpetaColeccion: ""
            , coleccion: {
                nombre: "",
                carpeta: "",
                excel: "",
                hojaEjercicios: "Por Nro",
                cargar: true
            }
        };
    };
    $scope.reset();

    $scope.equivalenciaEjercicios = [];
    $scope.equivalenciaGrupo = [];
    $scope.equivalenciaInterpretes = [];
    $scope.leerEquivalencias = function (file) {
        var f = file.files[0];
        var rABS = typeof FileReader !== 'undefined' && FileReader.prototype && FileReader.prototype.readAsBinaryString;
        var reader = new FileReader();
        reader.onload = function (e) {
            var data = e.target.result;
            var arr;
            var readtype = { type: rABS ? 'binary' : 'base64' };
            if (!rABS) {
                arr = fixdata(data);
                data = btoa(arr);
            }

            var wb = XLSX.read(data, readtype);
            var sheets = wb.SheetNames;
            var sheet = wb.Sheets["Ejercicios"];
            var rows = XLSX.utils.sheet_to_json(sheet);
            $scope.equivalenciaEjercicios = rows.slice();

            sheet = wb.Sheets["Interpretes"];
            rows = XLSX.utils.sheet_to_json(sheet);
            $scope.equivalenciaInterpretes = rows.slice();
            sheet = wb.Sheets["Grupo"];
            rows = XLSX.utils.sheet_to_json(sheet);
            $scope.equivalenciaGrupo = rows.slice();
            alertService.addInfoAlert("Archivo de Equivalencias Cargado.");
        };
        if (rABS) reader.readAsBinaryString(f);
        else reader.readAsArrayBuffer(f);
        angular.element(document.querySelector('#fileEquivalencias')).val(null);

        return;
    };


    $scope.leerColeccion = function (file) {
        var f = file.files[0];
        $scope.data.coleccion.nombre = f.name.substring(0, f.name.indexOf(".")).toUpperCase();
        var filePath;
        $scope.data.carpetaColeccion = "musica/" + $scope.data.coleccion.nombre + "/";
        filePath = $scope.data.carpetaColeccion + f.name;
        loadJsService.load(filePath)
            .then((a) => {
                $scope.data.coleccion.carpeta = $scope.data.carpetaColeccion;

                $scope.data.wb = null;
                $scope.data.sheets = [];
                $scope.data.sampleRows = [];
                $scope.data.sheet = null;

                $rootScope.$broadcast('loadingStatusActive');

                var rABS = typeof FileReader !== 'undefined' && FileReader.prototype && FileReader.prototype.readAsBinaryString;
                var reader = new FileReader();
                reader.onload = function (e) {
                    var data = e.target.result;
                    var arr;
                    var readtype = { type: rABS ? 'binary' : 'base64' };
                    if (!rABS) {
                        arr = fixdata(data);
                        data = btoa(arr);
                    }

                    $scope.data.wb = XLSX.read(data, readtype);
                    $scope.data.sheets = $scope.data.wb.SheetNames;
                    //$scope.data.sheet = $scope.data.wb.Sheets[$scope.data.wb.SheetNames[0]];
                    //sheet['!ref'] = "A1:L11";
                    //$scope.loadSheet();
                    $rootScope.$broadcast('loadingStatusInactive');
                    $scope.safeApply();
                };
                if (rABS) reader.readAsBinaryString(f);
                else reader.readAsArrayBuffer(f);
                angular.element(document.querySelector('#fileImport')).val(null);
            }, (a) => {
                angular.element(document.querySelector('#fileImport')).val(null);
                alertService.addAlert("danger", "No se encontro el archivo excel en la ubicación esperada: " + filePath + "<br/>Verifique que la carpeta del archivo sea la indicada arriba.<br/>Verifique que el nombre del archivo excel sea igual al nombre de la carpeta.<br/>");
            });
        return;
    };

    $scope.importarExcelMusicas = function () {
        var result = loaderService.importarColeccionMusicas($scope.data.coleccion, $scope.data.sampleRows);
        alertService.addInfoAlert("se importaron " + result.length + " importados de la coleccion " + $scope.data.coleccion.nombre);
        $scope.reset();
    };

    var musicasOk = [];
    $scope.loadSheet = function () {
        $rootScope.$broadcast('loadingStatusActive');
        var sheet = $scope.data.sheet;
        $scope.data.sampleRows = XLSX.utils.sheet_to_json(sheet);
        $scope.data.tableParams = new NgTableParams({ count: 10 }, { dataset: $scope.data.sampleRows });
        var colsError = "";
        if ($scope.data.sampleRows.length === 0) {
            colsError += "No hay datos en la hoja excel.";
        } else {
            var linkCol = -1;
            for (var i = 0; i < 10; i++) {
                for (var j = 0; j < 10; j++) {
                    var cell = sheet[XLSX.utils.encode_cell({ r: i, c: j })];
                    if (typeof cell !== "undefined" && typeof cell.l !== "undefined") {
                        linkCol = j;
                        break;
                    }
                }
                if (linkCol !== -1) break;
            }
            if (linkCol !== -1) {
                angular.forEach($scope.data.sampleRows,
                    function (item, index) {
                        var cell = sheet[XLSX.utils.encode_cell({ r: index + 1, c: linkCol })];
                        if (typeof cell === "undefined" || typeof cell.l === "undefined") return;
                        var target = cell.l.Target;
                        item.Link = cell.l.Target;
                        if (typeof item.Carpeta === "undefined" || item.Carpeta.length === 0) {
                            var parts = target.split('/');
                            if (parts.length < 2) return;
                            item.Carpeta = parts[parts.length - 2];
                            item.Archivo = parts[parts.length - 1];
                        }
                    });
            }
        }
        if (colsError.length > 1) {
            alertService.addAlert("danger", "Error:" + colsError);
        }
        $scope.data.totalOk = 0;
        $scope.data.totalLeidos = 0;
        $scope.data.totalError = 0;
        var listaACheckMusica = [];
        angular.forEach($scope.data.sampleRows, function (item, index) {
            $scope.data.totalLeidos++;
            item.Lineas = item.Lineas || item.L;
            item.CdPista = item.CdPista || item.Nro;
            if (typeof item.CdPista !== "string") {
                item.estado = "Error: CdPista Incorrecto.";
                $scope.data.totalError++;
                return;
            }
            item.CdPista = item.CdPista.trim();
            if (item.CdPista.length !== 5) {
                item.estado = "Error: CdPista Incorrecto. Debe ser de la forma '00:00'";
                $scope.data.totalError++;
                return;
            }
            var nroCd = item.CdPista.substring(0, 2);
            nroCd = parseInt(nroCd);
            if (isNaN(nroCd)) {
                item.estado = "Error: CdPista Incorrecto. Debe ser de la forma '00:00'";
                $scope.data.totalError++;
                return;
            }
            item.nroCd = nroCd;

            var nroPista = item.CdPista.substring(3, 5);
            nroPista = parseInt(nroPista);
            if (isNaN(nroPista)) {
                item.estado = "Error: CdPista Incorrecto. Debe ser de la forma '00:00'";
                $scope.data.totalError++;
                return;
            }
            item.nroPista = nroPista;

            if (typeof item.Ejercicio !== "string") {
                item.estado = "Error: Columna Ejercicio Incorrecta.";
                $scope.data.totalError++;
                return;
            }
            item.Ejercicio = item.Ejercicio.trim();
            if (typeof item.Titulo !== "string" || item.Titulo === "") {
                item.Titulo = "Desconocido";
            }
            item.Titulo = item.Titulo.trim();

            if (typeof item.Interprete !== "string" || item.Interprete === "") {
                item.Interprete = "Desconocido";
            }
            item.Interprete = item.Interprete.trim();

            if (item.CdPista.length !== 5) {
                item.estado = "Error: CdPista Incorrecto. Debe ser de la forma '00:00'";
                $scope.data.totalError++;
                return;
            }
            //var ejercicio = loaderService.getEjercicio(item.Ejercicio);
            //if (typeof ejercicio === "undefined") {
            //    item.estado = "Error: Ejercicio inexistente. Debe agregar primero el ejercicio.";
            //    return;
            //}
            if (typeof item.Carpeta !== "string" || item.Carpeta.length < 1) {
                item.estado = "Error: Columna Carpeta Incorrecta.";
                $scope.data.totalError++;
                return;
            }
            if (typeof item.Archivo !== "string" || item.Archivo.length < 4) {
                item.estado = "Error: Columna Archivo Incorrecta.";
                $scope.data.totalError++;
                return;
            }
            for (var k = 0; k < $scope.equivalenciaEjercicios.length; k++) {
                var eq = $scope.equivalenciaEjercicios[k];
                if (item.Ejercicio.toLowerCase().indexOf(eq.Ejercicio.toLowerCase()) > -1) {
                    item.Ejercicio = eq.CorrespondeA;
                    break;
                }
            }
            for (var k = 0; k < $scope.equivalenciaInterpretes.length; k++) {
                var eq = $scope.equivalenciaInterpretes[k];
                if (item.Interprete.toLowerCase().indexOf(eq.Interprete.toLowerCase()) > -1) {
                    item.Interprete = eq.CorrespondeA;
                    break;
                }
            }
            item.grupo = item.grupo || item.Grupo;
            if (!item.grupo) {
                for (var k = 0; k < $scope.equivalenciaGrupo.length; k++) {
                    var eq = $scope.equivalenciaGrupo[k];
                    if (item.Ejercicio.toLowerCase().indexOf(eq.EjercicioContiene.toLowerCase()) > -1) {
                        item.grupo = eq.CorrespondeA;
                        break;
                    }
                }
            }
            item.grupo = item.grupo || "OTROS";
            listaACheckMusica.push(item);
        });
        musicasOk = [];
        checkMusicas(listaACheckMusica);
        if ($scope.data.sampleRows.length > 0) {
            var props = Object.keys($scope.data.sampleRows[0]);
            if (props.indexOf("Ejercicio") === -1) colsError += "No se encontro la columna Ejercicio.";
            if (props.indexOf("CdPista") === -1) colsError += "No se encontro la columna CdPista.";
            if (props.indexOf("Titulo") === -1) colsError += "No se encontro la columna Titulo.";
            if (props.indexOf("Interprete") === -1) colsError += "No se encontro la columna Interprete.";
            if (props.indexOf("Carpeta") === -1) colsError += "No se encontro la columna Carpeta.";
            if (props.indexOf("Archivo") === -1) colsError += "No se encontro la columna Archivo.";
        }
        if (colsError.length > 1) {
            alertService.addAlert("danger", "Error:" + colsError);
        }
        $rootScope.$broadcast('loadingStatusInactive');
        $scope.safeApply();
    };


    function checkMusicas(musicas) {
        $rootScope.$broadcast('loadingStatusActive');
        var item = musicas.shift();
        //if (item.CdPista === "61.16") debugger;
        if (!item) {
            checkNextMusica(musicas);
            return;
        }
        if (item.CdPista && musicasOk.includes(item.CdPista)) {
            item.estado = "ok";
            $scope.data.totalOk++;
            checkNextMusica(musicas);
            return;
        }
        var musica = { coleccion: $scope.data.coleccion.nombre, carpeta: item.Carpeta, archivo: item.Archivo };
        loaderService.testMusica(musica)
            .then(function (result) {
                if (result === true) {
                    item.estado = "ok";
                    item.duracion = musica.duracion;
                    musicasOk.push(item.CdPista);
                    $scope.data.totalOk++;
                }
                checkNextMusica(musicas);
            }, function (reject) {
                if (item.Link) { // para que reintente con el link
                    var parts = item.Link.split('/');
                    if (parts.length === 2) {
                        var musica = { coleccion: $scope.data.coleccion.nombre, carpeta: parts[parts.length - 2], archivo: parts[parts.length - 1] };
                        item.Carpeta = parts[parts.length - 2];
                        item.Archivo = parts[parts.length - 1];
                        delete item.Link;
                        musicas.push(item);
                    }
                } else {
                    item.estado = "Error. " + reject.e.message + "." + decodeURI(reject.src);
                    $scope.data.totalError++;
                }
                checkNextMusica(musicas);
            });

    }

    function checkNextMusica(musicas) {
        $scope.safeApply();
        if (musicas.length > 0) {
            checkMusicas(musicas);
        } else {
            $scope.data.validado = true;
            $rootScope.$broadcast('loadingStatusInactive');
            playerService.stop();
        }

    }

    $scope.safeApply = function (fn) {
        var phase = this.$root.$$phase;
        if (phase == '$apply' || phase == '$digest') {
            if (fn && (typeof (fn) === 'function')) {
                fn();
            }
        } else {
            this.$apply(fn);
        }
    };

    $scope.changeSheet = function (sheet) {
        $scope.data.validado = false;
        $scope.data.sampleRows = [];
        $scope.data.sheet = $scope.data.wb.Sheets[sheet];
        $scope.data.coleccion.hojaEjercicios = sheet;
        $scope.loadSheet();
    };

    function fixdata(data) {
        var o = "", l = 0, w = 10240;
        for (; l < data.byteLength / w; ++l)
            o += String.fromCharCode.apply(null, new Uint8Array(data.slice(l * w, l * w + w)));
        o += String.fromCharCode.apply(null, new Uint8Array(data.slice(o.length)));
        return o;
    }

    $scope.pickImportFile = function (fileImport) {
        var fileElementAng = angular.element(document.querySelector('#' + fileImport ));
        var fileElement = fileElementAng[0];
        fileElement.click();
    }

}]);
