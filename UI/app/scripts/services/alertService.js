services.factory('alertService', 
['$timeout', function ($timeout) {
        function addAlert(alert) {
            service.alerts.push(alert);
            $timeout(() => {
                var index = service.alerts.indexOf(alert);
                service.alerts.splice(index, 1);
            },
                10000);
        }
        var service = {
            alerts: [],
            addAlert: function(type, msg) {
                var alert = { type: type, msg: msg }
                addAlert(alert);
            },
            addDangerAlert: function(msg) {
                var alert = { type: "danger", msg: msg };
                addAlert(alert);                
            },
            addInfoAlert: function (msg) {
                addAlert(alert);
            },
            closeAlert: function(index) {
                service.alerts.splice(index, 1);
            }
        }

        return service;
    }
]);