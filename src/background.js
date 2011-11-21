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

    const DICT_QUERY = {
        powerword: Powerword,
        bing: Bing,
        dictcn: Dictcn,
        qqdict: QQDict
    };

    const TRANSLATE_QUERY = {
        powerword: powerwordT,
        baidu: baiduT,
        youdao: youdaoT,
		google: googleT
    };

    var database = openDatabase('dict', '1.0', 'dict database', 5 * 1024 * 1024);
    database.transaction(function (tx) {
        tx.executeSql('DROP TABLE IF EXISTS dict')
        tx.executeSql('CREATE TABLE IF NOT EXISTS dicty (word text, api text, content text, PRIMARY KEY (word, api))');
    }, function (err) {
        console.log(err)
    });

    setPageActionIcon(true);

    function setPageActionIcon(status) {
        var ico, hoverCapture = localStorage.hoverCapture, dragCapture = localStorage.dragCapture;
        if (status) {
            if (hoverCapture === '1' && dragCapture === '1') {
                ico = 'assets/normal.png';
            }
            else if (hoverCapture === '1') {
                ico = 'assets/hover.png';
            }
            else if (dragCapture === '1') {
                ico = 'assets/drag.png';
            }
            else {
                ico = 'assets/off.png';
            }
        }
        else {
            ico = 'assets/grey.png';
        }

        chrome.browserAction.setIcon({path: chrome.extension.getURL(ico)});
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
                    setPageActionIcon(true);
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
                new DICT_QUERY[dict]({
                    word: key,
                    load: function (json) {
                        port.postMessage(json);
                    },
                    error: function (json) {
                        port.postMessage({key: key});
                    }
                }).query();
            }
            else {
                TRANSLATE_QUERY[dict](
                    key,
                    function (json) {
                        port.postMessage(json);
                    },
                    function (word) {
                        port.postMessage({key: key});
                    }
                );
            }
        }
        else {
            if (/^[a-z]+([-'][a-z]+)*$/i.test(key)) {
                var assistRes, status = 'init';
                new DICT_QUERY[localStorage.mainDict]({
                    word: key,
                    load: function (json) {
                        status = 'complete';
                        port.postMessage(json);
                    },
                    error: function () {
                        if (typeof assistRes !== 'undefined') {
                            port.postMessage(assistRes);
                            status = 'complete';
                        }
                        else {
                            status = 'error';
                        }
                    }
                }).query();

                TRANSLATE_QUERY[localStorage.translate](
                    key,
                    function (json) {
                        assistRes = json;
                        if (status === 'error') {
                            port.postMessage(json);
                        }
                    },
                    function (word) {
                        assistRes = {key: key};
                        if (status === 'error') {
                            port.postMessage({key: key});
                        }
                    }
                );
            }
            else {
                TRANSLATE_QUERY[localStorage.translate](
                    key,
                    function (json) {
                        port.postMessage(json);
                    },
                    function (word) {
                        port.postMessage({key: key});
                    }
                );
            }
        }
    }

})(this, this.document);
