services.factory('downloadService', ['$window', function ($window) {
    var service = {}


    service.downloadBlob = function(blob, filename) {
            var e = document.createEvent('MouseEvents'),
            a = document.createElement('a');

            a.download = filename;
            url = $window.URL || $window.webkitURL;
            a.href = url.createObjectURL(blob);
            //a.dataset.downloadurl = ['text/js', a.download, a.href].join(':');
            e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            a.dispatchEvent(e);
        };

    service.downloadString = function(string, filename) {
            var data = string;
            var blob = new Blob([data], { type: 'text/js' }),
                e = document.createEvent('MouseEvents'),
                a = document.createElement('a');

            a.download = filename;
            a.href = window.URL.createObjectURL(blob);
            a.dataset.downloadurl = ['text/js', a.download, a.href].join(':');
            e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            a.dispatchEvent(e);
        };

    service.downloadJson = function(obj, filename) {
            var data = "text/json;charset=utf-8," + angular.toJson(obj, true);
            var blob = new Blob([data], { type: 'text/json' }),
                e = document.createEvent('MouseEvents'),
                a = document.createElement('a');

            a.download = filename;
            a.href = window.URL.createObjectURL(blob);
            a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
            e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
            a.dispatchEvent(e);
        };
        return service;
    }
]);
