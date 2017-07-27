var services = angular.module('services', []);

services.factory('contextService', ['$q', '$localStorage', '$uibModal', function ($q, $localStorage, $uibModal) {
    var context = {};

    context.config = function(cfg) {
        if (typeof cfg == 'undefined') {
            var config = $localStorage.biodanzaConfig;
            if (config == null) {
                config = { pathMusica:''}
            }
            return config;
        }
        $localStorage.biodanzaConfig = cfg;
    };

    context.saveClases = function() {
        $localStorage.biodanzaConfig = biodanzaClases;
    }
    context.nuevoEjercicioClase = function(clase) {
        var ej = angular.copy({ nro: clase.ejercicios.length + 1, ejercicio: null, musica: null, consigna: null, cometarios: null });
        clase.ejercicios.push(ej);
        context.saveClases();
    }

    context.nuevaClase = function() {
        var clase = angular.copy({ titulo: 'Nueva Clase', fechaCreacion: new Date(), fechaClase: new Date(), comentarios: '', ejercicios: [] });
        for (var f = 1; f < 11; f++) {
            context.nuevoEjercicioClase(clase);
        }
        biodanzaClases.unshift(clase);
        context.saveClases();
        return clase;
    }

    context.ejercicioMoveUp = function (clase, ejercicio) {
        if (ejercicio.nro === 1) return;
        var x = clase.ejercicios[ejercicio.nro - 2];
        clase.ejercicios[ejercicio.nro - 2] = clase.ejercicios[ejercicio.nro - 1];
        clase.ejercicios[ejercicio.nro - 1] = x;
        var nro = ejercicio.nro;
        clase.ejercicios[nro - 2].nro = nro - 1;
        clase.ejercicios[nro - 1].nro = nro;
        context.saveClases();
    }

    context.ejercicioMoveDown = function (clase, ejercicio) {
        if (ejercicio.nro === clase.ejercicios.length) return;
        var x = clase.ejercicios[ejercicio.nro];
        clase.ejercicios[ejercicio.nro] = clase.ejercicios[ejercicio.nro - 1];
        clase.ejercicios[ejercicio.nro - 1] = x;
        var nro = ejercicio.nro;
        clase.ejercicios[nro - 1].nro = nro;
        clase.ejercicios[nro].nro = nro + 1;
        context.saveClases();
    }

    context.deleteEjercicio = function(ejercicio) {
        ejercicio.ejercicio = null;
        context.saveClases();
    };

    context.deleteMusica = function(ejercicio) {
        ejercicio.musica = null;
        context.saveClases();
    };

    context.clases = function () {
        biodanzaClases = $localStorage.biodanzaClases;
        if (biodanzaClases == null) {
            biodanzaClases = [];
            biodanzaClases = [context.nuevaClase()];
        }
            
        return biodanzaClases;
    };

    //context.clases();

    var _clase = null;
    context.clase = function(value) {
        if (typeof value == 'undefined') {
            var value = _clase;
            if (value == null) {
                value = context.nuevaClase();
            }
            return value;
        }
        _clase = value;
    };

    context.playFn = null;
    context.play = function(musica) {
        this.playFn(musica);
    };

    context.modelEjercicios = {};
    context.modelEjercicios.select = false;
    context.modelEjercicios.grupos = db.grupos;
    context.modelEjercicios.ejercicios = db.ejercicios;
    context.musicaSeleccionada = {};
    context.modelEjercicios.ejercicio = {};
    context.modelEjercicios.grupo = 0;
    context.modelEjercicios.buscar = "";
    context.modelEjercicios.$uibModalInstance = null;

    context.modelEjercicios.ok = function (ejercicio) {
        context.modelEjercicios.$uibModalInstance.close(ejercicio);
    };


    context.modelEjercicios.cancel = function () {
        context.modelEjercicios.$uibModalInstance.dismiss('cancel');
    };

    context.modelEjercicios.playFile = function (musica) {
        context.play(musica);
    };

    context.modelEjercicios.isCollapsed = true;
    context.modelEjercicios.colWidth = "col-md-12";
    context.modelEjercicios.showGrupos = function () {
        context.modelEjercicios.isCollapsed = false;
        context.modelEjercicios.colWidth = "col-md-9";
    };

    context.modelEjercicios.hideGrupos = function () {
        context.modelEjercicios.isCollapsed = true;
        context.modelEjercicios.colWidth = "col-md-12";
    };

    context.modelEjercicios.filtrar = function (ejercicio) {
        if (context.modelEjercicios.grupo !== 0 && context.modelEjercicios.grupo !== ejercicio.idGrupo) return false;
        if (context.modelEjercicios.buscar === '') return true;
        var searchString = context.modelEjercicios.buscar.toUpperCase();
        if (ejercicio.nombre.toUpperCase().indexOf(searchString) !== -1) return true;
        if (ejercicio.grupo.toUpperCase().indexOf(searchString) !== -1) return true;
        var ok = false;
        angular.forEach(ejercicio.musicas,
            function (value) {
                if (ok) return;
                if (value.nombre.toUpperCase().indexOf(searchString) > -1) ok = true;
                if (value.interprete.toUpperCase().indexOf(searchString) > -1) ok = true;
            });
        return ok;
    };

    context.modelEjercicios.filtrarMusica = function (musica, ejercicio) {
        if (context.modelEjercicios.buscar === '') return true;
        var searchString = context.modelEjercicios.buscar.toUpperCase();
        if (ejercicio.nombre.toUpperCase().indexOf(searchString) !== -1) return true;
        if (ejercicio.grupo.toUpperCase().indexOf(searchString) !== -1) return true;

        if (musica.nombre.toUpperCase().indexOf(searchString) > -1) return true;
        if (musica.interprete.toUpperCase().indexOf(searchString) > -1) return true;
        return false;
    }


    context.modelEjercicios.mostrarEjercicio = function (ejercicio) {
        context.modelEjercicios.ejercicio = ejercicio;
        var modalInstance = $uibModal.open({
            animation: true,
            ariaLabelledBy: 'modal-title',
            ariaDescribedBy: 'modal-body',
            templateUrl: 'modalEjercicio.html',
            controller: 'modalEjercicioController',
            size: 'lg',
            resolve: {
                model: function () {
                    return context.modelEjercicios;
                }
            }
        });
    }


    return context;
}]);

