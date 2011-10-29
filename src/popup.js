(function () {
    this.delegate = function (node, selector, type, handler) {
        node.delegate || (node.delegate = {});
        node.delegate[selector] = {handler: handler};
        this.delegate.nodeList || (this.delegate.nodeList = []);
        if (this.delegate.nodeList.indexOf(node) === -1) {
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
            this.delegate.nodeList.push(node);
        }
    };

})();

(function () {
    var port = chrome.extension.connect({name: 'dict'}),
    searchbox = document.querySelector('textarea'),
    navDict = document.getElementById('dict'),
    navTranslate = document.getElementById('translate'),
    content = document.querySelector('section'),
    btnHover = document.getElementById('hover'),
    btnDrag = document.getElementById('drag'),
    rSingleWord = /^[a-z]+([-'][a-z]+)*$/i,
    nav;

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
            if (msg.type === 'translate') {
                content.innerHTML = msg.tt;
            }
            else {
                content.innerHTML = tmpl(msg);
                var pron = content.querySelector('img');
                pron && pron.addEventListener('click', function () {
                    this.nextSibling.play();
                }, false);
            }
        }
    });

    function tmpl(data) {
        var str = '', i, len;
        str += '<h2>' + data.key + '</h2>';
        if (data.ps) {
            str += '<span>[' + data.ps + ']</span>';
        }
        if (data.pron) {
            str += '<img src="' + drawAlert(300, 300).toDataURL() + '"><audio src="' + data.pron + '"></audio>';
        }
        str += '<ul>';
        if (data.tt) {
            for (i = 0, len = data.tt.length ; i < len ; i += 1) {
                str += '<li>' + data.tt[i].pos + ' ' + data.tt[i].acceptation + '</li>';
            }
        }
        else {
            str += '<li>查询不到结果</li>';
        }
        str += '</ul>';
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
        var diff = this.scrollHeight - this.offsetHeight, r, p, key;
        if (diff) {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        }

        key = this.value.trim();

        if (rSingleWord.test(key)) {
            dict.className = '';
            translate.className = 'disabled';
        }
        else {
            dict.className = 'disabled';
            translate.className = '';
        }

        if (key.length > 0) {
            setTimeout(function () {
                if (e.target.value.trim() === key) {
                    content.innerHTML = '<h1>翻译中...</h1>';
                    port.postMessage({cmd: 'query', w: key, dict: document.querySelector('nav div:not(.disabled) .active').rel});
                }
            }, 1000);
        }
        else {
            content.innerHTML = '<h1>等待输入...</h1>';
            this.style.height = '28px';
        }
    }, false);

    function dictSwitch(e) {
        if (this.parentNode.className === 'disabled') {return false;}
        if (this.className === '') {
            this.parentNode.querySelector('.active').className = '';
            this.className = 'active';
            if (searchbox.value.trim().length > 0) {
                port.postMessage({cmd: 'query', w: searchbox.value.trim(), dict: this.rel});
            }
        }
        e.preventDefault();
    }
    nav = dict.querySelectorAll('a');
    for (var i = 0, len =  nav.length ; i < len ; i += 1) {
        nav[i].addEventListener('click', dictSwitch, false);
        if (nav[i].rel === localStorage.mainDict) {
            nav[i].className = 'active';
        }
    }

    nav = translate.querySelectorAll('a');
    for (var i = 0, len =  nav.length ; i < len ; i += 1) {
        nav[i].addEventListener('click', dictSwitch, false);
        if (nav[i].rel === localStorage.translate) {
            nav[i].className = 'active';
        }
    }
})();
