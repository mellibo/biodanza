var services = angular.module('services', []);

services.factory('contextService', ['$q', '$localStorage', function ($q, $localStorage) {
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

    context.nuevoEjercicioClase = function(clase) {
        var ej = angular.copy({ nro: clase.ejercicios.length + 1, ejercicio: db.ejercicios[Math.floor((Math.random() * 100) + 1)], musica: db.musicas[Math.floor((Math.random() * 1000) + 1)], consigna: null, cometarios: null });
        clase.ejercicios.push(ej);
    }

    context.nuevaClase = function() {
        var clase = angular.copy({ titulo: '', fechaCreacion: new Date(), fechaClase: new Date(), comentarios: '', ejercicios: [] });
        for (var f = 1; f < 11; f++) {
            context.nuevoEjercicioClase(clase);
        }
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
    }

    context.ejercicioMoveDown = function (clase, ejercicio) {
        if (ejercicio.nro === clase.ejercicios.length) return;
        var x = clase.ejercicios[ejercicio.nro];
        clase.ejercicios[ejercicio.nro] = clase.ejercicios[ejercicio.nro - 1];
        clase.ejercicios[ejercicio.nro - 1] = x;
        var nro = ejercicio.nro;
        clase.ejercicios[nro - 1].nro = nro;
        clase.ejercicios[nro].nro = nro + 1;
    }

    context.clases = function(value) {
        if (typeof value == 'undefined') {
            var value = $localStorage.biodanzaClases;
            if (value == null) {
                value = [context.nuevaClase()];
            }
            return value;
        }
        $localStorage.biodanzaClases = value;
    };

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

    return context;
}]);

