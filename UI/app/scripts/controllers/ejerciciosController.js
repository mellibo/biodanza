app.controller('ejerciciosController', ['$scope', 'loaderService', '$rootScope', '$window', '$location', 'contextService', 'modelEjerciciosService', '$uibModal', function ($scope, loaderService, $rootScope, $window, $location, contextService, modelEjerciciosService, $uibModal) {
    loaderService.colecciones().then(function () {
        $scope.modelEjercicios = modelEjerciciosService;
    });

    if (typeof loaderService.config().pathMusica == "undefined" | loaderService.config().pathMusica === "") {
        $location.path("/config");
    }
}]);

app.controller('modalEjercicioController', ['$scope', '$window', '$location', 'loaderService', '$uibModalInstance', 'model', 'playerService', function ($scope, $window, $location, loaderService, $uibModalInstance, model, playerService) {
    loaderService.colecciones().then(function () {
        $scope.ejercicio = model.ejercicio;
        $scope.model = model;
    });
    $scope.playMusica = function(musica) {
        playerService.playFile(musica);
    }
    $scope.aceptar = function () {
        $uibModalInstance.close();
    }
}]);

app.controller('musicasController', ['$scope', 'loaderService', '$location', 'contextService', 'modelMusicaService', '$uibModal', 'NgTableParams', function ($scope, loaderService, $location, contextService, modelMusicaService, $uibModal, NgTableParams) {
    loaderService.colecciones().then(function () {
        $scope.modelMusicas = modelMusicaService;
        $scope.isMobileOrTablet = contextService.isMobileOrTablet();
    });
}]);

app.controller('configController', ['$scope', '$window', '$location', 'loaderService', '$uibModal', 'NgTableParams', function ($scope, $window, $location, loaderService, $uibModal, NgTableParams) {
    $scope.config = loaderService.config();

    $scope.grabar = function () {
        if ($scope.config.pathMusica[$scope.config.pathMusica.length - 1] !== "/") $scope.config.pathMusica += "/";
        loaderService.config($scope.config);
    }

    $scope.data = { wb: null, sheets: [] };
    $scope.importarColeccion = function (file) {
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

            $scope.data.wb = XLSX.read(data, readtype);
            $scope.data.sheets = $scope.data.wb.SheetNames;
            console.log($scope.data.sheets);
            $scope.$apply();
        };
        if (rABS) reader.readAsBinaryString(f);
        else reader.readAsArrayBuffer(f);
    }

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

}]);

app.controller('clasesController', ['$scope', '$window', '$location', 'loaderService', '$uibModal', 'NgTableParams', 'clasesService', function ($scope, $window, $location, loaderService, $uibModal, NgTableParams, clasesService) {
    loaderService.colecciones().then(function () {
        $scope.clases = clasesService.clases();
        $scope.tableParams = new NgTableParams({ count: 15 }, { dataset: $scope.clases });

        $scope.vistaCompacta = true;
        $scope.fechaClase = { opened: false, open: function () { $scope.fechaClase.opened = true } };
    });
    $scope.nueva = function () {
        clasesService.nuevaClase();
        $location.path('/clase/0');
    }

    $scope.delete = function (clase) {
        clasesService.deleteClase(clase);
        $scope.tableParams.reload();
        //$scope.clases = contextService.clases();
    }

    $scope.exportarClases = function () {
        clasesService.exportarClases();
    }

    $scope.importarClases = function (file) {
        clasesService.importarClases(file.files[0]);
        $scope.tableParams = new NgTableParams({ count: 15 }, { dataset: $scope.clases });
        $scope.tableParams.reload();
    }

    $scope.pickImportFile = function () {
        var fileElementAng = angular.element(document.querySelector('#fileImport'));
        var fileElement = fileElementAng[0];
        fileElement.click();
    }

    $scope.exportar = function (clase) {
        clasesService.exportarClase(clase);
    }

    $scope.grabar = function() {
        clasesService.saveClases();
    };

    $scope.editarClase = function(clase) {
        var index = $scope.clases.indexOf(clase);
        if (index > -1) {
            $location.path('/clase/' + index);
        }
    }
}]);

