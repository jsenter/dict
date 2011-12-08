(function (window, document, undefined) {

    function ajax(method, url, data, success, error, timeout) {
        var client = new XMLHttpRequest(), isTimeout = false, isComplete = false;
        method = method.toLowerCase();
        if (method === 'get' && data) {
            url += '?' + data;
            data = null;
        }
        client.onload = function () {
            if (!isComplete) {
                if (!isTimeout && ((client.status >= 200 && client.status < 300) || client.status == 304)) {
                    success(client);
                }
                else {
                    error(client);
                }
                isComplete = true;
            }
        };
        client.onerror = function () {
            if (!isComplete) {
                error(client);
                isComplete = true;
            }
        };
        client.open(method, url, true);
        if (method === 'post') {client.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');}
        client.setRequestHeader('ajax', 'true');
        client.send(data);
        setTimeout(function () {
            isTimeout = true;
            if (!isComplete) {
                client.timeout = true;
                error(client);
                isComplete = true;
            }
        }, timeout || 2000);
    }

    function extend(childCtor, parentCtor) {
        var fnTest = /\bsuperclass\b/, parent = parentCtor.prototype
        function tempCtor() {};
        if (parent.superclass && !parent.multiSuperclass) {
            parent.multiSuperclass = true;
            for (var name in parent) {
                if (parent.hasOwnProperty(name) && fnTest.test(parent[name])) {
                    parent[name] = (function (name, fn) {
                        return function () {
                            var bak = this.superclass[name];
                            this.superclass[name] = parent.superclass[name];
                            var res = fn.apply(this, arguments);
                            this.superclass[name] = bak;
                            return res;
                        }
                    })(name, parent[name]);
                }
            }
        }
        tempCtor.prototype = parent;
        childCtor.prototype = new tempCtor();
        childCtor.prototype.superclass = parentCtor.prototype;
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
        this.loadend = args.loadend || function(){};
        this.load = args.load || function(){};
        this.error = args.error || function(){};

        this.res = {};
        this.res.key = this.word;
        this.res.tt = [];
    }

    Query.prototype.query = function () {
        ajax(this.type, this.api, this.data, proxy(this.ajaxLoad, this), proxy(this.ajaxError, this));
    };

    Query.prototype.ajaxLoad = function (client) {
        if (this.res.tt && this.res.tt.length > 0) {
            this.load(this.res);
            this.loadend(this.res);
        }
        else {
            this.ajaxError();
        }
    };

    Query.prototype.ajaxError = function (client) {
        this.res = {};
        this.res.key = this.word;
        this.res.tt = [{pos: '', acceptation: '查询不到结果'}];
        this.error(this.res);
        this.loadend(this.res);
    };




    function Dict(args) {
        args = args || {};
        this.superclass.constructor.call(this, args);
    }

    extend(Dict, Query);

    Dict.prototype.query = function () {
        var self = this;
        database.transaction(function (tx) {
            tx.executeSql('SELECT * FROM dicty WHERE word=? AND api=?', [self.word, self.model], function (tx, result) {
                if (result.rows.length > 0) {
                    self.res = JSON.parse(result.rows.item(0).content);
                    self.load(self.res);
                    self.loadend(self.res);
                }
                else {
                    ajax(self.type, self.api, self.data, proxy(self.ajaxLoad, self), proxy(self.ajaxError, self));
                }
            });/*, function (tx, err) {
                console.log('selct error', arguments);
                ajax(self.type, self.api, self.data, proxy(self.ajaxLoad, self), proxy(self.ajaxError, self));
            }*/
        });
    };

    Dict.prototype.updateDB = function (data) {
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

    Dict.prototype.ajaxLoad = function (client) {
        if (this.res.tt.length > 0) {
            this.load(this.res);
            this.updateDB(this.res);
            this.loadend(this.res);
        }
        else {
            this.ajaxError();
        }
    };




    function Powerword(args) {

        this.superclass.constructor.call(this, args);

        this.api = 'http://dict-co.iciba.com/api/dictionary.php';
        this.type = 'get';
        this.data = 'w=' + this.word;
        this.model = 'powerword';
    }

    extend(Powerword, Dict);

    Powerword.prototype.ajaxLoad = function (client) {
        var xml = client.responseXML, json = this.res, elems, elem, i, len, item;
        if (xml) {
            elems = xml.getElementsByTagName('ps')[0];
            json.ps = elems ? elems.firstChild.nodeValue : '';

            elems = xml.getElementsByTagName('pron')[0];
            json.pron = elems ? elems.firstChild.nodeValue.trim() : '';

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

        this.superclass.ajaxLoad.call(this, client);
    };


    function Dictcn(args) {

        this.superclass.constructor.call(this, args);

        this.api = 'http://dict.cn/ws.php';
        this.type = 'get';
        this.data = 'utf8=true&q=' + this.word;
        this.model = 'dictcn';
    }

    extend(Dictcn, Dict);

    Dictcn.prototype.ajaxLoad = function (client) {
        var xml = client.responseText, json = this.res, elems, elem, i, len, item, parser, reg = /[a-z]\..+?(?=[a-z]\.|$)/gm, reg2 = /^[a-z]+?\./i;
        if (xml) {
            parser = new DOMParser();
            xml = parser.parseFromString(xml,"text/xml");
            elem = xml.getElementsByTagName('pron')[0];
            json.ps = elem ? elem.firstChild.nodeValue : '';

            elem = xml.getElementsByTagName('audio')[0];
            json.pron = elem ? elem.firstChild.nodeValue : '';

            elem = xml.getElementsByTagName('def')[0];
            if (elem) {
                elems = elem.firstChild.nodeValue.split('\n');
                if (elems) {
                    for (i = 0, len = elems.length ; i < len ; i += 1) {
                        json.tt.push({
                            pos: '',
                            acceptation: elems[i].replace(reg2, function (str) {
                                return '<span>' + str + '</span>';
                            })
                        });
                    }
                }
            }
        }

        this.superclass.ajaxLoad.call(this, client);
    };


    function QQDict(args) {

        this.superclass.constructor.call(this, args);

        this.api = 'http://dict.qq.com/dict';
        this.type = 'get';
        this.data = 'f=web&q=' + this.word;
        this.model = 'qqdict';
    }

    extend(QQDict, Dict);

    QQDict.prototype.ajaxLoad = function (client) {
        var xml = JSON.parse(client.responseText), json = this.res, elems, elem, i, len, item;//eval('(' + client.responseText + ')')
        if (xml.local) {
            xml = xml.local[0];
            json.ps = xml.pho ? xml.pho[0] : '';

            json.pron = xml.sd ? 'http://speech.dict.qq.com/audio/' + xml.sd.substring(0, 3).split('').join('/') + '/' + xml.sd + '.mp3' : '';

            elems = xml.des;
            if (elems) {
                for (i = 0, len = elems.length ; i < len ; i += 1) {
                    item = elems[i];
                    json.tt.push({
                        pos: (item.p ? item.p : ''),
                        acceptation: item.d
                    });
                }
            }
        }

        this.superclass.ajaxLoad.call(this, client);
    };


    function Bing(args) {

        this.superclass.constructor.call(this, args);

        this.api = 'http://dict.bing.com.cn/io.aspx';
        this.type = 'post';
        this.data = 't=dict&ut=default&ulang=ZH-CN&tlang=EN-US&q=' + this.word;
        this.model = 'bing';
    }

    extend(Bing, Dict);

    Bing.prototype.ajaxLoad = function (client) {
        var xml = JSON.parse(client.responseText).ROOT, json = this.res, elems, elem, i, len, j, jLen, item, t;
        if (xml.DEF) {
            json.ps = xml.PROS.PRO ? (xml.PROS.PRO.length ? xml.PROS.PRO[0].$ : xml.PROS.PRO.$) : '';

            json.pron = xml.AH ? 'http://media.engkoo.com:8129/en-us/' + xml.AH.$ + '.mp3' : '';

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
                        pos: item.$POS + '.',
                        acceptation: t
                    });
                }
            }
        }

        this.superclass.ajaxLoad.call(this, client);
    }


    function PowerwordT(args) {
        this.superclass.constructor.call(this, args);

        this.api = 'http://fy.iciba.com/interface.php';
        this.type = 'post';
        this.data = 't=auto&content=' + encodeURIComponent(this.word);
    }

    extend(PowerwordT, Query);

    PowerwordT.prototype.ajaxLoad = function (client) {
        var result = client.responseText;
        if (result) {
            this.res.tt = [{pos: '', acceptation: result}];
        }
        this.superclass.ajaxLoad.call(this, client);
    }


    function BaiduT(args) {
        this.superclass.constructor.call(this, args);

        this.api = 'http://fanyi.baidu.com/transcontent';
        this.type = 'post';
        this.data = 'ie=utf-8&source=txt&t=1319299803844&token=6676e72ea0f1a94a7dc95c52a4c46761&from=auto&to=auto&query=' + encodeURIComponent(this.word);
    }

    extend(BaiduT, Query);

    BaiduT.prototype.ajaxLoad = function (client) {
        var result = JSON.parse(client.responseText), i, len, item, acceptation = '';
        if (result.data && result.data.length) {
            for (i = 0, len = result.data.length ; i < len ; i += 1) {
                item = result.data[i];
                acceptation += item.dst;
            }
            this.res.tt = [{pos: '', acceptation: acceptation}];
        }
        this.superclass.ajaxLoad.call(this, client);
    }

    function YoudaoT(args) {
        this.superclass.constructor.call(this, args);

        this.api = 'http://fanyi.youdao.com/translate?smartresult=dict&smartresult=rule&smartresult=ugc&sessionFrom=http://dict.youdao.com/';
        this.type = 'post';
        this.data = 'type=AUTO&doctype=json&xmlVersion=1.4&keyfrom=fanyi.web&ue=UTF-8&typoResult=true&flag=false&i=' + encodeURIComponent(this.word);
    }

    extend(YoudaoT, Query);

    YoudaoT.prototype.ajaxLoad = function (client) {
        var result = JSON.parse(client.responseText).translateResult, i, len, acceptation = '';
        if (result.length) {
            for (i = 0, len = result.length ; i < len ; i += 1) {
                acceptation += result[i][0].tgt
            }
            this.res.tt = [{pos: '', acceptation: acceptation}];
        }
        this.superclass.ajaxLoad.call(this, client);
    }


    function GoogleT(args) {
        this.superclass.constructor.call(this, args);

        var zh =/[\u4e00-\u9fa5]/.test(this.word), sl, tl;
        if (zh) {
            sl = 'zh-CN';
            tl = 'en';
        }
        else {
            sl = 'en';
            tl = 'zh-CN';
        }

        this.api = 'http://translate.google.com/translate_a/t';
        this.type = 'get';
        this.data = 'client=t&hl=zh-CN&sl='+sl+'&tl='+tl+'&text=' + encodeURIComponent(this.word);
    }

    extend(GoogleT, Query);

    GoogleT.prototype.ajaxLoad = function (client) {
        var result = client.responseText, i, len, item, acceptation = '';
        result = eval('(' + result + ')');
        if (result[0]) {
            for (i = 0, len = result[0].length ; i < len ; i += 1) {
                item = result[0][i];
                acceptation += item[0];
            }
            this.res.tt = [{pos: '', acceptation: acceptation}];
        }
        this.superclass.ajaxLoad.call(this, client);
    }


    window.dictapi = {
        dict: {
            powerword: Powerword,
            bing: Bing,
            dictcn: Dictcn,
            qqdict: QQDict
        },

        translate: {
            powerword: PowerwordT,
            baidu: BaiduT,
            youdao: YoudaoT,
            google: GoogleT
        }
    }
})(this, this.document);
