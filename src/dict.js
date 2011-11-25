(function (window, document, undefined) {

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

    function delegate(node, selector, type, handler) {
        node.delegate || (node.delegate = {});
        node.delegate[selector] = {handler: handler};
        delegate.nodeList || (delegate.nodeList = []);
        if (delegate.nodeList.indexOf(node) === -1) {
            node.addEventListener(type, function (e) {
                var target = e.target, key, tmp;
                do {
                    for (key in node.delegate) {
                        tmp = node.delegate[key];
                        if (Array.prototype.indexOf.call(node.querySelectorAll(key), target) > -1) {
                            delete e.target;
                            e.target = target;
                            tmp.handler.call(target, e);
                            return;
                        }
                    }
                    target = target.parentNode;
                }
                while (target && target !== this);
            }, false);
            delegate.nodeList.push(node);
        }
    }


    function Dict (args) {
        args = args || {};
        this.scope = args.scope || document.body;
        this.hoverCapture = args.hoverCapture;
        this.dragCapture = args.dragCapture;
        this.hotKey = args.hotKey || null;
        this.assistKey = args.assistKey || null;
        this.speed = args.speed || 50;
        this.skin = args.skin || 'orange';
        this.ui = null;
        this.port = chrome.extension.connect({name: 'dict'});

        this.rHasWord = /\b[a-z]+([-'][a-z]+)*\b/i;
        this.rAllWord = /\b[a-z]+([-'][a-z]+)*\b/gmi;
        this.rSingleWord = /^[a-z]+([-'][a-z]+)*$/i;

        this.port.onMessage.addListener(proxy(function (msg) {
            this.show(msg);
        }, this));

        this.hotKey && this.scope.addEventListener('keyup', this.hoverHanlderProxy = proxy(this.hotKeyHandler, this), false);
        this.dragCapture && this.setDragCapture();
        this.hoverCapture && this.setHoverCapture();
    };

    Dict.prototype.setDragCapture = function () {
        if (this.dblclickProxy) {
            this.scope.removeEventListener('click', this.dblclickProxy, false);
            this.scope.removeEventListener('mousedown', this.dragStartProxy, false);
            this.dblclickProxy = null;
            this.dragStartProxy = null;
            this.ui.style.display = 'none';
            this.dragCapture = false;
        }
        else {
            this.scope.addEventListener('click', this.dblclickProxy = proxy(this.dblclick, this), false);
            this.scope.addEventListener('mousedown', this.dragStartProxy = proxy(this.dragStart, this), false);
            this.dragCapture = true;
        }
    };

    Dict.prototype.setHoverCapture = function () {
        if (this.hoverProxy) {
            this.scope.removeEventListener('mouseover', this.hoverProxy, false);
            this.hoverProxy = null;
            this.getMousePosProxy = null;
            this.ui.style.display = 'none';
            this.hoverCapture = false;
        }
        else {
            this.scope.addEventListener('mouseover', this.hoverProxy = proxy(this.hoverTrigger, this), false);
            this.hoverCapture = true;
        }
    };

    Dict.prototype.hotKeyHandler = function (e) {
        var self = this;
        if (e.keyCode === this.hotKey.hover.keyCode && e.ctrlKey === this.hotKey.hover.ctrlKey
           && e.altKey === this.hotKey.hover.altKey && e.shiftKey === this.hotKey.hover.shiftKey && e.metaKey === this.hotKey.hover.metaKey) {
            this.setHoverCapture();
            this.port.postMessage({cmd: 'setCaptureMode', dragCapture: this.dragCapture, hoverCapture: this.hoverCapture});
        }
        else if (e.keyCode === this.hotKey.drag.keyCode && e.ctrlKey === this.hotKey.drag.ctrlKey
           && e.altKey === this.hotKey.drag.altKey && e.shiftKey === this.hotKey.drag.shiftKey && e.metaKey === this.hotKey.drag.metaKey) {
            this.setDragCapture();
            this.port.postMessage({cmd: 'setCaptureMode', dragCapture: this.dragCapture, hoverCapture: this.hoverCapture});
        }
    };

    Dict.prototype.dblclick = function (e) {
        if (e.detail > 1) {
            if (!this.assistKey || e.altKey === this.assistKey.altKey && e.ctrlKey === this.assistKey.ctrlKey) {
                this.capture(e);
            }
        }
        /*else if (this.ui) {//this.endPos === null && 
            document.body.removeChild(this.ui);
            this.ui = null;
        }*/
    };

    Dict.prototype.dragStart = function (e) {
        document.dictonmouseup = proxy(this.dragEnd, this);
        document.addEventListener('mouseup', document.dictonmouseup, false);
        this.startPos = e.pageX;
        this.endPos = null;
        this.onDrag = true;
        if (this.ui) {
            document.body.removeChild(this.ui);
            this.ui = null;
        }
    };

    Dict.prototype.dragEnd = function (e) {
        if (this.startPos !== e.pageX) {
            if (!this.assistKey || e.altKey === this.assistKey.altKey && e.ctrlKey === this.assistKey.ctrlKey) {
                this.endPos = e.pageX;
                this.capture(e);
            }
        }
        this.onDrag = false;
        document.removeEventListener('mouseup', document.dictonmouseup, false);
    };

    Dict.prototype.hoverTrigger = function (e) {

        if (this.onDrag) {return;}

        if (this.assistKey && (e.altKey !== this.assistKey.altKey || e.ctrlKey !== this.assistKey.ctrlKey)) {return;}

        if (e.target.nodeName.toLowerCase() === 'textarea') {return;}

        if (this.timer === null) {
            this.hoverHanlder(e);
            return;
        }

        this.hoverX = e.pageX;
        this.hoverY = e.pageY;
        clearTimeout(this.timer);
        this.timer = setTimeout(proxy(function () {
            if (this.hoverX === e.pageX && this.hoverY === e.pageY) {
                this.hoverHanlder(e);
            }
        }, this), this.speed * 20);
    };

    Dict.prototype.hoverHanlder = function (e) {
        if (this.ui) {
            document.body.removeChild(this.ui);
            this.ui = null;
        }
        this.text = null;
        this.timer = undefined;
        var parent = e.target, elems, wraper, i, len, elem, next;
        elems = parent.childNodes;
        if (elems.length === 1) {
            elem = elems[0];
            if (elem.nodeType === 3) {
                var text = elem.nodeValue;
                if (this.rSingleWord.test(text) && parent.resolve) {
                    this.text = elem.nodeValue;
                    this.handle(e);
                    this.node = parent;
                }
                else if (this.rHasWord.test(text)) {
                    text = text.replace(this.rAllWord, function (str) {
                        return '<z>' + str + '</z>';
                    });
                    this.timer = null;
                    parent.innerHTML = text;
                    elems = parent.getElementsByTagName('z');
                    for (i = 0, len = elems.length ; i < len ; i += 1) {
                        elems[i].resolve = true;
                    }
                }
            }
        }
        else if (!parent.resolve) {
            elems = Array.prototype.slice.call(elems, 0);
            this.timer = null;
            for (i = 0, len = elems.length ; i < len ; i += 1) {
                elem = elems[i];
                if (elem.nodeType === 3 && this.rHasWord.test(elem.nodeValue)) {
                    wraper = document.createElement('z');
                    parent.insertBefore(wraper, elem);
                    wraper.appendChild(elem);
                }
            }
        }
        parent.resolve = true;
    };

    Dict.prototype.capture = function (e) {
        this.node = null;
        this.text = window.getSelection().toString().trim();
        this.handle(e);
    };

    Dict.prototype.handle = function (e, type) {
        var data = {};
        if (this.text.length > 0) {
            data['cmd'] = 'query';
            data['w'] = this.text;
            this.port.postMessage(data);
        }
    };





    function DictSimple(args) {
        this.super.constructor.call(this, args);
    }

    extend(DictSimple, Dict);

    DictSimple.prototype.drawAlert = function (w, h) {
        var canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
        canvas.width = w;
        canvas.height = h;
        ctx.beginPath();
        ctx.fillStyle = '#000';

        ctx.moveTo(26, 71);
        ctx.lineTo(84, 71);
        ctx.lineTo(177, 0);
        ctx.lineTo(177, 300);
        ctx.lineTo(84, 229);
        ctx.lineTo(26, 229);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = '#000';

        ctx.moveTo(222, 76);
        ctx.lineTo(236, 63);
        ctx.bezierCurveTo(272, 93, 296, 186, 234, 247);
        ctx.lineTo(220, 234);
        ctx.bezierCurveTo(253, 202, 270, 131, 222, 76);
        ctx.closePath();
        ctx.fill();
        return canvas;
    };

    DictSimple.prototype.eventClear = function (e) {
        e.stopPropagation();
    };

    DictSimple.prototype.show = function (data) {
        var i, len, str = '';
        if (data.key === this.text) {
            if (!this.node && window.getSelection().toString().trim() !== this.text) {
                this.text = '';
                return;
            }
            if (this.ui) {
                document.body.removeChild(this.ui);
                this.ui = null;
            }
            this.ui = document.createElement('aside');
            this.ui.id = 'dict-viclm-simple';
            this.ui.className = this.skin;
            str += '<header><h1>' + data.key + '</h1>';
            if (data.ps) {
                str += '<span>[ ' + data.ps + ' ]</span>';
            }
            if (data.pron) {
                str += '<img src="' + this.drawAlert(300, 300).toDataURL() + '"><audio src="' + data.pron + '"></audio>';
            }
            str += '</header>';
            for (i = 0, len = data.tt.length ; i < len ; i += 1) {
                str += '<p><span>' + data.tt[i].pos + '</span> ' + data.tt[i].acceptation + '</p>';
            }
            str += '<div class="down"></div>';

            this.ui.innerHTML = str;
            document.body.appendChild(this.ui);
            this.ui.addEventListener('mouseover', this.eventClear, false);
            this.ui.addEventListener('mousedown', this.eventClear, false);
            delegate(this.ui, 'img', 'click', function () {
                this.nextSibling.play();
            });
            this.position();
        }
    };

    DictSimple.prototype.position = function () {
        this.ui.style.left = 0 + 'px';
        this.ui.style.top = 0 + 'px';
        var left, top, triangleLeft, triangleClass, clientRectForUI, clientRectForNode;
        clientRectForUI = this.ui.getBoundingClientRect();

        if (this.node) {
            clientRectForNode = this.node.getBoundingClientRect();
        }
        else {
            clientRectForNode = window.getSelection().getRangeAt(0).getBoundingClientRect();
        }

        this.x = clientRectForNode.left + document.body.scrollLeft;
        this.y = clientRectForNode.top + document.body.scrollTop;
        left = this.x - (clientRectForUI.width  - clientRectForNode.width) / 2;
        top = this.y - clientRectForUI.height - 5;

        if (left - document.body.scrollLeft < 0) {
            left = document.body.scrollLeft;
            triangleLeft = clientRectForNode.right - 18;
        }
        else if (left + clientRectForUI.width > document.body.clientWidth + document.body.scrollLeft) {
            left = document.body.clientWidth + document.body.scrollLeft - clientRectForUI.width;
            triangleLeft = this.x - left + 6;
        }
        else {
            triangleLeft = clientRectForUI.width / 2 - 6;
        }

        if (top - document.body.scrollTop < 0) {
            top = this.y + clientRectForNode.height + 10;
            triangleClass = 'up';
        }
        else {
            triangleClass = 'down';
        }
        this.ui.style.left = left + 'px';
        this.ui.style.top = top + 'px';
        this.ui.querySelector('div').style.left = triangleLeft + 'px';
        this.ui.querySelector('div').className = triangleClass;
    };

    var dict;

    chrome.extension.sendRequest({cmd: 'config'}, function (response) {
        dict = new DictSimple({
            hotKey: response.hotKey,
            assistKey: response.assistKey,
            speed: response.speed,
            skin: response.skin,
            hoverCapture: response.hoverCapture,
            dragCapture: response.dragCapture
        });
    });

    chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
        if (dict && request.cmd === 'setCaptureMode') {
            request.hoverCapture !== dict.hoverCapture && dict.setHoverCapture();
            request.dragCapture !== dict.dragCapture && dict.setDragCapture();
        }
    });

})(this, this.document);
