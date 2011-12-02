(function () {
    if (localStorage.skin === undefined) {
        chrome.tabs.create({url: '../pages/options.html'});
    }

    localStorage.skin || (localStorage.skin = 'orange');
    localStorage.mainDict || (localStorage.mainDict = 'powerword');
    localStorage.translate || (localStorage.translate = 'google');
    localStorage.capture || (localStorage.capture = JSON.stringify([{status: false, assistKey: 'type', hotKey: ''}, {status: true, assistKey: 'type', hotKey: ''}, {status: true, assistKey: 'ctrlKey', hotKey: ''}]));

    var portPool = {};

    function setPageActionIcon() {
        var ico, hoverCapture = localStorage.hoverCapture, dragCapture = localStorage.dragCapture;
        if (hoverCapture === '1' && dragCapture === '1') {
            ico = '../assets/normal.png';
        }
        else if (hoverCapture === '1') {
            ico = '../assets/hover.png';
        }
        else if (dragCapture === '1') {
            ico = '../assets/drag.png';
        }
        else {
            ico = '../assets/off.png';
        }

        chrome.browserAction.setIcon({path: ico});
    }

    chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
        if (request.cmd === 'config') {
            sendResponse({
                skin: localStorage.skin,
                capture: JSON.parse(localStorage.capture)
            });
        }
    });

    chrome.extension.onConnect.addListener(function(port) {
        if (port.name === 'dict') {
            if (port.tab) {
                portPool[port.portId_] = port;
                port.onMessage.addListener(function (msg, port) {
                    simpleQuery(msg.w, port, msg.dict, msg.type);
                });
                port.onDisconnect.addListener(function () {
                    delete portPool[port.portId_];
                });
            }
            else {
                port.onMessage.addListener(function (msg, port) {
                    if (msg.cmd === 'query') {
                        simpleQuery(msg.w, port, msg.dict, msg.type);
                    }
                    else {
                        for (var key in portPool) {
                            portPool[key].postMessage({cmd: 'setCaptureMode', capture: msg.capture});
                        }
                    }
                });
            }
        }
    });

    function simpleQuery(key, port, dict, type) {
        if (dict) {
            if (type === 'dict') {
                new dictapi.dict[dict]({
                    word: key,
                    loadend: function (json) {
                        port.postMessage(json);
                    }
                }).query();
            }
            else {
                new dictapi.translate[dict]({
                    word: key,
                    loadend: function (json) {
                        port.postMessage(json);
                    }
                }).query();
            }
        }
        else {
            if (/^[a-z]+([-'][a-z]+)*$/i.test(key)) {
                var assistRes, status = 'init';
                new dictapi.dict[localStorage.mainDict]({
                    word: key,
                    load: function (json) {
                        status = 'complete';
                        port.postMessage(json);
                    },
                    error: function (json) {
                        if (assistRes) {
                            port.postMessage(assistRes);
                            status = 'complete';
                        }
                        else {
                            status = 'error';
                        }
                    }
                }).query();

                new dictapi.translate[localStorage.translate]({
                    word: key,
                    load: function (json) {
                        assistRes = json;
                        if (status === 'error') {
                            port.postMessage(json);
                        }
                    },
                    error: function (json) {
                        assistRes = json;
                        if (status === 'error') {
                            port.postMessage(json);
                        }
                    }
                }).query();
            }
            else {
                new dictapi.translate[localStorage.translate]({
                    word: key,
                    loadend: function (json) {
                        port.postMessage(json);
                    }
                }).query();
            }
        }
    }

})(this, this.document);
