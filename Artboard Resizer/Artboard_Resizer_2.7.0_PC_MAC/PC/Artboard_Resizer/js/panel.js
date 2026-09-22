(function () {
    "use strict";

    var widthInput = document.getElementById("widthInput");
    var heightInput = document.getElementById("heightInput");
    var ratioButton = document.getElementById("ratioButton");
    var resizeButton = document.getElementById("resizeButton");
    var refreshButton = document.getElementById("refreshButton");
    var documentInfo = document.getElementById("documentInfo");
    var status = document.getElementById("status");
    var rangeField = document.getElementById("rangeField");
    var rangeInput = document.getElementById("rangeInput");
    var ratioLocked = true;
    var ratio = 16 / 9;
    var changing = false;
    var documentReady = false;
    var documentArtboardCount = 0;

    function setStatus(message, type) {
        status.textContent = message;
        status.className = "status " + (type || "neutral");
    }

    function evalScript(code, callback) {
        if (!window.__adobe_cep__ || !window.__adobe_cep__.evalScript) {
            callback("ERROR|" + encodeURIComponent("CEP host connection is unavailable."));
            return;
        }
        window.__adobe_cep__.evalScript(code, callback);
    }

    function decode(value) {
        try { return decodeURIComponent(value || ""); }
        catch (error) { return value || ""; }
    }

    function parseResponse(raw) {
        var parts = String(raw || "").split("|");
        return { ok: parts[0] === "OK", parts: parts };
    }

    function positiveNumber(input) {
        var value = parseFloat(String(input.value).replace(",", "."));
        return isFinite(value) && value > 0 ? value : null;
    }

    function selectedScope() {
        return document.querySelector("input[name='scope']:checked").value;
    }

    function validateRange(value) {
        var text = String(value || "").replace(/^\s+|\s+$/g, "");
        if (!text) return { valid: false, message: "Enter an artboard range, for example: 1-5, 8, 12-15." };

        var tokens = text.split(",");
        var i, token, match, start, end;
        for (i = 0; i < tokens.length; i++) {
            token = tokens[i].replace(/^\s+|\s+$/g, "");
            match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
            if (!match) return { valid: false, message: "Use artboard numbers such as 1-5, 8, 12-15." };
            start = parseInt(match[1], 10);
            end = match[2] ? parseInt(match[2], 10) : start;
            if (start < 1 || end < start) return { valid: false, message: "Each range must use positive numbers in ascending order." };
            if (documentArtboardCount && end > documentArtboardCount) {
                return { valid: false, message: "This document has " + documentArtboardCount + " artboards. Adjust the range." };
            }
        }
        return { valid: true, value: text };
    }

    function updateRangeField() {
        var isRange = selectedScope() === "range";
        rangeField.hidden = !isRange;
    }

    function updateButton() {
        var rangeValid = selectedScope() !== "range" || validateRange(rangeInput.value).valid;
        resizeButton.disabled = !documentReady || positiveNumber(widthInput) === null || positiveNumber(heightInput) === null || !rangeValid;
    }

    function updateCopyRequirement() {
        var createCopy = document.getElementById("createCopy");
        var scope = selectedScope();
        var multipleArtboards = scope === "all" || scope === "range";
        var required = documentArtboardCount > 1 && multipleArtboards;
        if (required) createCopy.checked = true;
        createCopy.disabled = required;
        createCopy.parentElement.title = required
            ? "Multi-artboard documents are rebuilt into a new file to avoid Illustrator canvas errors."
            : "";
    }

    function refreshDocument(preserveStatus) {
        documentReady = false;
        updateButton();
        documentInfo.textContent = "Reading active document...";
        if (!preserveStatus) setStatus("Reading document information...", "working");

        evalScript("ArtboardResizer.getDocumentInfo()", function (raw) {
            var response = parseResponse(raw);
            if (!response.ok) {
                documentInfo.textContent = "No active Illustrator document";
                setStatus(decode(response.parts[1]) || "Open an Illustrator document.", "error");
                return;
            }

            var width = parseFloat(response.parts[1]);
            var height = parseFloat(response.parts[2]);
            var artboards = parseInt(response.parts[3], 10);
            var name = decode(response.parts[4]);
            var hostVersion = response.parts[6];
            var versionFooter = document.getElementById("versionFooter");
            if (versionFooter && hostVersion) versionFooter.textContent = "Version " + hostVersion;

            changing = true;
            widthInput.value = Math.round(width * 100) / 100;
            heightInput.value = Math.round(height * 100) / 100;
            changing = false;
            ratio = width / height;
            documentReady = true;
            documentArtboardCount = artboards;
            updateCopyRequirement();
            documentInfo.textContent = name + "  •  " + artboards + (artboards === 1 ? " artboard" : " artboards");
            if (!preserveStatus) {
                setStatus("Ready. Current active artboard: " + widthInput.value + " × " + heightInput.value + " px.", "neutral");
            }
            updateButton();
        });
    }

    widthInput.addEventListener("input", function () {
        if (!changing && ratioLocked) {
            var width = positiveNumber(widthInput);
            if (width !== null) {
                changing = true;
                heightInput.value = Math.round((width / ratio) * 100) / 100;
                changing = false;
            }
        }
        updateButton();
    });

    heightInput.addEventListener("input", function () {
        if (!changing && ratioLocked) {
            var height = positiveNumber(heightInput);
            if (height !== null) {
                changing = true;
                widthInput.value = Math.round((height * ratio) * 100) / 100;
                changing = false;
            }
        }
        updateButton();
    });

    ratioButton.addEventListener("click", function () {
        ratioLocked = !ratioLocked;
        ratioButton.classList.toggle("active", ratioLocked);
        ratioButton.title = ratioLocked ? "Keep proportions" : "Independent width and height";
        var width = positiveNumber(widthInput);
        var height = positiveNumber(heightInput);
        if (ratioLocked && width !== null && height !== null) ratio = width / height;
    });

    Array.prototype.forEach.call(document.querySelectorAll(".preset"), function (button) {
        button.addEventListener("click", function () {
            changing = true;
            widthInput.value = button.getAttribute("data-width");
            heightInput.value = button.getAttribute("data-height");
            changing = false;
            ratio = positiveNumber(widthInput) / positiveNumber(heightInput);
            updateButton();
        });
    });

    Array.prototype.forEach.call(document.querySelectorAll("input[name='scope']"), function (input) {
        input.addEventListener("change", function () {
            updateRangeField();
            updateCopyRequirement();
            updateButton();
        });
    });

    rangeInput.addEventListener("input", updateButton);

    resizeButton.addEventListener("click", function () {
        var width = positiveNumber(widthInput);
        var height = positiveNumber(heightInput);
        if (width === null || height === null) {
            setStatus("Enter valid width and height values.", "error");
            return;
        }

        var scope = selectedScope();
        var range = "";
        if (scope === "range") {
            var rangeResult = validateRange(rangeInput.value);
            if (!rangeResult.valid) {
                setStatus(rangeResult.message, "error");
                return;
            }
            range = rangeResult.value;
        }
        var scaleArtwork = document.getElementById("scaleArtwork").checked;
        var scaleAppearance = document.getElementById("scaleAppearance").checked;
        var createCopy = document.getElementById("createCopy").checked;
        var code = "ArtboardResizer.resize(" + [
            width,
            height,
            JSON.stringify(scope),
            JSON.stringify(range),
            scaleArtwork,
            scaleAppearance,
            createCopy
        ].join(",") + ")";

        resizeButton.disabled = true;
        refreshButton.disabled = true;
        setStatus("Resizing artboards and artwork. Please wait...", "working");

        evalScript(code, function (raw) {
            refreshButton.disabled = false;
            var response = parseResponse(raw);
            if (!response.ok) {
                setStatus(decode(response.parts[1]) || "Illustrator returned an unknown error.", "error");
                updateButton();
                return;
            }

            var boardCount = parseInt(response.parts[1], 10);
            var itemCount = parseInt(response.parts[2], 10);
            var skippedCount = parseInt(response.parts[3], 10);
            var outputPaths = decode(response.parts[4]).split(";;").filter(function (p) { return p; });
            var message = "Done: " + boardCount + (boardCount === 1 ? " artboard" : " artboards") +
                " and " + itemCount + (itemCount === 1 ? " artwork item" : " artwork items") + " resized.";
            if (skippedCount > 0) message += " " + skippedCount + " unassigned item(s) were left unchanged.";
            if (outputPaths.length === 1) {
                message += " Saved as: " + outputPaths[0];
            } else if (outputPaths.length > 1) {
                message += " Split across " + outputPaths.length + " files (too many artboards for one canvas): " + outputPaths.join(", ");
            }
            setStatus(message, "success");
            documentReady = true;
            updateButton();
            refreshDocument(true);
        });
    });

    refreshButton.addEventListener("click", function () { refreshDocument(false); });
    updateRangeField();
    refreshDocument(false);
}());
