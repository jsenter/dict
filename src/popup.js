(function (window, document, undefined) {
    var port = chrome.extension.connect({name: 'dict'}),
    searchbox = document.querySelector('textarea'),
    dict = document.querySelector('nav'),
    content = document.querySelector('section'),
    wordList = document.querySelector('notes');
    btnCapure = document.querySelectorAll('footer a'),
    btnAddToNotes = document.getElementById('addToNotes');
    btnClearNotes = document.getElementById('clearNotes');
    setting = JSON.parse(localStorage.capture),
    rSingleWord = /^[a-z]+([-'][a-z]+)*$/i,
    dictCurrent = localStorage.mainDict,
    translateCurrent = localStorage.translate;
    
    initWordList();
    
    function initWordList() {
    	var strWords = "";
    	
    	if ( localStorage['notes'] == 'undefined' )
    	{
    		localStorage['notes'] = "";
    	}
    	 
    	var words = localStorage['notes'].split("|");
    	for(var w in words)
    	{
    		var word = words[w].trim();
    		strWords += "<a href=\"#\">"+word+"</a><br>"
    	}
    	
    	wordList.innerHTML = strWords;
    }

    port.onMessage.addListener(function (msg) {
        if (msg.key === searchbox.value.trim()) {
            content.innerHTML = tmpl(msg);
        }
    });

    for (var i = 0 ; i < btnCapure.length ; i += 1) {
        if (setting[i].status) {
            btnCapure[i].style.backgroundImage = 'url(../../assets/green.png)';
        }
        else {
            btnCapure[i].style.backgroundImage = 'url(../../assets/red.png)';
        }
        btnCapure[i].addEventListener('click', setCaptureMode, false);
        btnCapure[i].dataset.index = i;
    }

    function setCaptureMode(e) {

        if (/green\.png\)$/.test(this.style.backgroundImage)) {
            setting[this.dataset.index].status = false;
            this.style.backgroundImage = 'url(../../assets/red.png)';
        }
        else {
            setting[this.dataset.index].status = true;
            this.style.backgroundImage = 'url(../../assets/green.png)';
        }

        localStorage.capture = JSON.stringify(setting);

        port.postMessage({cmd: 'setCaptureMode', capture: setting});
    }

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
            str += '<p><span>' + data.tt[i].pos + '</span> ' + data.tt[i].acceptation + '</p>';
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
            if (dict.querySelector('.active')) {dict.querySelector('.active').className = '';}
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
    
    delegate(wordList, 'a', 'click', function(e) {
    	var target = this;
    	
    	console.log(target.text);
    	
    	e.preventDefault();
    	searchbox.value = target.text;
    	//port.postMessage({cmd: 'query', w: target.text, dict: dict.querySelector('.active').rel, type: dict.querySelector('.active').parentNode.id});
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
    
    btnAddToNotes.addEventListener('click', function(e){
		var newWord = searchbox.value.trim();
		localStorage['notes'] = newWord + "|" + localStorage['notes'];
		
		initWordList();
    });
    
    btnClearNotes.addEventListener('click', function(e) {
    	console.log('clear notes');
    	
    	localStorage['notes'] = "";
    	initWordList();
    });

})(this, this.document);
