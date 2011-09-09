(function () {
    var port = chrome.extension.connect({name: 'dict'}), btnHover, btnDrag, searchbox, content, nav;
    btnHover = document.getElementById('hover');
    btnDrag = document.getElementById('drag');
    content = document.querySelector('section');
    port.postMessage({cmd: 'getCaptureMode'});
    port.onMessage.addListener(function (msg) {
        if (msg.cmd === 'setCaptureMode') {
            if (msg.dragCapture) {
                btnDrag.className = 'active';
            }
           else {
                btnDrag.className = '';
            }

            if (msg.hoverCapture) {
                btnHover.className = 'active';
            }
            else {
                btnHover.className = '';
            }
        }
        else if (msg.key === searchbox.value.trim()) {
            content.innerHTML = tmpl(msg);
            var pron = content.querySelector('img');
            pron && pron.addEventListener('click', function () {
                this.nextSibling.play();
            }, false);
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

    function setCaptureMode() {
        this.className = this.className === '' ? 'active' : '';
        //console.log({cmd: 'setCaptureMode', dragCapture: btnDrag.className === 'active', hoverCapture: btnHover.className === 'active'})
        port.postMessage({cmd: 'setCaptureMode', dragCapture: btnDrag.className === 'active', hoverCapture: btnHover.className === 'active'});
    }
    btnHover.addEventListener('click', setCaptureMode, false);
    btnDrag.addEventListener('click', setCaptureMode, false);


    searchbox = document.querySelector('input');
    searchbox.addEventListener('keyup', function (e) {
        if (e.keyCode === 13 && this.value.trim().length > 0) {
            port.postMessage({cmd: 'query', w: this.value.trim(), dict: localStorage.mainDict});
            e.preventDefault();
        }
    }, false);
    searchbox.addEventListener('input', function (e) {
        if (this.value.trim() === '') {
            content.innerHTML = '<h1>键入要查找的词语…</h1>';
        }
    }, false);

    function dictSwitch(e) {
        if (this.className === '') {
            for (var i = 0, len =  nav.length ; i < len ; i += 1) {
                nav[i].className = '';
            }
            this.className = 'active';
            if (searchbox.value.trim().length > 0) {
                port.postMessage({cmd: 'query', w: searchbox.value.trim(), dict: this.rel});
            }
        }
        e.preventDefault();
    }
    nav = document.querySelectorAll('nav a');
    for (var i = 0, len =  nav.length ; i < len ; i += 1) {
        nav[i].addEventListener('click', dictSwitch, false);
        if (nav[i].rel === localStorage.mainDict) {
            nav[i].className = 'active';
        }
    }
})();