app.controller('claseController',
[
    '$scope', '$window', '$location', 'loaderService', '$uibModal', 'NgTableParams', 'id', 'playerService',
    'modelEjerciciosService', '$interval', 'clasesService',
    function($scope,
        $window,
        $location,
        loaderService,
        $uibModal,
        NgTableParams,
        id,
        playerService,
        modelEjerciciosService,
        $interval,
        clasesService) {
        $scope.clase = clasesService.clases()[id];
        $scope.player = playerService;

        if (!$scope.clase) {
            $location.path("/clases");
            return;
        }

        loaderService.colecciones().then(function () {
            angular.forEach($scope.clase.ejercicios,
                function (ejercicio) {
                    clasesService.calculaTiempoEjercicio(ejercicio);
                });

            $scope.tiempoTotalString = "";
            $scope.refreshTotalClase();
            playerService.clase = $scope.clase;
            $scope.horaFin = "";
            $scope.vistaPlayer = false;
            $scope.mostrarEjercicio = modelEjerciciosService.mostrarEjercicio;

            $scope.tableParams = new NgTableParams({ count: 30 }, { counts: [], dataset: $scope.clase.ejercicios });
        });


        $scope.refreshTotalClase = function() {
            var total = moment.duration();
            angular.forEach($scope.clase.ejercicios,
                function(ejercicio) {
                    if (!ejercicio.deshabilitado) {
                        clasesService.calculaTiempoEjercicio(ejercicio);
                        total.add(ejercicio.tiempo);
                    }
                });
            $scope.tiempoTotal = total;
            $scope.tiempoTotalString = moment(0, 's').add(total).format("H:mm:ss");
            $scope.horaFin = moment(0, 's').add(playerService.tiempoRestanteClase).format("H:mm:ss");
            $scope.clase.tiempo = total;
        }


        $scope.exportar = function(clase) {
            clasesService.exportarClase(clase);
        }


        $scope.$watch('vistaPlayer',
            function(newVal, oldVal) {
                if ($scope.intervalHoraFin) $interval.cancel($scope.intervalHoraFin);
                if (newVal === true) {
                    $scope.intervalHoraFin = $interval($scope.tiempoRestanteClase, 30000);
                    $scope.tiempoRestanteClase();
                }
            });

        $scope.tiempoRestanteClase = function() {
            $scope.horaFin = moment().add(playerService.tiempoRestanteClase()).format("HH:mm");
            if ($scope.$$phase !== "$apply" && $scope.$$phase !== "$digest") $scope.$apply();
        }
        $scope.insertar = function(ejercicio) {
            clasesService.insertarEjercicio($scope.clase, ejercicio);
        };
        $scope.rowClick = function(ejercicio) {
            if ($scope.vistaPlayer === false) return;
            $scope.playEjercicio(ejercicio);
        };
        $scope.selected = function(ejercicio) {
            return playerService.playIndex === ejercicio.nro - 1 ||
            (ejercicio.musica !== null &&
                $scope.player.currentPlaying !== null &&
                ejercicio.musica.nombre === $scope.player.currentPlaying.nombre);
        };
        $scope.playAll = function() {
            $scope.player.playContinuo = true;
            $scope.player.playAll();
        };

        $scope.grabar = function() {
            $scope.refreshTotalClase();
            clasesService.saveClases();
        };

        $scope.fechaClase = { opened: false, open: function() { $scope.fechaClase.opened = true } };

        $scope.deleteEjercicioClase = function(ejercicio) {
            clasesService.deleteEjercicioClase($scope.clase, ejercicio);
        }

        $scope.nuevoEjercicio = function() {
            clasesService.nuevoEjercicioClase($scope.clase);
        }
        $scope.moveUp = function(ejercicio) {
            clasesService.ejercicioMoveUp($scope.clase, ejercicio);
        }

        $scope.moveDown = function(ejercicio) {
            clasesService.ejercicioMoveDown($scope.clase, ejercicio);
        }

        $scope.playEjercicio = function(ejercicio) {
            playerService.playEjercicio(ejercicio);
        };

        $scope.deleteEjercicio = function(ejercicio) {
            clasesService.deleteEjercicio(ejercicio);
        }

        $scope.deleteMusica = function(ejercicio) {
            clasesService.deleteMusica(ejercicio);
        }

        $scope.cerrar = function() {
            playerService.clase = undefined;
            $window.history.back();
        }

        $scope.detalleEjercicioClase = function(ejercicio) {
            var modalInstance = $uibModal.open({
                templateUrl: 'popupEjercicioClase.html',
                controller: detalleEjercicioClaseController,
                size: 'md'
                //, windowClass: 'modalEjercicioClase'
                ,
                resolve: {
                    ejercicio: function() {
                        return ejercicio;
                    },
                    parentScope: function() {
                        return $scope;
                    }
                }
            });
            modalInstance.result.then(function() {
            });
        };

        var detalleEjercicioClaseController = [
            '$scope', '$uibModalInstance', 'NgTableParams', 'contextService', 'modelMusicaService', 'ejercicio',
            'parentScope', function($scope,
                $uibModalInstance,
                NgTableParams,
                contextService,
                modelMusicaService,
                ejercicio,
                parentScope) {
                $scope.parentScope = parentScope;
                $scope.ejercicio = ejercicio;
                $scope.grabar = parentScope.grabar;

                $scope.aceptar = function() {
                    $uibModalInstance.close();
                }
                $scope.playFile = function() {
                    playerService.playFile($scope.ejercicio.musica, $scope.ejercicio);
                };

            }
        ];

    }
]);

