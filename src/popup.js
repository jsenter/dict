(function (window, document, undefined) {
    var port = chrome.extension.connect({name: 'dict'}),
    searchbox = document.querySelector('textarea'),
    dict = document.querySelector('nav'),
    content = document.querySelector('section'),
    btnHover = document.getElementById('hover'),
    btnDrag = document.getElementById('drag'),
    rSingleWord = /^[a-z]+([-'][a-z]+)*$/i,
    dictCurrent = localStorage.mainDict,
    translateCurrent = localStorage.translate;

    port.postMessage({cmd: 'getCaptureMode'});
    port.onMessage.addListener(function (msg) {
        if (msg.cmd === 'setCaptureMode') {
            if (msg.dragCapture) {
                btnDrag.style.backgroundImage = 'url(../../assets/green.png)';
            }
            else {
                btnDrag.style.backgroundImage = 'url(../../assets/red.png)';
            }

            if (msg.hoverCapture) {
                btnHover.style.backgroundImage = 'url(../../assets/green.png)';
            }
            else {
                btnHover.style.backgroundImage = 'url(../../assets/red.png)';
            }
        }
        else if (msg.key === searchbox.value.trim()) {
            content.innerHTML = tmpl(msg);
        }
    });

    function tmpl(data) {
        var str = '', i, len;
        str += '<h2>' + data.key + '</h2>';
        if (data.pron) {
            str += '<img src="' + drawAlert(300, 300).toDataURL() + '"><audio src="' + data.pron + '"></audio>';
        }
        if (data.ps) {
            str += '<p><span>[ ' + data.ps + ' ]</span></p>';
        }
        for (i = 0, len = data.tt.length ; i < len ; i += 1) {
            str += '<p><span>' + data.tt[i].pos + '.</span> ' + data.tt[i].acceptation + '</p>';
        }
        return str;
    }

    function drawAlert(w, h) {
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
    }

    function setCaptureMode(e) {
        var reg = /green\.png\)$/;
            dragCapture = reg.test(btnDrag.style.backgroundImage),
            hoverCapture = reg.test(btnHover.style.backgroundImage);

        if (e.target.id === 'drag') {
            dragCapture = !dragCapture;
        }
        else {
            hoverCapture = !hoverCapture;
        }

        port.postMessage({
            cmd: 'setCaptureMode',
            dragCapture: dragCapture,
            hoverCapture: hoverCapture
        });
    }
    btnHover.addEventListener('click', setCaptureMode, false);
    btnDrag.addEventListener('click', setCaptureMode, false);

    searchbox.focus();
    searchbox.addEventListener('input', function (e) {
        var diff = this.scrollHeight - this.offsetHeight, key;
        if (diff) {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        }

        key = this.value.trim();

        if (rSingleWord.test(key)) {
            if (!dict.querySelector('#dict .active')) {
                if (dict.querySelector('.active')) {dict.querySelector('.active').className = ''}
                dict.querySelector('a[rel='+dictCurrent+']').className = 'active';
            }
        }
        else {
            if (!dict.querySelector('#translate .active')) {
                if (dict.querySelector('.active')) {dict.querySelector('.active').className = ''}
                dict.querySelector('a[rel='+translateCurrent+']').className = 'active';
            }
        }

        if (key.length > 0) {
            setTimeout(function () {
                if (e.target.value.trim() === key) {
                    content.innerHTML = '<h1>翻译中...</h1>';
                    port.postMessage({cmd: 'query', w: key, dict: dict.querySelector('.active').rel, type: dict.querySelector('.active').parentNode.id});
                }
            }, 1000);
        }
        else {
            content.innerHTML = '<h1>等待输入...</h1>';
            this.style.height = '28px';
        }
    }, false);

    delegate(dict, 'a', 'click', function (e) {
        var target = this;
        if (target.className !== 'active') {
            dict.querySelector('.active').className = '';
            target.className = 'active';
            if (target.parentNode.id === 'dict') {
                dictCurrent = target.rel;
            }
            else {
                translateCurrent = target.rel;
            }
            if (searchbox.value.trim().length > 0) {
                port.postMessage({cmd: 'query', w: searchbox.value.trim(), dict: target.rel, type: target.parentNode.id});
            }
        }
        e.preventDefault();
    });

    delegate(content, 'img', 'click', function () {
        this.nextSibling.play();
    });

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

})(this, this.document);
