(function () {
    if (localStorage.skin === undefined) {
        chrome.tabs.create({url: '../pages/options.html'});
    }

    localStorage.skin || (localStorage.skin = 'orange');
    localStorage.hotKeySwitch || (localStorage.hotKeySwitch = '1');
    localStorage.assistKey || (localStorage.assistKey = 'none');
    localStorage.hotKeyHover || (localStorage.hotKeyHover = '{"ctrlKey":false,"altKey":true,"shiftKey":false,"metaKey":false,"keyCode":112}');
    localStorage.hotKeyDrag || (localStorage.hotKeyDrag = '{"ctrlKey":false,"altKey":true,"shiftKey":false,"metaKey":false,"keyCode":113}');
    localStorage.mainDict || (localStorage.mainDict = 'powerword');
    localStorage.translate || (localStorage.translate = 'google');
    localStorage.hoverCapture || (localStorage.hoverCapture = '0');
    localStorage.dragCapture || (localStorage.dragCapture = '1');
    localStorage.status || (localStorage.status = '1');
    localStorage.speed || (localStorage.speed = '50');

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
            sendResponse(getConfig());
        }
    });

    function getConfig() {
        var params = {}, hotKeys = {}, dictsAvailable, dictsOrder, dicts = [], i, len;
        params.ui = localStorage.ui;
        params.skin = localStorage.skin;
        params.hoverCapture = localStorage.hoverCapture === '1' ? true : false;
        params.dragCapture = localStorage.dragCapture === '1' ? true : false;

        if (localStorage.hotKeySwitch === '0') {
            hotKeys = null;
        }
        else {
            hotKeys = {
                hover: JSON.parse(localStorage.hotKeyHover),
                drag: JSON.parse(localStorage.hotKeyDrag)
            };
        }
        params.hotKey = hotKeys;
        params.speed = parseInt(localStorage.speed, 10);
        params.assistKey = localStorage.assistKey === 'none' ? null : {"ctrlKey":localStorage.assistKey.indexOf('ctrl') > -1,"altKey":localStorage.assistKey.indexOf('alt') > -1};

        return params;
    }

    chrome.extension.onConnect.addListener(function(port) {
        if (port.name === 'dict') {
            port.onMessage.addListener(function (msg, port) {
                switch (msg.cmd) {
                case 'setCaptureMode':
                    setCaptureMode(msg, port);
                    if (!port.tab) {
                        chrome.tabs.getAllInWindow(null, function (tabs) {
                            var request = {cmd: 'setCaptureMode', hoverCapture: localStorage.hoverCapture === '1', dragCapture: localStorage.dragCapture === '1'};
                            for (var i = 0, len = tabs.length ; i < len ; i += 1) {
                                chrome.tabs.sendRequest(tabs[i].id, request);
                            }
                        });
                    }
                    break;
                case 'getCaptureMode':
                    port.postMessage({cmd: 'setCaptureMode', hoverCapture: localStorage.hoverCapture === '1', dragCapture: localStorage.dragCapture === '1'});
                    break;
                case 'query':
                    simpleQuery(msg.w, port, msg.dict, msg.type);
                    break;
                }
            });
        }
    });

    function setCaptureMode(msg, port) {
        localStorage.hoverCapture = msg.hoverCapture ? '1' : '0';
        localStorage.dragCapture = msg.dragCapture ? '1' : '0';
        port.postMessage(msg);
    };

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
                        assistRes = {key: key};
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
