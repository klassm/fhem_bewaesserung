var bewaesserungDevice = undefined,
    getCsrfToken = function() {
        var req = new XMLHttpRequest();
        req.open('GET', document.location, false);
        req.send(null);
        var headers = req.getAllResponseHeaders().toLowerCase(); 
        return (/x-fhem-csrftoken: ([a-z]+_[0-9a-z]+)/g).exec(headers)[1]
    }

    load = function () {
        var token = getCsrfToken();
        console.log("BEWAE - load() - token=" + token);
        loadJsonList(bewaesserungDevice, token, function (result) {
            var keyValuePairs = toDevices(result);
            console.log("BEWAE - devices is" + JSON.stringify(keyValuePairs));
            fillContent(keyValuePairs, token);
        });
    },
    loadJsonList = function (device, token, callback) {
        console.log("BEWAE - loadJsonList()");
        $.getJSON('?cmd=jsonlist%20' + device + '&XHR=1&&fwcsrf=' + token, function (data) {
            callback(data['ResultSet']['Results']['READINGS']);
        });
    },
    toDevices = function (def) {
        if (!def) {
            return [];
        }
        var keys = Object.keys(def);
        return keys.filter(function (key) {
            return key !== 'null' && key.startsWith(".");
        }).map(function (key) {
            try {
                var json = def[key]["VAL"];
                var device = JSON.parse(json);
                device['delay'] = device['delay'] || 0;
                if (device && !device['identifier']) {
                    device['identifier'] = device['deviceName'];
                }
                return device;
            } catch (e) {
                console.log(e);
                return null;
            }
        }).filter(function (el) {
            return el
        });
    },
    inputElement = function (device, key, desc, disabled, defaultValue) {
        defaultValue = defaultValue || "";
        var value = device[key] ? device[key] : "",
            disabledAttribute = disabled ? 'disabled' : '';
        value = value || defaultValue;

        return $("<div><label for='" + key + "'>" + desc + "</label>" +
            "<input name='" + key + "' value='" + value + "' " + disabledAttribute + "/></div>");
    },
    submitButton = function (token) {
        var submit = $("<button>Submit</button>");
        submit.click(function () {
            var form = $('#BEWAE').find('form'),
                identifier = form.find("[name='identifier']").val(),
                deviceName = form.find("[name='deviceName']").val(),
                weekDays = form.find("[name='weekdays']").val(),
                switchTime = form.find("[name='switchTime']").val(),
                duration = form.find("[name='duration']").val(),
                delay = form.find("[name='delay']").val(),
                before = form.find("[name='before']").val(),
                after = form.find("[name='after']").val(),
                cmd = "set " + bewaesserungDevice + " modify " + JSON.stringify({
                        identifier: identifier,
                        deviceName: deviceName,
                        weekDays: weekDays,
                        switchTime: switchTime,
                        duration: duration,
                        delay: delay,
                        before: before,
                        after: after
                    });

            console.log(cmd);
            $.ajax({
                url: '?fwcsrf=' + token + '&cmd=' + cmd
            })
            .done(function () {
                load();
            });
            return false;
        });
        return submit;
    },

    editDevice = function (device, token) {
        var edit = $("#BEWAE").find('.edit'),
            form = $("<form></form>"),
            closeLink = $("<a class='close'>[close]</a>");

        edit.empty();
        edit.append(closeLink);
        edit.append("<h4>" + (device['identifier'] ? device['identifier'] : 'Hinzufügen') + "</h4>");
        edit.append(form);

        form.append(inputElement(device, 'identifier', 'Ident', device['identifier'] !== undefined));
        form.append(inputElement(device, 'deviceName', 'Gerät', false));
        form.append(inputElement(device, 'weekdays', 'Wochentage', false));
        form.append(inputElement(device, 'switchTime', 'Uhrzeit', false));
        form.append(inputElement(device, 'duration', 'Dauer (s)', false));
        form.append(inputElement(device, 'delay', 'Verzögerung (s)', false, 0));
        form.append(inputElement(device, 'before', 'Vorab', false, ""));
        form.append(inputElement(device, 'after', 'Anschließend', false, ""));

        form.append(submitButton(token));
        closeLink.click(function () {
            edit.hide();
        });
        edit.show();
    },
    toRow = function (device, token) {
        var editLink = $("<a>Aendern</a>");
        var row = $("<tr>" +
            "<td>" + device['identifier'] + "</td>" +
            "<td>" + device['deviceName'] + "</td>" +
            "<td>" + device['weekdays'] + "</td>" +
            "<td>" + device['switchTime'] + "</td>" +
            "<td>" + device['duration'] + "s</td>" +
            "<td>" + device['delay'] + "s</td>" +
            "<td>" + device['enabled'] + "</td>" +
            "</tr>");
        editLink.click(function () {
            editDevice(device, token);
        });
        row.append(editLink);
        return row;
    },
    fillContent = function (devices, token) {
        console.log("fillContent");
        var table = $("<table/>"),
            tbody = $("<tbody/>"),
            newDevice = $("<a>Hinzufügen</a>");
        table.append("<thead>" +
            "<th>Ident</th>" +
            "<th>Name</th>" +
            "<th>Wochentage</th>" +
            "<th>Zeit</th>" +
            "<th>Dauer (s)</th>" +
            "<th>Verzögerung (s)</th>" +
            "<th>Aktiv?</th>" +
            "<th></th>" +
            "</thead>");
        table.append(tbody);
        console.log("fillContent - device count is #" + devices.length);
        devices.map(function(el) { return toRow(el, token) })
            .forEach(function (el) {
                tbody.append(el);
            });
        var div = $("#BEWAE");
        div.empty();
        var edit = $("<div class='edit'/>");
        edit.hide();
        div.append(edit);
        div.append(table);
        div.append(newDevice);

        newDevice.click(function () {
            editDevice({}, token);
        })
    };


function bewaesserung_load_complete(device) {
    bewaesserungDevice = device;
    load();
}
