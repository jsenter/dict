(function () {
    localStorage.skin || (localStorage.skin = 'orange');
    localStorage.hotKeySwitch || (localStorage.hotKeySwitch = '1');
    localStorage.assistKey || (localStorage.assistKey = 'none');
    localStorage.hotKeyHover || (localStorage.hotKeyHover = '{"ctrlKey":false,"altKey":true,"shiftKey":false,"metaKey":false,"keyCode":112}');
    localStorage.hotKeyDrag || (localStorage.hotKeyDrag = '{"ctrlKey":false,"altKey":true,"shiftKey":false,"metaKey":false,"keyCode":113}');
    localStorage.mainDict || (localStorage.mainDict = 'powerword');
    localStorage.assistDict || (localStorage.assistDict = 'dictcn');
    localStorage.hoverCapture || (localStorage.hoverCapture = '1');
    localStorage.dragCapture || (localStorage.dragCapture = '1');
    localStorage.status || (localStorage.status = '1');
    localStorage.speed || (localStorage.speed = '50');

    const DICT_API = {
        powerword: 'http://dict-co.iciba.com/api/dictionary.php?w=',
        dictcn: 'http://dict.cn/ws.php?utf8=true&q=',
        qqdict: 'http://dict.qq.com/dict?q='
    };

    const DICT_QUERY = {
        powerword: Powerword,
        dictcn: Dictcn,
        qqdict: QQDict
    };

    var database, dbRequest = webkitIndexedDB.open('dict'), status, menuItemIdHover, menuItemIdDrag;

    dbRequest.onerror = function(e) {
        console.log('indexdb open error');
    };

    dbRequest.onsuccess = function(e) {
        database = e.target.result;
        if (database.version != '1.1') {
            var request = database.setVersion("1.1");

            request.onerror = function (event) {
                console.log('setVersion error');
            };

            request.onsuccess = function (e) {
                var powerword, dictcn, qqdict;
                powerword = database.createObjectStore('powerword', {keyPath: 'key'});
                dictcn = database.createObjectStore('dictcn', {keyPath: 'key'});
                qqdict = database.createObjectStore('qqdict', {keyPath: 'key'});
            };
        }
    };

    /*menuItemIdHover = chrome.contextMenus.create({
        title: '查询',
        onclick: contextMenusHanlder
    });*/

    setPageActionIcon(localStorage.status === '1');
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        if (tab.status !== 'complete' && !/^chrome/.test(tab.url) && tab.url.indexOf('https://chrome.google.com/webstore') === -1) {
            chrome.tabs.insertCSS(tabId, {file: 'pages/style/ui.css'});
            chrome.tabs.executeScript(tabId, {file: "src/dict.js"});
        }
    });

    /*
    chrome.tabs.onSelectionChanged.addListener(function (tabId, selectInfo) {
        setPageActionIcon(false);
        chrome.tabs.sendRequest(tabId, {
            cmd: 'setCaptureMode',
            dragCapture: localStorage.dragCapture === '1' ? true : false,
            hoverCapture: localStorage.hoverCapture === '1' ? true : false
        }, function () {
            setPageActionIcon(true);
        });
    });*/

    function contextMenusHanlder(info, tab) {
        var cmd = localStorage.status === '1' ? 'toggleHoverCapture' : 'toggleDragCapture';
        chrome.tabs.getSelected(null, function(tab) {
            chrome.tabs.sendRequest(tab.id, {cmd: cmd}, function (response) {
                toggle(response, tab.id);
            });
        });
    }

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
                    if (msg.dict) {
                        new DICT_QUERY[msg.dict]({
                            word: msg.w,
                            load: function (json) {
                                port.postMessage(json);
                            },
                            error: function (word) {
                                port.postMessage({key: msg.w});
                            }
                        }).query();
                    }
                    else {
                        simpleQuery(msg, port);
                    }
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

    function simpleQuery(msg, port) {
        var mainDict = localStorage.mainDict, assistDict = localStorage.assistDict, assistRes, status = 'init';
        new DICT_QUERY[mainDict]({
            word: msg.w,
            load: function (json) {
                status = 'complete';
                port.postMessage(json);
            },
            error: function (word) {
                status = 'error';
                if (typeof assistRes !== 'undefined') {
                    port.postMessage(assistRes);
                }
            }
        }).query();

        if (assistDict) {
            new DICT_QUERY[assistDict]({
            word: msg.w,
            load: function (json) {
                if (status === 'error') {
                    port.postMessage(json);
                }
                assistRes = json;
            },
            error: function (word) {
                if (status === 'error') {
                    port.postMessage({key: msg.w});
                }
                assistRes = {key: msg.w};
            }
        }).query();
        }
    }

    /*
    * Query
    */

    function Query(args) {
        args = args || {};
        this.word = args.word;
        this.load = args.load;
        this.error = args.error;
    }

    Query.prototype.query = function () {
        var objectStore = database.transaction([this.model], webkitIDBTransaction.READ).objectStore(this.model), request;
        request = objectStore.get(this.word);
        request.addEventListener('success', dom.Tool.proxy(function (e) {
            if (typeof e.target.result === 'undefined') {
                this.ajax();
            }
            else {
                this.load(e.target.result);
            }
        }, this), false);
        request.addEventListener('error', dom.Tool.proxy(this.ajax, this), false);
    };

    Query.prototype.updateDB = function (data) {
        var objectStore = database.transaction([this.model], webkitIDBTransaction.WRITE).objectStore(this.model), request;
        request = objectStore.add(data);
    };

    Query.prototype.ajax = function (word) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', this.api + this.word, true);
        xhr.addEventListener('load', dom.Tool.proxy(this.ajaxLoad, this), false);
        xhr.addEventListener('error', dom.Tool.proxy(this.ajaxError, this), false);
        xhr.send(null);
    };

    Query.prototype.ajaxLoad = function (e) {
        //override
    };

    Query.prototype.ajaxError = function (e) {
        this.error(this.word);
    };




    function Powerword(args) {

        this.api = DICT_API.powerword;
        this.model = 'powerword';

        this.super.constructor.call(this, args);
    }

    dom.Tool.extend(Powerword, Query);

    Powerword.prototype.ajaxLoad = function (e) {
        var xml = e.target.responseXML, json = {}, elems, elem, i, len, item;
        json.key = this.word;
        if (xml) {
            elems = xml.getElementsByTagName('ps')[0];
            json.ps = elems ? elems.firstChild.nodeValue : '';

            elems = xml.getElementsByTagName('pron')[0];
            json.pron = elems ? elems.firstChild.nodeValue.trim() : '';

            json.tt = [];
            elems = xml.getElementsByTagName('acceptation');
            for (i = 0, len = elems.length ; i < len ; i += 1) {
                item = elems[i];
                elem = item.previousSibling;
                json.tt.push({
                    pos: (elem.tagName.toLowerCase() === 'pos' || elem.tagName.toLowerCase() === 'fe') ? elem.firstChild.nodeValue : '',
                    acceptation: item.firstChild.nodeValue
                });
            }
        }

        if (json.tt && json.tt.length > 0) {
            this.load(json);
            this.updateDB(json);
        }
        else {
            this.ajaxError();
        }
    };


    function Dictcn(args) {

        this.api = DICT_API.dictcn;
        this.model = 'dictcn';
        this.super.constructor.call(this, args);
    }

    dom.Tool.extend(Dictcn, Query);

    Dictcn.prototype.ajaxLoad = function (e) {
        var xml = e.target.responseText, json = {}, elems, elem, i, len, item, parser, reg = /[a-z]\..+?(?=[a-z]\.|$)/gm;
        if (xml) {
            parser = new DOMParser();
            xml = parser.parseFromString(xml,"text/xml");
            elem = xml.getElementsByTagName('pron')[0];
            json.ps = elem ? elem.firstChild.nodeValue : '';

            elem = xml.getElementsByTagName('audio')[0];
            json.pron = elem ? elem.firstChild.nodeValue : '';

            json.tt = [];
            elem = xml.getElementsByTagName('def')[0];
            if (elem) {
                elem = elem.firstChild.nodeValue;
                elems = elem.match(reg);
                if (elems) {
                    for (i = 0, len = elems.length ; i < len ; i += 1) {
                        item = elems[i];
                        json.tt.push({
                            pos: '',
                            acceptation: elems[i]
                        });
                    }
                }
            }
        }

        if (json.tt && json.tt.length > 0) {
            json.key = this.word;
            this.load(json);
            this.updateDB(json);
        }
        else {
            this.ajaxError();
        }
    };


    function QQDict(args) {

        this.api = DICT_API.qqdict;
        this.model = 'qqdict';
        this.super.constructor.call(this, args);
    }

    dom.Tool.extend(QQDict, Query);

    QQDict.prototype.ajaxLoad = function (e) {
        var xml = eval('(' + e.target.responseText + ')'), json = {}, elems, elem, i, len, item;
        if (xml.local) {
            xml = xml.local[0];
            json.ps = xml.pho ? xml.pho[0] : '';

            //json.pron = elem ? elem.firstChild.nodeValue : '';

            json.tt = [];
            elems = xml.des;
            if (elems) {
                for (i = 0, len = elems.length ; i < len ; i += 1) {
                    item = elems[i];
                    json.tt.push({
                        pos: item.p,
                        acceptation: item.d
                    });
                }
            }
        }

        if (json.tt && json.tt.length > 0) {
            json.key = this.word;
            this.load(json);
            this.updateDB(json);
        }
        else {
            this.ajaxError();
        }
    };
})();
