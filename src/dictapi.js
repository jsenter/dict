(function (window, document, undefined) {

    function ajax(method, url, data, success, error, timeout) {
        var client = new XMLHttpRequest(), isTimeout = false;
        method = method.toLowerCase();
        if (method === 'get' && data) {
            url += '?' + data;
            data = null;
        }
        client.onload = function () {
            if (!isTimeout && ((client.status >= 200 && client.status < 300) || client.status == 304)) {
                success(client);
            }
            else {
                error(client);
            }
        };
        client.onerror = function () {
            error(client);
        };
        client.open(method, url, true);
        if (method === 'post') {client.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');}
        client.setRequestHeader('ajax', 'true');
        client.send(data);
        setTimeout(function () {isTimeout = true;}, timeout || 2000);
    };

    function extend(childCtor, parentCtor) {
        function tempCtor() {};
        tempCtor.prototype = parentCtor.prototype;
        childCtor.prototype = new tempCtor();
        childCtor.prototype.super = parentCtor.prototype;
        childCtor.prototype.constructor = childCtor;
    }

    function proxy(fn, obj) {
        return function () {
            return fn.apply(obj, arguments);
        }
    }

    var database = openDatabase('dict', '1.0', 'dict database', 5 * 1024 * 1024);
    database.transaction(function (tx) {
        tx.executeSql('DROP TABLE IF EXISTS dict')
        tx.executeSql('CREATE TABLE IF NOT EXISTS dicty (word text, api text, content text, PRIMARY KEY (word, api))');
    }, function (err) {
        console.log(err)
    });

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
                    ajax(self.type, self.api, self.data, proxy(self.ajaxLoad, self), proxy(self.ajaxError, self));
                }
            }, function (tx, err) {
                console.log(arguments);
                ajax(self.type, self.api, self.data, proxy(self.ajaxLoad, self), proxy(self.ajaxError, self));
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

    Query.prototype.ajaxLoad = function (client) {
        if (this.res.tt && this.res.tt.length > 0) {
            this.load(this.res);
            this.updateDB(this.res);
        }
        else {
            this.ajaxError();
        }
    };

    Query.prototype.ajaxError = function (client) {
        this.res = {};
        this.res.key = this.word;
        this.error(this.res)
    };




    function Powerword(args) {

        this.super.constructor.call(this, args);

        this.api = 'http://dict-co.iciba.com/api/dictionary.php';
        this.type = 'get';
        this.data = 'w=' + this.word;
        this.model = 'powerword';
    }

    extend(Powerword, Query);

    Powerword.prototype.ajaxLoad = function (client) {
        var xml = client.responseXML, json = this.res, elems, elem, i, len, item;
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

        this.super.ajaxLoad.call(this, client);
    };


    function Dictcn(args) {

        this.super.constructor.call(this, args);

        this.api = 'http://dict.cn/ws.php';
        this.type = 'get';
        this.data = 'utf8=true&q=' + this.word;
        this.model = 'dictcn';
    }

    extend(Dictcn, Query);

    Dictcn.prototype.ajaxLoad = function (client) {
        var xml = client.responseText, json = this.res, elems, elem, i, len, item, parser, reg = /[a-z]\..+?(?=[a-z]\.|$)/gm;
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

        this.super.ajaxLoad.call(this, client);
    };


    function QQDict(args) {

        this.super.constructor.call(this, args);

        this.api = 'http://dict.qq.com/dict';
        this.type = 'get';
        this.data = 'q=' + this.word;
        this.model = 'qqdict';
    }

    extend(QQDict, Query);

    QQDict.prototype.ajaxLoad = function (client) {
        var xml = eval('(' + client.responseText + ')'), json = this.res, elems, elem, i, len, item;
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

        this.super.ajaxLoad.call(this, client);
    };


    function Bing(args) {

        this.super.constructor.call(this, args);

        this.api = 'http://dict.bing.com.cn/io.aspx';
        this.type = 'post';
        this.data = 't=dict&ut=default&ulang=ZH-CN&tlang=EN-US&q=' + this.word;
        this.model = 'bing';
    }

    extend(Bing, Query);

    Bing.prototype.ajaxLoad = function (client) {
        var xml = JSON.parse(client.responseText).ROOT, json = this.res, elems, elem, i, len, j, jLen, item, t;
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

        this.super.ajaxLoad.call(this, client);
    };





    function powerwordT(word, success, error) {
        ajax(
            'POST',
            'http://fy.iciba.com/interface.php',
            't=auto&content=' + encodeURIComponent(word),
            function (client) {
                var json = {key: word, type: 'translate'}, result = client.responseText;
                if (result) {
                    json.tt = result;
                    success(json);
                }
                else {
                    error();
                }
            },
            function (e) {
                error();
            }
        );
    }


    function baiduT(word, success, error) {
        ajax(
            'POST',
            'http://fanyi.baidu.com/transcontent',
            'ie=utf-8&source=txt&t=1319299803844&token=6676e72ea0f1a94a7dc95c52a4c46761&from=auto&to=auto&query=' + encodeURIComponent(word),
            function (client) {
                var json = {key: word, type: 'translate'}, result = client.responseText;
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
                error();
            }
        );
    }

    function youdaoT(word, success, error) {
        ajax(
            'POST',
            'http://fanyi.youdao.com/translate?smartresult=dict&smartresult=rule&smartresult=ugc&sessionFrom=http://dict.youdao.com/',
            'type=AUTO&doctype=json&xmlVersion=1.4&keyfrom=fanyi.web&ue=UTF-8&typoResult=true&flag=false&i=' + encodeURIComponent(word),
            function (client) {
                var json = {key: word, type: 'translate'}, result = client.responseText, i, len, item;
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
            function (client) {
                var json = {key: word, type: 'translate'}, result = client.responseText, i, len, item;
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
                error();
            }
        );
    }


    window.dictapi = {
        dict: {
            powerword: Powerword,
            bing: Bing,
            dictcn: Dictcn,
            qqdict: QQDict
        },

        translate: {
            powerword: powerwordT,
            baidu: baiduT,
            youdao: youdaoT,
            google: googleT
        }
    }
})(this, this.document);
