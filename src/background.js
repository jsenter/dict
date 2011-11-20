(function (window, document, undefined){
    this.extend = function (childCtor, parentCtor) {
        function tempCtor() {};
        tempCtor.prototype = parentCtor.prototype;
        childCtor.prototype = new tempCtor();
        childCtor.prototype.super = parentCtor.prototype;
        childCtor.prototype.constructor = childCtor;
    }

    this.proxy = function (fn, obj) {
        return function () {
            return fn.apply(obj, arguments);
        }
    }

    this.ajax = function (type, url, data, success, error) {
        var xhr = new XMLHttpRequest();
        if (type.toUpperCase() === 'GET') {
            url += '?' + data;
            data = null;
        }
        xhr.open(type, url, true);
        if (type.toUpperCase() === 'POST') {
            xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        }
        xhr.addEventListener('load', function (e) {
            success(e);
        }, false);
        xhr.addEventListener('error', error, false);
        xhr.send(data);//encodeURIComponent
    };
})(this, this.document);

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
                    simpleQuery(msg, port, msg.dict);
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

    function simpleQuery(msg, port, dict) {//this.rSingleWord = /^[a-z]+([-'][a-z]+)*$/i
        if (/^[a-z]+([-'][a-z]+)*$/i.test(msg.w)) {
            var assistRes, status = 'init';
            new DICT_QUERY[dict || localStorage.mainDict]({
                word: msg.w,
                load: function (json) {
                    status = 'complete';
                    port.postMessage(json);
                },
                error: function () {
                    if (dict) {
                        port.postMessage({key: msg.w});
                    }
                    else {
                        status = 'error';
                        if (typeof assistRes !== 'undefined') {
                            port.postMessage(assistRes);
                        }
                    }
                }
            }).query();

            TRANSLATE_QUERY[dict || localStorage.translate](
                msg.w,
                function (json) {
                    if (status === 'error') {
                        port.postMessage(json);
                    }
                    assistRes = json;
                },
                function (word) {
                    if (status === 'error') {
                        port.postMessage({key: msg.w});
                    }
                    assistRes = {key: msg.w};
                }
            );
        }
        else {
            TRANSLATE_QUERY[dict || localStorage.translate](
                msg.w,
                function (json) {
                    port.postMessage(json);
                },
                function (word) {
                    port.postMessage({key: msg.w});
                }
            );
        }
    }


    function Query(args) {
        args = args || {};
        this.word = args.word;
        this.load = args.load;
        this.error = args.error;

        this.res = {};
        this.res.key = this.word;
    }

    Query.prototype.query = function () {
        var self = this;
        database.transaction(function (tx) {
            tx.executeSql('SELECT * FROM dicty WHERE word=? AND api=?', [self.word, self.model], function (tx, result) {
                if (result.rows.length > 0) {
                    self.load(JSON.parse(result.rows.item(0).content));
                }
                else {
                    ajax(self.type, self.api, self.data, proxy(self.ajaxLoad, self), proxy(self.error, self));
                }
            }, function (tx, err) {
                console.log(arguments);
                ajax(self.type, self.api, self.data, proxy(self.ajaxLoad, self), proxy(self.error, self));
            });
        });
    };

    Query.prototype.updateDB = function (data) {
        var self = this;
        database.transaction(function (tx) {
            tx.executeSql('INSERT INTO dicty VALUES (?,?,?)', [data.key, self.model , JSON.stringify(data)]);
        }, function (err) {
            console.log(arguments)
            if (err.code === 4) {
                tx.executeSql('DELETE FROM dict', []);
            }
        });
    };

    Query.prototype.ajaxLoad = function (e) {
        if (this.res.tt && this.res.tt.length > 0) {
            this.load(this.res);
            this.updateDB(this.res);
        }
        else {
            this.error();
        }
    };




    function Powerword(args) {

        this.super.constructor.call(this, args);

        this.api = 'http://dict-co.iciba.com/api/dictionary.php';
        this.type = 'get';
        this.data = 'w=' + this.word;
        this.model = 'powerword';
    }

    extend(Powerword, Query);

    Powerword.prototype.ajaxLoad = function (e) {
        var xml = e.target.responseXML, json = this.res, elems, elem, i, len, item;
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

        this.super.ajaxLoad.call(this, e);
    };


    function Dictcn(args) {

        this.super.constructor.call(this, args);

        this.api = 'http://dict.cn/ws.php';
        this.type = 'get';
        this.data = 'utf8=true&q=' + this.word;
        this.model = 'dictcn';
    }

    extend(Dictcn, Query);

    Dictcn.prototype.ajaxLoad = function (e) {
        var xml = e.target.responseText, json = this.res, elems, elem, i, len, item, parser, reg = /[a-z]\..+?(?=[a-z]\.|$)/gm;
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

        this.super.ajaxLoad.call(this, e);
    };


    function QQDict(args) {

        this.super.constructor.call(this, args);

        this.api = 'http://dict.qq.com/dict';
        this.type = 'get';
        this.data = 'q=' + this.word;
        this.model = 'qqdict';
    }

    extend(QQDict, Query);

    QQDict.prototype.ajaxLoad = function (e) {
        var xml = eval('(' + e.target.responseText + ')'), json = this.res, elems, elem, i, len, item;
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

        this.super.ajaxLoad.call(this, e);
    };


    function Bing(args) {

        this.super.constructor.call(this, args);

        this.api = 'http://dict.bing.com.cn/io.aspx';
        this.type = 'post';
        this.data = 't=dict&ut=default&ulang=ZH-CN&tlang=EN-US&q=' + this.word;
        this.model = 'bing';
    }

    extend(Bing, Query);

    Bing.prototype.ajaxLoad = function (e) {
        var xml = JSON.parse(e.target.responseText).ROOT, json = this.res, elems, elem, i, len, j, jLen, item, t;
        if (xml.DEF) {
            json.ps = xml.PROS.PRO ? (xml.PROS.PRO.length ? xml.PROS.PRO[0].$ : xml.PROS.PRO.$) : '';

            json.pron = xml.AH ? 'http://media.engkoo.com:8129/en-us/' + xml.AH.$ + '.mp3' : '';

            json.tt = [];
            elems = xml.DEF[0].SENS;
            if (elems) {
                if (!elems.length) {elems = [elems]}
                for (i = 0, len = elems.length ; i < len ; i += 1) {
                    item = elems[i];
                    if (item.SEN.length) {
                        t = [];
                        for (j = 0, jLen = item.SEN.length ; j < jLen ; j += 1) {
                            t.push(item.SEN[j].D.$);
                        }
                        t = t.join(',')
                    }
                    else {
                        t = item.SEN.D.$;
                    }

                    json.tt.push({
                        pos: item.$POS,
                        acceptation: t
                    });
                }
            }
        }

        this.super.ajaxLoad.call(this, e);
    };





    function powerwordT(word, success, error) {
        ajax(
            'POST',
            'http://fy.iciba.com/interface.php',
            't=auto&content=' + encodeURIComponent(word),
            function (e) {
                var json = {key: word, type: 'translate'}, result = e.target.responseText;
                if (result) {
                    json.tt = result;
                    success(json);
                }
                else {
                    error();
                }
            },
            function (e) {
                console.log(e);
                error();
            }
        );
    }


    function baiduT(word, success, error) {
        ajax(
            'POST',
            'http://fanyi.baidu.com/transcontent',
            'ie=utf-8&source=txt&t=1319299803844&token=6676e72ea0f1a94a7dc95c52a4c46761&from=auto&to=auto&query=' + encodeURIComponent(word),
            function (e) {
                var json = {key: word, type: 'translate'}, result = e.target.responseText;
                result = JSON.parse(result);
                if (result.data && result.data.length) {
                    json.tt = result.data[0].dst
                    success(json);
                }
                else {
                    error();
                }
            },
            function (e) {
                console.log(e);
                error();
            }
        );
    }

    function youdaoT(word, success, error) {
        ajax(
            'POST',
            'http://fanyi.youdao.com/translate?smartresult=dict&smartresult=rule&smartresult=ugc&sessionFrom=http://dict.youdao.com/',
            'type=AUTO&doctype=json&xmlVersion=1.4&keyfrom=fanyi.web&ue=UTF-8&typoResult=true&flag=false&i=' + encodeURIComponent(word),
            function (e) {
                var json = {key: word, type: 'translate'}, result = e.target.responseText, i, len, item;
                result = JSON.parse(result);
                if (result.translateResult.length) {
                    json.tt = '';
                    for (i = 0, len = result.translateResult[0].length ; i < len ; i += 1) {
                        json.tt += result.translateResult[0][i].tgt
                    }
                    success(json);
                }
                else {
                    error();
                }
            },
            function (e) {
                console.log(e);
                error();
            }
        );
    }

	function googleT(word, success, error) {
		var zh =/[\u4e00-\u9fa5]/.test(word), sl, tl;
		if (zh) {
			sl = 'zh-CN';
			tl = 'en';
		}
		else {
			sl = 'en';
			tl = 'zh-CN';
		}
        ajax(
            'GET',
            'http://translate.google.com/translate_a/t',
            'client=t&hl=zh-CN&sl='+sl+'&tl='+tl+'&text=' + encodeURIComponent(word),
            function (e) {
                var json = {key: word, type: 'translate'}, result = e.target.responseText, i, len, item;
                result = eval('(' + result + ')');
                if (result[0]) {
                    json.tt = result[0][0][0];
                    success(json);
                }
                else {
                    error();
                }
            },
            function (e) {
                console.log(e);
                error();
            }
        );
    }

})();
