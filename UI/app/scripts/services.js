﻿var services = angular.module('services', []);

services.factory('contextService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', '$location', '$rootScope', 'loaderService', function ($q, $localStorage, $uibModal, NgTableParams, $filter, $location, $rootScope, loaderService) {
    var context = {};

    context.isMobileOrTablet = function () { return ismobile || istablet };
    return context;
}]);


services.factory('modelEjerciciosService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', 'playerService', 'contextService', function ($q, $localStorage, $uibModal, NgTableParams, $filter, playerService, contextService) {

    var service = {
        txtBuscarChange: function () {
            service.tableParams.page(1);
            if (ismobile || istablet) return;
                service.refreshGrid();
        },
        refreshGrid: function () {
            service.tableParams.reload();
        },
        reset: function () {
            service.tableParams.page(1);
            service.grupo = 'TODOS';
            service.buscar = "";
        },
        isMobileOrTablet: contextService.isMobileOrTablet(),
        tableParams: new NgTableParams({ count: 15 },
        {
            total: db.ejercicios ? db.ejercicios.length: 0,
            getData: function (params) {
                var orderedData = buscarEjercicios();
                var ejercicios = orderedData.slice((params
                        .page() -
                        1) *
                    params.count(),
                    params.page() * params.count());
                
                params.total(orderedData.length);
                return ejercicios;
            }
        })
    };

    function buscarEjercicios() {
        if (service.buscar === "" && service.grupo === 'TODOS') return db.ejercicios; 
        var searchStrings = service.buscar.toUpperCase().split(" ");
        var i;
        for (i = 0; i < searchStrings.length; i++) {
            searchStrings[i] = searchStrings[i].normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
        }
        searchStrings = $filter('filter')(searchStrings, (obj) => { return obj !== "" });
        var search = [];
        for (var j = 0; j < db.ejercicios.length; j++) {
            var ejercicio = db.ejercicios[j];
            var rank = 0;
            if (service.grupo !== "TODOS" &&
                service.grupo !== ejercicio.grupo) continue;;
            for (i = 0; i < searchStrings.length; i++) {
                if (ejercicio.nombreNormalized.indexOf(searchStrings[i]) !== -1) rank++;
                if (ejercicio.grupoNormalized.indexOf(searchStrings[i]) !== -1) rank++;
                for (var l = 0; l < ejercicio.musicas.length; l++) {
                    var musica = ejercicio.musicas[l];
                    if (musica.nombre.toUpperCase().indexOf(searchStrings[i]) > -1) { rank++; break;}
                    if (musica.interprete.toUpperCase().indexOf(searchStrings[i]) > -1) {
                         rank++; break;
                    }
                }
            }
            if (rank > 0) search.push({ rank: rank, ejercicio: ejercicio });
        }
        search.sort((a, b) => { return b.rank - a.rank });
        var result = [];
        for (i = 0; i < search.length; i++) {
            result.push(search[i].ejercicio);
        }
        return result;

    }

    service.select = false;
    service.grupos = db.grupos;
    //service.ejercicios = db.ejercicios;
    service.ejercicio = {};
    service.grupo = "TODOS";
    service.buscar = "";
    service.$uibModalInstance = null;

    service.ok = function (ejercicio, musica) {
        service.reset();
        service.$uibModalInstance.close([ejercicio, musica]);
    };


    service.cancel = function () {
        service.reset();
        service.$uibModalInstance.dismiss('cancel');
    };

    service.playFile = function (musica) {
        playerService.playFile(musica);
    };

    service.isCollapsed = true;
    service.colWidth = "col-md-12";
    service.showGrupos = function () {
        service.isCollapsed = false;
        service.colWidth = "col-md-9";
    };

    service.hideGrupos = function () {
        service.isCollapsed = true;
        service.colWidth = "col-md-12";
    };

    service.filtrarMusica = function (musica, ejercicio) {
        if (service.buscar === '') return true;

        var searchStrings = service.buscar.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(" ");
        for (var i = 0; i < searchStrings.length; i++) {
            if (searchStrings[i] === '') continue;
            if (ejercicio.nombreNormalized.indexOf(searchStrings[i]) !== -1) return true;
            if (ejercicio.grupo.indexOf(searchStrings[i]) !== -1) return true;

            if (musica.nombreNormalized.indexOf(searchStrings[i]) > -1) return true;
            if (musica.interpreteNormalized.indexOf(searchStrings[i]) > -1) return true;

        }
        return false;
    }


    service.mostrarEjercicio = function (ejercicio) {
        service.ejercicio = ejercicio;
        var modalInstance = $uibModal.open({
            animation: true,
            keyboard: false,
            ariaLabelledBy: 'modal-title',
            ariaDescribedBy: 'modal-body',
            templateUrl: 'modalEjercicio.html',
            controller: 'modalEjercicioController',
            size: 'lg',
            resolve: {
                model: function () {
                    return service;
                }
            }
        });
    }
        return service;
    }
]);

