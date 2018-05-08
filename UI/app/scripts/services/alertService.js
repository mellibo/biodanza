services.factory('alertService',
[
    function() {

        var service = {
            alerts: [],
            addAlert: function(type, msg) {
                service.alerts.push({ type: type, msg: msg });
            },
            closeAlert: function(index) {
                service.alerts.splice(index, 1);
            }
        }

        return service;
    }
]);