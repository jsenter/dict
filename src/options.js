(function () {
    var mainview, dicts;

    function init() {
        mainview = document.getElementById('mainview');
        dicts = document.getElementById('hoverSection');

        uiEnhance();
        restoreOptions();
    }

    function uiEnhance() {
        var elements, elem, i, len;
        //navtab
        elements = document.getElementById('navbar-container').querySelectorAll('li');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elements[i].addEventListener('click', navTab, false);
        }
        //save options
        elements = mainview.querySelectorAll('#skinSection label');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elements[i].addEventListener('click', saveOptions, false);
        }
        //check switch
        elements = mainview.querySelectorAll('#hotKeySection label:only-child');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elements[i].addEventListener('click', checkSwitchClickHanlder, false);
        }
        //dict
        elements = mainview.querySelectorAll('#hoverSection select');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elements[i].addEventListener('change', setDict, false);
        }
        //speed
        elements = mainview.querySelectorAll('#hoverSection input[type=range]');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elements[i].addEventListener('change', setSpeed, false);
        }
        //assist key
        elements = mainview.querySelectorAll('#assistKeySection select');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elements[i].addEventListener('change', setAssistKey, false);
        }
        //hot key
        elements = mainview.querySelectorAll('#hotKeySection input[type=text]');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elem = elements[i];
            elem.addEventListener('keyup', setHotKey, false);
            elem.addEventListener('keydown', function (e) {
                e.preventDefault();
            }, false);
        }
    }

    function navTab() {
        if (navTab.last !== this.id) {
            document.getElementById(this.id.slice(0, -3)).style.display = '';
            this.className = 'selected';
            document.getElementById(navTab.last.slice(0, -3)).style.display = 'none';
            document.getElementById(navTab.last).className = '';
            navTab.last = this.id;
        }
    }
    navTab.last = 'browserPageNav';

    function checkSwitch(controller, depend) {
        var i = 0, len = depend.length;
        if (controller.checked) {
            for (; i < len ; i += 1) {
                depend[i].disabled = true;
            }
        }
        else {
            for (; i < len ; i += 1) {
                depend[i].disabled = false;
            }
        }
    }

    function checkSwitchClickHanlder(e) {
        var target = e.target;
        //fix label tansform event to inner input
        if (target.nodeName === 'INPUT') {
            //this.dispatchEvent(checkSwitchEvent);
            if (target.name === 'hotKeySwitch') {
                checkSwitch(target, target.parentNode.parentNode.parentNode.querySelectorAll('input[type=text]'));
                if (target.checked) {
                    localStorage[target.name] = '0';
                }
                else {
                    localStorage[target.name] = '1';
                }
            }
        }
    }

    // Saves options to localStorage.
    function saveOptions(e) {
        var input = e.target;
        if (input.nodeName === 'INPUT' && input.checked) {
            localStorage[input.name] = input.value;
        }
    }

    function setDict(e) {
        var target = e.target, assistDict, opt;
        if (target.name === 'mainDict') {
            assistDict = dicts.querySelector('select:last-of-type');
            opt = assistDict.querySelector('[style]');
            if (opt) {
                opt.style.display = '';
            }
            assistDict.querySelector('[value=' + target.value + ']').style.display = 'none';
        }
        localStorage[target.name] = target.value;
    }

    function setSpeed() {
        localStorage.speed = this.value;
    }

    function setAssistKey(e) {
        localStorage.assistKey = this.value;
    }

    function setHotKey(e) {
        var keyCode = e.keyCode, key, hotKeys = {}, i, value = '';

        if (keyCode === 8) {
            value = '';
            hotKeys = {};
        }

        if (64 < keyCode && keyCode < 91 || 111 < keyCode && keyCode < 124 || 47 < keyCode && keyCode < 58) {
            hotKeys.ctrlKey = e.ctrlKey;
            hotKeys.altKey = e.altKey;
            hotKeys.shiftKey = e.shiftKey;
            hotKeys.metaKey = e.metaKey;

            for (i in hotKeys) {
                if (hotKeys[i]) {
                    switch (i) {
                        case 'ctrlKey':
                            key = 'CTRL';
                        break;
                        case 'altKey':
                            key = 'ALT';
                        break;
                        case 'shiftKey':
                            key = 'SHIFT';
                        break;
                        case 'metaKey':
                            key = 'META';
                        break;
                    }
                    value += '+' + key;
                }
            }

            if (111 < keyCode && keyCode < 124) {
                key = 'F' + (keyCode - 111);
            }
            else {
                key = String.fromCharCode(keyCode);
            }
            value += '+' + key;
            value = value.substring(1);
            this.value = value;
            hotKeys.keyCode = keyCode;
            localStorage[this.name] = JSON.stringify(hotKeys);
        }
    }

    // Restores select box state to saved value from localStorage.
    function restoreOptions() {
        var i, len, elements, elem;

        elements = mainview.querySelectorAll('input[type=radio]');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elem = elements[i];
            if (elem.value === localStorage[elem.name]) {
                elem.checked = true;
            }
            else {
                elem.checked = false;
            }
        }

        elements = mainview.querySelectorAll('input[type=checkbox]');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elem = elements[i];
            if (localStorage[elem.name] === elem.value) {
                elem.checked = true;
            }
            else {
                elem.checked = false;
            }
            checkSwitch(elem, elem.parentNode.parentNode.parentNode.querySelectorAll('input[type=text]'));
        }

        elements = mainview.querySelectorAll('#hoverSection select');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elem = elements[i];
            elem.querySelector('option[value=' + localStorage[elem.name] + ']').selected = true;
            setDict.call(elem, {target: elem});
        }

        elements = mainview.querySelectorAll('#hoverSection input[type=range]');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elem = elements[i];
            elem.value = localStorage.speed;
        }

        elements = mainview.querySelectorAll('#assistKeySection select');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elem = elements[i];
            elem.querySelector('option[value=' + localStorage.assistKey + ']').selected = true;
        }


        //hot key
        elements = mainview.querySelectorAll('#hotKeySection input[type=text]');
        for (i = 0, len = elements.length ; i < len ; i += 1) {
            elem = elements[i];
            setHotKey.call(elem, JSON.parse(localStorage[elem.name]));
        }
    }

    document.addEventListener('DOMContentLoaded', init, false);
})();
