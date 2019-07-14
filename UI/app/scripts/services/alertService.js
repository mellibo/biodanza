services.factory('alertService', 
['$timeout', function ($timeout) {
    function addAlert(alert) {
        if (!alert.type) alert.type = "info";
            service.alerts.push(alert);
            $timeout(() => {
                var index = service.alerts.indexOf(alert);
                service.alerts.splice(index, 1);
            },
                10000);
            safeApply();
        }

        function safeApply(fn) {
            var scope = angular.element(document.querySelector('#fileImport')).scope();
            var phase = scope.$$phase;
            if (phase === '$apply' || phase === '$digest') {
                if (fn && (typeof (fn) === 'function')) {
                    fn();
                }
            } else {
                scope.$apply(fn);
            }
        }

        var service = {
            alerts: [],
            addAlert: function(type, msg) {
                var alert = { type: type, msg: msg };
                addAlert(alert);
            },
            addDangerAlert: function(msg) {
                var alert = { type: "danger", msg: msg };
                addAlert(alert);                
            },
            addInfoAlert: function (msg) {
                var alert = { type: "info", msg: msg };
                addAlert(alert);
            },
            closeAlert: function(index) {
                service.alerts.splice(index, 1);
            }
        }

        return service;
    }
]);