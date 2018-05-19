services.factory('playerService',
[
    'loaderService', '$document', '$rootScope', '$interval', '$filter', '$timeout',
function (loaderService, $document, $rootScope, $interval, $filter, $timeout) {

    var audioElementAng = angular.element(document.querySelector('#audioControl'));
    var audio = audioElementAng[0];

    var timeoutEmpalme = null;
    var timeoutFinProgresivo = null;
    var service = {
        play: function () {
            if (audio.currentTime === 0 && service.clase &&
                service.currentPlaying === service.clase.ejercicios[service.playIndex].musica) {
                service.playEjercicio(service.clase.ejercicios[service.playIndex]);
                return;
            }
            audio.play();
        },
        pause: function () {
            audio.pause();
        },
        clase: null,
        tiempoRestanteClase: function () {
            if (!service.clase) return moment.duration(0, 's');
            if (service.playIndex < 0) return service.clase.tiempo;
            var total = moment.duration();
            for (var i = service.playIndex + 1; i < service.clase.ejercicios.length; i++) {
                total.add(service.clase.ejercicios[i].tiempo);
            }
            var ejActual = service.clase.ejercicios[service.playIndex];

            var tiempoEjercicio = moment.duration(ejActual.tiempo);
            if (ejActual.minutosAdicionales > 0) tiempoEjercicio.subtract(ejActual.minutosAdicionales, 'm');
            tiempoEjercicio.subtract(audio.currentTime, 's');
            total.add(tiempoEjercicio);
            return total;
        },
        playIndex: -1,
        playFromList: function () {
            //if (service.playList.length - 1 < service.playIndex) service.playIndex = 0;
            if (service.clase && service.clase.ejercicios.length - 1 >= service.playIndex) {
                audio.repeatCount = undefined;
                service.playFile(service.clase.ejercicios[service.playIndex].musica,
                    service.clase.ejercicios[service.playIndex]);
            }
        },
        playNext: function () {
            var index = service.playIndex;
            do {
                if (service.clase && service.playIndex === service.clase.ejercicios.length - 1) {
                    service.playIndex = index;
                    return;
                }
                service.playIndex++;
            } while (service.clase.ejercicios[service.playIndex].deshabilitado);

            service.playFromList();
        },
        playPrevious: function () {
            var index = service.playIndex;
            do {
                if (service.clase && service.playIndex === 0) {
                    service.playIndex = index;
                    return;
                }
                service.playIndex--;
            } while (service.clase.ejercicios[service.playIndex].deshabilitado);
            service.playFromList();
        },
        finProgresivo: function (segundos) {
            service.segundosFinProgresivo = segundos;
        },
        duration: 0,
        durationString: function () {
            return (new Date(service.duration * 1000)).toUTCString().match(/(\d\d:\d\d:\d\d)/)[0].substring(3);
        },
        currentTime: 0,
        currentTimeString: function () {
            return (new Date(service.currentTime * 1000)).toUTCString().match(/(\d\d:\d\d:\d\d)/)[0].substring(3);
        },
        state: "",
        errorMessage: "",
        currentPlaying: null,
        finalizarLeftPx: null,
        stop: function () {
            service.pause();
            audio.currentTime = 0;
        },
        message: "",
        playEjercicio: function (ejercicio) {
            service.playIndex = ejercicio.nro - 1;
            service.playFromList();
        },
        playFile: function (musica, ejercicio) {
            if (timeoutEmpalme) {
                console.log("cancel timeoutEmpalme ");
                $timeout.cancel(timeoutEmpalme);
                timeoutEmpalme = null;
            }
            if (audio.timerInicio) {
                console.log("cancel audio.timerInicio ");
                $timeout.cancel(audio.timerInicio);
                audio.timerInicio = undefined;
            }
            if (timeoutFinProgresivo) {
                console.log("cancel timeoutFinProgresivo");
                $timeout.cancel(timeoutFinProgresivo);
                timeoutFinProgresivo = null;
            }
            if (audio.intervalFinProgresivo) {
                console.log("cancel audio.intervalFinProgresivo ");
                $interval.cancel(audio.intervalFinProgresivo);
                audio.intervalFinProgresivo = undefined;
            }
            if (audio.intervalInicioVolume) {
                console.log("cancel timeoutEmpalme ");
                $interval.cancel(audio.intervalInicioVolume);
                audio.intervalInicioVolume = undefined;
            }
            audio.volume = ejercicio ? ejercicio.volumen / 100 : 1;
            audio.ejercicio = ejercicio;
            if (!ejercicio) service.playContinuo = false;
            service.tiempoRestanteClase();
            service.currentPlaying = musica;
            service.message = "";
            service.segundosFinProgresivo = 0;
            service.finalizarLeftPx = null;
            if (ejercicio && ejercicio.finalizarSegundos) {
                var progress = angular.element(document.querySelector('#playerProgress'))[0];
                var duration = moment.duration(musica.duracion).asSeconds();
                service.finalizarLeftPx = ejercicio.finalizarSegundos * progress.clientWidth / duration;
            }
            if (musica === null) {
                service.stop();
                return;
            }
            if (service.playIndex !== -1 &&
                service.playIndex !== 0 &&
                service.clase.ejercicios[service.playIndex].musica !== musica) {
                service.playIndex = -1;
            }
            if (service.clase) {
                var musicaSearch = $filter('filter')(service.clase.ejercicios, { musica: musica });
                if (musicaSearch && musicaSearch.length > 0) {
                    service.playIndex = musicaSearch[0].nro - 1;
                }
            }
            if (ejercicio && (ejercicio.segundosInicioProgresivo || 0) > 0) {
                audio.volume = 0;
                audio.volumeStep = ejercicio.volumen / 100 / (ejercicio.segundosInicioProgresivo * 1000 / 200);
                console.log("start audio.intervalInicioVolume " + ejercicio.segundosInicioProgresivo);
                audio.intervalInicioVolume = $interval(function () {
                    if (audio.volume + audio.volumeStep >= ejercicio.volumen / 100) {
                        $interval.cancel(audio.intervalInicioVolume);
                        console.log("cancel audio.intervalInicioVolume ");
                        audio.intervalInicioVolume = undefined;
                        audio.volume = ejercicio.volumen / 100;
                        return;
                    }
                    audio.volume += audio.volumeStep;
                },
                    200);
            }
            if (typeof audio.repeatCount === "undefined") audio.repeatCount = 1;
            audio.src = loaderService.carpetaColeccion(musica.coleccion) + musica.carpeta +
                '/' +
                musica.archivo;
            if (ejercicio) audio.currentTime = ejercicio.iniciarSegundos;
            service.message = musica.coleccion +
                '-' +
                musica.nroCd +
                '-' +
                musica.nroPista +
                ' ' +
                musica.nombre +
                '(' +
                musica.interprete +
                '). ';
            //if (ejercicio) {
            //    service.message += ejercicio.nombre;
            //    if (ejercicio.ejercicio) service.message += ' (' + ejercicio.ejercicio.nombre + ').';
            //}
            try {
                audio.play();
            } catch (e) {
                service.error = e.message;
            }
        },
        playAll: function () {
            if (service.clase.ejercicios.length < 1) return;
            service.playIndex = 0;
            service.playContinuo = true;
            service.playNext();
        },
        setCurrentTime: function (value) {
            audio.currentTime = value;
        },
        progressClick: function ($event) {
            if (typeof $event === "undefined") return;
            var progress = angular.element(document.querySelector('#playerProgress'))[0];
            service.setCurrentTime($event.offsetX * service.duration / progress.clientWidth);
        },
        playContinuo: false,
        changeState: function (newState) {
            console.log(newState);
            switch (newState) {
                case "playing":
                    //service.startStateLoop();
                    break;
                case "ended":
                    if (audio.timerInicio) return;
                    if (!audio.ended) {
                        service.stop();
                    }
                    console.log("cancel timeoutFinProgresivo");
                    if (timeoutFinProgresivo) $timeout.cancel(timeoutFinProgresivo);
                    if (service.clase) {
                        service.tiempoRestanteClase();
                        if (service.playIndex > -1 &&
                            service.clase.ejercicios[service.playIndex].cantidadRepeticiones >
                            audio.repeatCount) {
                            audio.repeatCount++;
                            console.log("start audio.timerInicio " + 30);
                            audio.timerInicio = $timeout(function () {
                                console.log("elapsed audio.timerInicio ");
                                service.playFile(service.clase.ejercicios[service.playIndex].musica,
                                        service.clase.ejercicios[service.playIndex]);
                            },
                                30 * 1000);
                            return;
                        }
                    }
                    if (service
                        .playIndex >
                        -1 &&
                        service.clase.ejercicios[service.playIndex].pauseEmpalme > 0) {
                        console.log("start timeoutEmpalme " + service.clase.ejercicios[service.playIndex].pauseEmpalme);
                        if (!timeoutEmpalme) timeoutEmpalme = $timeout(function () {
                            console.log("elapsed timeoutEmpalme " + service.clase.ejercicios[service.playIndex].pauseEmpalme);
                            timeoutEmpalme = null;
                            service.playNext();
                        },
                            service.clase.ejercicios[service.playIndex].pauseEmpalme * 1000);
                        service.segundosParaEmpalme = service.clase.ejercicios[service.playIndex].pauseEmpalme;
                    }
                case "pause":
                case "error":
                    service.stopStateLoop();
                    break;
                default:
            }
            service.state = newState;
        },
        startStateLoop: function () {
            //service.stopStateLoop();
            if (!service.intervalState) service.intervalState = $interval(service.updateState, 1000);
        },
        stopStateLoop: function () {
            //if (service.intervalState) $interval.cancel(service.intervalState);
        },
        updateState: function () {
            service.currentTime = audio.currentTime;
            service.duration = audio.duration || 0;
            if (timeoutEmpalme) service.segundosParaEmpalme--;
            if ((service.segundosFinProgresivo || 0) > 0) {
                activarFinProgresivo(service.segundosFinProgresivo);
                service.segundosFinProgresivo = 0;
            }
            if ($rootScope.$$phase !== "$apply" && $rootScope.$$phase !== "$digest") $rootScope.$apply();
            if (service.clase === undefined || service.playIndex < 0) return;
            if (service.playIndex > -1 &&
                (service.clase.ejercicios[service.playIndex].finalizarSegundos || 99999) <= service.currentTime) {
                //service.stop();
                service.changeState("ended");
            }
            var duracionTotal = (service.clase.ejercicios[service.playIndex].finalizarSegundos || 0) > 0
                ? service.clase.ejercicios[service.playIndex].finalizarSegundos
                : service.duration;
            if ((service.clase.ejercicios[service.playIndex].segundosFinProgresivo || 0) > 0) {
                if (service.currentTime >= duracionTotal - service.clase.ejercicios[service.playIndex].segundosFinProgresivo &&
                    typeof audio.intervalFinProgresivo === "undefined") {
                    activarFinProgresivo(service.clase.ejercicios[service.playIndex].segundosFinProgresivo);
                }
            }
        }
    };

    function activarFinProgresivo(segundosFinProgresivo) {
        if (timeoutEmpalme) return;
        console.log("start activarFinProgresivo " + segundosFinProgresivo);
        audio.volumeStepFin = 1 / (segundosFinProgresivo * 1000 / 200);
        audio.intervalFinProgresivo = $interval(function () {
            if (audio.volume - audio.volumeStepFin >= 0) audio.volume -= audio.volumeStepFin;
        },
            200);
        timeoutFinProgresivo = $timeout(function () {
            console.log("elapsed-cancel activarFinProgresivo ");
            $interval.cancel(audio.intervalFinProgresivo);
            audio.intervalFinProgresivo = undefined;
            service.changeState('ended');
        },
            segundosFinProgresivo * 1000 - 0.3);
    }

    audioElementAng.bind('play',
        function () {
            service.changeState("playing");
            service.startStateLoop();
        });
    audioElementAng.bind('playing',
        function () {
            service.changeState("playing");
        });
    audioElementAng.bind('pause',
        function () {
            service.changeState("pause");
        });
    audioElementAng.bind('ended',
        function () {
            service.changeState("ended");
            if (service.playContinuo) service.playNext();
            //$rootScope.$apply();
        });
    audioElementAng.bind('durationchange',
        function () {
            service.duration = audio.duration;
            //if (indexMusicas < musicas.length - 1) {
            //    updateDuracion();
            //}
            //console.log(service.duration);
            //$rootScope.$apply();
        });
    audioElementAng.bind('timeupdate',
        function () {
            service.currentTime = audio.currentTime;
            //console.log(service.currentTime);
        });
    audioElementAng.bind('error',
        function ($event) {
            service.changeState("error");
            service.errorMessage = "error: " + $event.srcElement.error.message;
            service.message = service.errorMessage;
            //$rootScope.$apply();
            console.log($event);
            //if (indexMusicas < musicas.length - 1) {
            //    updateDuracion();
            //    return;
            //}

        });
    /*
            var musicas = $filter('filter')(db.musicas, { duracion: "00:00:00" });
            var indexMusicas = 0;
    
           audio.src = contextService.config().pathMusica +
                        musicas[0].coleccion +
                        '/' +
                        musicas[0].carpeta +
                        '/' +
                        musicas[0].archivo;
           function updateDuracion() {
               if (audio.duration > 0) {
                   var time = moment(0, 's').add(moment.duration(audio.duration, 's'))
                       .format("HH:mm:ss");
                   console.log("UPDATE Musica SET Duracion = cast('" +
                       time +
                       "' as time) WHERE IdMusica = " +
                       musicas[indexMusicas].idMusica);
               }
                indexMusicas++;
                audio.src = contextService.config().pathMusica +
                    musicas[indexMusicas].coleccion +
                    '/' +
                    musicas[indexMusicas].carpeta +
                    '/' +
                    musicas[indexMusicas].archivo;
            }*/
    return service;
}
]);
