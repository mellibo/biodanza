
app.controller('cargarEjerciciosController', ['$scope', 'downloadService', 'modelEjerciciosService', '$rootScope', '$window', '$location', 'loadJsService', 'loaderService', '$uibModal', 'NgTableParams', 'alertService', '$localStorage', function ($scope, downloadService, modelEjerciciosService, $rootScope, $window, $location, loadJsService, loaderService, $uibModal, NgTableParams, alertService, $localStorage) {
    $scope.mostrarEjercicio = modelEjerciciosService.mostrarEjercicio;

    $scope.export = () => {
        var wb = XLSX.utils.book_new();
        wb.Props = {
            Title: "Biosoft Ejercicios",
            Subject: "Biosoft Ejercicios",
            Author: "Biosoft",
            CreatedDate: new Date()
        };
        wb.SheetNames.push("Ejercicios");
        var aoa = [];
        var header = ["Coleccion", "Ejercicio", "Grupo", "Detalle"];
        aoa.push(header);
        angular.forEach(db.ejercicios,
            (ejercicio) => {
                var arr = [
                    ejercicio.coleccion, ejercicio.nombre, ejercicio.grupo, (ejercicio.detalle || "")
                    .replace(/<br\/>/g, "\r\n")
                ];
                aoa.push(arr);
            });
        var ws = XLSX.utils.aoa_to_sheet(aoa);
        wb.Sheets["Ejercicios"] = ws;
        var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
        var blob = new Blob([s2ab(wbout)], { type: "application/octet-stream" });
        downloadService.downloadBlob(blob, "Ejercicios.xlsx");
    }

    function s2ab(s) {
        var buf = new ArrayBuffer(s.length); //convert s to arrayBuffer
        var view = new Uint8Array(buf);  //create uint8array as viewer
        for (var i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF; //convert to octet
        return buf;
    }
    $scope.data = {
        wb: null,
        sheets: [],
        sampleRows: [],
        tableParams: new NgTableParams({ count: 15 }),
        totalOk: 0,
        totalNuevos: 0,
        totalEliminados: 0,
        totalModificados: 0,
        totalSinCambios: 0,
        totalError: 0,
        validado: false,
        excel: "",
        hojaEjercicios: "Ejercicios"
    };

    $scope.leerEjercicios = function (file) {
        var f = file.files[0];
        $scope.data.excel = f.name.substring(0, f.name.indexOf("."));

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
            $scope.data.sheet = $scope.data.wb.Sheets[$scope.data.wb.SheetNames[0]];
            //sheet['!ref'] = "A1:L11";
            $scope.loadSheet();
        };
        if (rABS) reader.readAsBinaryString(f);
        else reader.readAsArrayBuffer(f);
        angular.element(document.querySelector('#fileImport')).val(null);
        return;
    };

    $scope.loadSheet = function () {
        $rootScope.$broadcast('loadingStatusActive');
        $scope.data.validado = false;
        var sheet = $scope.data.sheet;
        $scope.data.sampleRows = XLSX.utils.sheet_to_json(sheet);
        console.log($scope.data.sampleRows);
        $scope.data.tableParams = new NgTableParams({ count: 10 }, { dataset: $scope.data.sampleRows });
        var colsError = "";
        if ($scope.data.sampleRows.length === 0) {
            colsError += "No hay datos en la hoja excel.";
        } 
        if (colsError.length > 1) {
            alertService.addAlert("danger", "Error:" + colsError);
        }
        $scope.data.totalOk = 0;
        $scope.data.totalNuevos = 0;
        $scope.data.totalEliminados = 0;
        $scope.data.totalModificados = 0;
        $scope.data.totalSinCambios = 0;
        $scope.data.totalError = 0;
        var props = Object.keys($scope.data.sampleRows[0]);
        if (props.indexOf("Ejercicio") === -1) colsError += "No se encontro la columna Ejercicio.";
        if (props.indexOf("Grupo") === -1) colsError += "No se encontro la columna Grupo.";
        if (props.indexOf("Coleccion") === -1) colsError += "No se encontro la columna Coleccion.";
        if (props.indexOf("Detalle") === -1) colsError += "No se encontro la columna Detalle.";
        if (colsError.length > 1) {
            alertService.addAlert("danger", "Error:" + colsError);
        }
        angular.forEach($scope.data.sampleRows, function (item, index) {
            $scope.data.totalLeidos++;
            item.Grupo = item.Grupo || "Otros";
            item.grupo = item.Grupo;
            delete item.Grupo;
            item.coleccion = item.Coleccion || "";
            delete item.Coleccion;
            item.nombre = item.Ejercicio || "";
            delete item.Ejercicio;
            item.detalle = item.Detalle.replace(/\r\n/g, "<br/>") || "";
            delete item.Detalle;
            if (item.nombre === "") {
                item.estado = "error: falta nombre ejercicio.";
                $scope.data.totalError++;
                return;
            }
            var dbEj = loaderService.getEjercicio(item.nombre);
            if (typeof dbEj === "undefined") {
                item.estado = "Nuevo.";
                $scope.data.totalNuevos++;
                if (item.detalle === "") item.estado += "Si detalle.";
                return;
            }
            
            if (item.grupo !== dbEj.grupo) {
                $scope.data.totalModificados++;
                item.estado = "Cambio de Grupo.";
                return;
            }
            if (item.detalle !== dbEj.detalle & !(dbEj.detalle === null & item.detalle ==="") ) {
                $scope.data.totalModificados++;
                item.estado = "Cambio de Detalle.";
                return;
            }
            if (item.coleccion !== dbEj.coleccion) {
                $scope.data.totalModificados++;
                item.estado = "Cambio de Colección.";
                return;
            }
            item.estado = "Igual.";
            $scope.data.totalSinCambios++;
        });
        angular.forEach(db.ejercicios, (ejercicio) => {
            var ejeNuevo = $scope.data.sampleRows.filter((n) => n.nombre === ejercicio.nombre);
            if (ejeNuevo.length === 0) {
                $scope.data.totalEliminados++;
                var eje = {
                    nombre: ejercicio.nombre,
                    grupo: ejercicio.grupo,
                    coleccion: ejercicio.coleccion,
                    detalle: ejercicio.detalle,
                    estado: "Eliminado"
                };

                $scope.data.sampleRows.push(eje);
            }
        });
        $scope.data.validado = true;
        $rootScope.$broadcast('loadingStatusInactive');
        $scope.safeApply();
    };

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
        $scope.data.hojaEjercicios = sheet;
        $scope.data.sampleRows = [];
        $scope.data.sheet = $scope.data.wb.Sheets[sheet];
        $scope.loadSheet();
    };

    function fixdata(data) {
        var o = "", l = 0, w = 10240;
        for (; l < data.byteLength / w; ++l)
            o += String.fromCharCode.apply(null, new Uint8Array(data.slice(l * w, l * w + w)));
        o += String.fromCharCode.apply(null, new Uint8Array(data.slice(o.length)));
        return o;
    }

    $scope.pickImportFile = function () {
        var fileElementAng = angular.element(document.querySelector('#fileImport'));
        var fileElement = fileElementAng[0];
        fileElement.click();
    }

    $scope.import = (nuevos, modificados, eliminados) => {
        angular.forEach($scope.data.sampleRows, (ej) => {
            var dbEj = loaderService.getEjercicio(ej.nombre);
            if (nuevos & ej.estado.substring(0, 5) === "Nuevo") {
                var ejercicio = {
                    nombre: ej.nombre,
                    grupo: ej.grupo,
                    coleccion: ej.coleccion,
                    detalle: ej.detalle,
                    musicasId: []
                };
                loaderService.addEjercicio(ejercicio);
            }
            if (modificados & ej.estado.substring(0, 6) === "Cambio") {
                dbEj.grupo = ej.grupo;
                dbEj.detalle = ej.detalle;
                dbEj.coleccion = ej.coleccion;
            }
            if (eliminados & ej.estado.substring(0, 9) === "Eliminado") {
                var index = db.ejercicios.indexOf(dbEj);
                db.ejercicios.splice(index, 1);
            }
        });
        loaderService.saveEjercicios();
    }
}]);