app.controller('headerController', ['$scope', '$rootScope', '$window', '$location', 'contextService', function ($scope, $rootScope, $window, $location, contextService) {
    $scope.isActive = function (route) {
        $scope.usuario = contextService.usuario;
        return $location.path().startsWith(route);
    };
}]);

app.controller('audioController', ['$scope', '$rootScope', '$window', '$location', 'contextService', 'playerService', function ($scope, $rootScope, $window, $location, contextService, playerService) {
    $scope.player = playerService;
    $scope.kk = function() {
        contextService.exportarClase(contextService.clases()[0]);
    };
}]);

app.controller('aboutController', ['$scope', function($scope) {
    $scope.mail = "biodanza" + "@" + "arsoft.com.ar";
}]);

app.controller('importMusicaController', ['$scope', 'contextService', 'NgTableParams', function ($scope, contextService, NgTableParams) {
    $scope.data = [];
    $scope.importarMusica = function (file) {
        contextService.importarMusicas(file.files[0], $scope.refresh);
            $scope.tableParams = new NgTableParams({ count: 15 }, { dataset: $scope.data });
        $scope.tableParams.reload();
    }

    $scope.pickImportFile = function () {
        var fileElementAng = angular.element(document.querySelector('#fileImport'));
        var fileElement = fileElementAng[0];
        fileElement.click();
    }

    $scope.refresh = function (data) {
        $scope.data.splice(0, $scope.data.length);
        angular.forEach(data, function(item) { $scope.data.push(item); });
        $scope.tableParams.reload();
        if ($scope.$$phase !== "$apply" && $scope.$$phase !== "$digest") $scope.$apply();
    }
}]);

app.controller('agregarMusicaManualController', ['$scope', 'contextService', 'testMusicaService', function ($scope, contextService, testMusicaService) {

    $scope.model = {
        message: ""
        , valid : false
        , musica : contextService.nuevaMusica()
        , validar:function () {
            testMusicaService.test($scope.model.musica,
                function(result) {
                    $scope.model.message = result.msg;
                    $scope.model.valid = result.ok;
                    if ($scope.$$phase !== "$apply" && $scope.$$phase !== "$digest") $scope.$apply();
                });
        }
        , importar : function() {
            db.miMusica.push($scope.model.musica);
            $scope.model.musica = contextService.nuevaMusica();
            contextService.exportMiMusica();
        }
        , change: function () { $scope.model.valid = false; }
        , updLineas: function() {
            $scope.model.musica.lineas = ($scope.model.lineas.V === true
                    ? "V"
                    : "") +
                ($scope.model.lineas.A === true
                    ? "A"
                    : "") +
                ($scope.model.lineas.C === true
                    ? "C"
                    : "") +
                ($scope.model.lineas.S === true ? "S" : "") +
                ($scope.model.lineas.T === true ? "T" : "");
            $scope.model.change();
        }
    };
}]);