services.factory('modelMusicaService', ['$q', '$localStorage', '$uibModal', 'NgTableParams', '$filter', 'playerService', 'loaderService',
function ($q, $localStorage, $uibModal, NgTableParams, $filter, playerService, loaderService) {

    var pesoColeccion = 50;
    var pesoTitulo = 10;
    var pesoEjercicio = 10;
    var pesoCdPista = 30;
    var pesoLineas = 20;
    var pesoTag = 5;
    var factorLengthMenor4 = .25;

    function addRank(match, peso) {
        var ret = 0;
        if (match) {
            for (var j = 0; j < match.length; j++) {
                ret += peso * (match[j].length < 4 ? factorLengthMenor4 : 1);
            }
        }
        return ret;
    }

    function buscarMusicas(searchStringsEjercicio, filter) {
        var inicio = moment(new Date());
        var search = [];
        var i;
        if (searchStringsEjercicio.length === 0) {
            if ((!filter.coleccion ||
                filter.coleccion.length === 0) &&
                (!filter.nroCd ||
                filter.nroCd.length === 0) &&
                (!filter.nombre ||
                filter.nombre.length === 0) &&
                (!filter.lineas ||
                filter.lineas.length === 0)) return db.musicas;
        }
        var regStr = "(";
        var sep = "";
        var regexEj;
        var searchStringsEjercicioFiltered = $filter('filter')(searchStringsEjercicio, (obj) => { return obj.length > 3; });

        if (searchStringsEjercicioFiltered.length > 0) {
            for (var m = 0; m < searchStringsEjercicioFiltered.length; m++) {
                regStr += sep + searchStringsEjercicioFiltered[m];
                sep = "|";
            }
            regStr += ")";
            regexEj = new RegExp(regStr, "g");
        }

        var regexTitulo;
        if (filter.nombre && filter.nombre.length > 0) {
            var searchStrings = filter.nombre.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").split(" ");
            searchStrings = $filter('filter')(searchStrings, (obj) => { return obj !== ""; });
            regStr = "(";
            sep = "";
            for (var m = 0; m < searchStrings.length; m++) {
                regStr += sep + searchStrings[m];
                sep = "|";
            }
            regStr += ")";
            regexTitulo = new RegExp(regStr,"g");
        }
        var checkedEjercicios = [];
        for (i = 0; i < db.musicas.length; i++) {
            var musica = db.musicas[i];
            if (musica.nombreNormalized === "LIBERTANGO") {
                console.log();
            }
            var rank = 0;
            var match;
            if (regexEj) {
                for (var l = 0; l < musica.ejerciciosId.length; l++) {
                    var rankEje;
                    if (checkedEjercicios[musica.ejerciciosId[l]]) {
                        rank += checkedEjercicios[musica.ejerciciosId[l]];
                        break;
                    }
                    var ejercicio = loaderService.getEjercicioById(musica.ejerciciosId[l]);
                    if (!ejercicio) continue;
                    rankEje = 0;
                    match = ejercicio.nombreNormalized.match(regexEj);
                    rankEje += addRank(match, pesoEjercicio);
                    match = ejercicio.grupoNormalized.match(regexEj);
                    rankEje += addRank(match, pesoEjercicio);
                    rank += rankEje;
                    //var a = moment(new Date());
                    checkedEjercicios[musica.ejerciciosId[l]] = rankEje;
                    //var b = moment(new Date());
                    //console.log(moment.duration(b.diff(a)).asMilliseconds());
                    if (rankEje > 0) break;
                }
            }
            if (filter.coleccion && filter.coleccion.length > 0) {
                if (musica.coleccion.indexOf(filter.coleccion.toUpperCase()) !== -1) rank += pesoColeccion;
            }
            if (filter.nroCd && filter.nroCd.length > 0) {
                if (musica.cdPista.indexOf(filter.nroCd.toUpperCase()) !== -1) rank += pesoCdPista;
            }
            if (filter.nombre && filter.nombre.length > 0) {
                match = musica.nombreNormalized.match(regexTitulo);
                if (!match) match = musica.archivo.match(regexTitulo);
                if (!match) match = musica.carpeta.match(regexTitulo);
                rank += addRank(match, pesoTitulo);
                match = musica.interpreteNormalized.match(regexTitulo);
                rank += addRank(match, pesoTitulo);
                if (musica.tags) {
                    match = musica.tags.match(regexTitulo);
                    if (!match) match = musica.tags.match(regexEj);
                    rank += addRank(match, pesoTag);
                }
            }
            if (filter.lineas && filter.lineas.length > 0) {
                if (!musica.lineas || musica.lineas.indexOf(filter.lineas.toUpperCase()) !== -1) rank += pesoLineas;
            }
            if (rank > 0) {
                search.push({ rank: rank, musica: musica });
            }
        }
        search.sort((a, b) => { return b.rank - a.rank });
        //console.log(search);
        var result = [];
        for (i = 0; i < search.length; i++) {
            if (i>100) break;
            result.push(search[i].musica);
        }
        var fin = moment(new Date());
        console.log(moment.duration(fin.diff(inicio)).asMilliseconds());
        return result;
    }

        var service = {
            ejercicios: db.ejercicios,
            //ejercicio: {},
            ejercicioTextFilter: "",
            ejerciciosNombre: [],
            refreshGrid: function() {
                service.tableParams.reload();
            },
            getEjercicioById: (id) => {
                return loaderService.getEjercicioById(id);
            },
            select: false,
            $uibModalInstance: null,
            cleanSearch: () => {
                service.tableParams.page(1);
                service.tableParams.filter({});
            },
            ok: function (musica) {
                service.cleanSearch();
                service.$uibModalInstance.close(musica);
            },
            cancel: function() {
                service.cleanSearch();
                service.$uibModalInstance.dismiss('cancel');
            },
            tableParams: new NgTableParams({ count: 15 },
            {
                total: db.musicas.length,
                getData: function (params) {
                    var searchStrings = service.ejercicioTextFilter.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").match(/\w+|"[^"]+"/g);
                    if (!searchStrings) searchStrings = [];
                    for (var l = 0; l < searchStrings.length; l++) {
                        searchStrings[l] = searchStrings[l].replace(/\"/g, "");
                    }
                    var orderedData = buscarMusicas(searchStrings, params.filter());
                    var musicas = orderedData.slice((params
                            .page() -
                            1) *
                        params.count(),
                        params.page() * params.count());

                    params.total(orderedData.length); // set total for recalc pagination
                    return musicas;
                }
            }),
            playFile: function(musica) {
                playerService.playFile(musica);
            }
        };

        angular.forEach(db.ejercicios,
            function(value) {
                service.ejerciciosNombre.push(value.nombre);
            });
    return service;
}]);

