let bewaesserungDevice = undefined,
    bewaesserungRoom = undefined;

const getCsrfToken = function () {
        const req = new XMLHttpRequest();
        req.open('GET', document.location, false);
        req.send(null);
        const headers = req.getAllResponseHeaders().toLowerCase();
        return (/x-fhem-csrftoken: ([a-z]+_[0-9a-z]+)/g).exec(headers)[1]
    },

    load = function () {
        const token = getCsrfToken();
        console.log("BEWAE - load() - token=" + token);
        loadJsonList(bewaesserungDevice, token, result => {
            const keyValuePairs = toDevices(result);
            console.log("BEWAE - devices is" + JSON.stringify(keyValuePairs));
            fillContent(keyValuePairs, token);
        });
    },
    loadJsonList = function (device, token, callback) {
        console.log("BEWAE - loadJsonList()");
        $.getJSON('?cmd=jsonlist2%20' + device + '&XHR=1&&fwcsrf=' + token, function (data) {
            callback(data['Results'][0]['Readings']);
        });
    },
    getDevicesInRoom = function (device, token, callback) {
        console.log("BEWAE - loadDevicesInRoom()");
        $.getJSON('?cmd=jsonlist2%20room=' + bewaesserungRoom + '&XHR=1&&fwcsrf=' + token, function (data) {
            callback(data['Results']
                .filter(device => {
                    const sets = device['PossibleSets'];
                    return sets.includes("on") && sets.includes("off");
                })
                .map((device) => {
                    return {
                        name: device['Name'],
                        alias: device['Attributes']['alias'] || device['Name']
                    };
                })
                .filter(name => name.name !== bewaesserungDevice));
        });
    },
    toDevices = function (def) {
        if (!def) {
            return [];
        }
        const keys = Object.keys(def);
        return keys
            .filter(key => key !== 'null' && key.startsWith("."))
            .map(key => {
                try {
                    const json = def[key]["Value"];
                    const device = JSON.parse(json);
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
        let value = device[key] ? device[key] : "";
        const disabledAttribute = disabled ? 'disabled' : '';
        value = value || defaultValue;

        return $("<div><label for='" + key + "'>" + desc + "</label>" +
            "<input name='" + key + "' value='" + value + "' " + disabledAttribute + "/></div>");
    },

    dropDownWith = function (device, key, desc, values) {
        let value = device[key] ? device[key] : "";

        const options = values.map(v => {
            const isSelected = v.name === value;
            return `<option ${isSelected ? "selected" : ""} value="${v.name}">${v.alias}</option>`
        }).reduce((a, b) => a + b, "");

        return $("<div><label for='" + key + "'>" + desc + "</label>" +
            ` <select name='${key}'>${options}</select></div>`)
    },

    submitButton = function (token) {
        const submit = $("<button>Submit</button>");
        submit.click(() => {
            const form = $('#BEWAE').find('form'),
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

            if (!identifier.match(/^[a-z0-9_]+$/i)) {
                alert("Identifier may only include plain letters and numbers.");
                return false;
            }
            console.log(cmd);
            $.ajax({
                url: '?fwcsrf=' + token + '&cmd=' + cmd
            }).done(() => {
                load();
            });
            return false;
        });
        return submit;
    },

    editDevice = function (device, token) {
        getDevicesInRoom(device, token, (devices => {
            const edit = $("#BEWAE").find('.edit'),
                form = $("<form></form>"),
                closeLink = $("<a class='close'>[close]</a>");

            edit.empty();
            edit.append(closeLink);
            edit.append("<h4>" + (device['name'] ? device['name'] : 'Hinzufügen') + "</h4>");
            edit.append(form);

            form.append(inputElement(device, 'identifier', 'Ident', false));
            form.append(dropDownWith(device, 'deviceName', 'Gerät', devices));
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
        }));
    },
    toRow = function (device, token) {
        const editLink = $("<a>Aendern</a>");
        const row = $("<tr>" +
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
        const table = $("<table/>"),
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
        devices
            .map(el => toRow(el, token))
            .forEach(el => {
                tbody.append(el);
            });
        const div = $("#BEWAE");
        div.empty();
        const edit = $("<div class='edit'/>");
        edit.hide();
        div.append(edit);
        div.append(table);
        div.append(newDevice);

        newDevice.click(function () {
            editDevice({}, token);
        })
    };

// called by FHEM 98_BEWAE.pm
// noinspection JSUnusedGlobalSymbols
function bewaesserung_load_complete(device, room) {
    bewaesserungDevice = device;
    bewaesserungRoom = room;
    load();
}
