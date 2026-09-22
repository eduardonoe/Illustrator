#target illustrator

var ArtboardResizer = ArtboardResizer || {};

(function (api) {
    // Illustrator's regular canvas supports roughly 16,348 internal points.
    // Keep a small buffer while still allowing a 4 x 6 grid of 4K artboards.
    var SAFE_CANVAS_EXTENT = 16000;
    var VERSION = "2.7.0";

    function encode(value) {
        return encodeURIComponent(String(value === undefined || value === null ? "" : value));
    }

    function ok(parts) {
        return "OK|" + parts.join("|");
    }

    function errorResult(error) {
        var message = error && error.message ? error.message : String(error);
        if (error && error.line) message += " (line " + error.line + ")";
        return "ERROR|" + encode(message);
    }

    function round(value) {
        return Math.round(value * 100) / 100;
    }

    function getScaleLineWeightPref() {
        try {
            return app.preferences.getBooleanPreference("scaleLineWeight");
        } catch (error) {
            return null;
        }
    }

    function setScaleLineWeightPref(value) {
        try {
            app.preferences.setBooleanPreference("scaleLineWeight", value);
        } catch (error) {}
    }

    function getScaleFactor(doc) {
        try {
            var factor = Number(doc.scaleFactor);
            return isFinite(factor) && factor > 0 ? factor : 1;
        } catch (error) {
            return 1;
        }
    }

    function getActiveRect(doc) {
        return doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect;
    }

    function rectWidth(rect) {
        return rect[2] - rect[0];
    }

    function rectHeight(rect) {
        return rect[1] - rect[3];
    }

    function copyRect(rect) {
        return [rect[0], rect[1], rect[2], rect[3]];
    }

    function getBounds(item) {
        // visibleBounds reflects the item's actual on-canvas appearance,
        // including live effects (Warp/Arc, etc.) and strokes. geometricBounds
        // only reflects the raw underlying path, which for a warped item
        // (e.g. arced text like "GRANDES") is a completely different box
        // than what is drawn - using it here made the scale/position math
        // wrong specifically for items with live effects.
        try {
            return item.visibleBounds;
        } catch (error) {
            return item.geometricBounds;
        }
    }

    function collectLayers(collection, output) {
        var i;
        for (i = 0; i < collection.length; i++) {
            output.push(collection[i]);
            if (collection[i].layers && collection[i].layers.length) {
                collectLayers(collection[i].layers, output);
            }
        }
    }

    function collectTopLevelItems(doc) {
        var output = [];
        var i, item;
        for (i = 0; i < doc.pageItems.length; i++) {
            item = doc.pageItems[i];
            try {
                if (item.parent && item.parent.typename === "Layer") output.push(item);
            } catch (error) {}
        }
        return output;
    }

    function unlockDocument(doc, items) {
        var layers = [];
        var state = { layers: [], items: [] };
        var i, layer, item;
        collectLayers(doc.layers, layers);

        for (i = 0; i < layers.length; i++) {
            layer = layers[i];
            state.layers.push({ ref: layer, locked: layer.locked, visible: layer.visible });
            try { layer.locked = false; } catch (lockError) {}
            try { layer.visible = true; } catch (visibleError) {}
        }

        for (i = 0; i < items.length; i++) {
            item = items[i];
            var itemState = { ref: item, locked: false, hidden: false, hasLocked: false, hasHidden: false };
            try {
                itemState.locked = item.locked;
                itemState.hasLocked = true;
                item.locked = false;
            } catch (itemLockError) {}
            try {
                itemState.hidden = item.hidden;
                itemState.hasHidden = true;
                item.hidden = false;
            } catch (itemHiddenError) {}
            state.items.push(itemState);
        }
        return state;
    }

    function restoreDocument(state) {
        var i, entry;
        if (!state) return;
        for (i = state.items.length - 1; i >= 0; i--) {
            entry = state.items[i];
            try { if (entry.hasLocked) entry.ref.locked = entry.locked; } catch (itemLockError) {}
            try { if (entry.hasHidden) entry.ref.hidden = entry.hidden; } catch (itemHiddenError) {}
        }
        for (i = state.layers.length - 1; i >= 0; i--) {
            entry = state.layers[i];
            try { entry.ref.locked = entry.locked; } catch (layerLockError) {}
            try { entry.ref.visible = entry.visible; } catch (layerVisibleError) {}
        }
    }

    function buildBoardData(doc, indices, requestedWidth, requestedHeight) {
        var scaleFactor = getScaleFactor(doc);
        var targetWidth = requestedWidth / scaleFactor;
        var targetHeight = requestedHeight / scaleFactor;
        var boards = [];
        var i, index, rect;
        var minLeft = null;
        var maxTop = null;
        var maxRight = null;
        var minBottom = null;

        if (targetWidth <= 0 || targetHeight <= 0) throw new Error("Width and height must be greater than zero.");
        if (targetWidth > SAFE_CANVAS_EXTENT || targetHeight > SAFE_CANVAS_EXTENT) {
            throw new Error("The requested artboard size exceeds Illustrator's safe canvas limit.");
        }

        if (!indices || !indices.length) throw new Error("Select at least one artboard.");

        for (i = 0; i < indices.length; i++) {
            index = indices[i];
            rect = copyRect(doc.artboards[index].artboardRect);
            if (minLeft === null || rect[0] < minLeft) minLeft = rect[0];
            if (maxTop === null || rect[1] > maxTop) maxTop = rect[1];
            if (maxRight === null || rect[2] > maxRight) maxRight = rect[2];
            if (minBottom === null || rect[3] < minBottom) minBottom = rect[3];
            boards.push({
                index: index,
                oldRect: rect,
                newRect: null,
                scaleX: targetWidth / rectWidth(rect),
                scaleY: targetHeight / rectHeight(rect)
            });
        }

        if (boards.length === 1) {
            boards[0].newRect = [
                -targetWidth / 2,
                targetHeight / 2,
                targetWidth / 2,
                -targetHeight / 2
            ];
            return { boards: boards, scaleFactor: scaleFactor };
        }

        var referenceWidth = rectWidth(boards[0].oldRect);
        var referenceHeight = rectHeight(boards[0].oldRect);
        var layoutScaleX = targetWidth / referenceWidth;
        var layoutScaleY = targetHeight / referenceHeight;
        var layoutWidth = (maxRight - minLeft) * layoutScaleX;
        var layoutHeight = (maxTop - minBottom) * layoutScaleY;

        if (layoutWidth <= SAFE_CANVAS_EXTENT && layoutHeight <= SAFE_CANVAS_EXTENT) {
            // Illustrator's artboard canvas is anchored at [0, 0] on many
            // regular documents. Keep the complete layout in that native
            // positive-X / negative-Y quadrant instead of using negatives.
            var layoutLeft = 0;
            var layoutTop = 0;
            for (i = 0; i < boards.length; i++) {
                rect = boards[i].oldRect;
                var left = layoutLeft + (rect[0] - minLeft) * layoutScaleX;
                var top = layoutTop - (maxTop - rect[1]) * layoutScaleY;
                boards[i].newRect = [left, top, left + targetWidth, top - targetHeight];
            }
        } else {
            arrangeGrid(boards, targetWidth, targetHeight);
        }
        return { boards: boards, scaleFactor: scaleFactor };
    }

    function arrangeGrid(boards, targetWidth, targetHeight) {
        var gap = Math.max(50, Math.min(150, Math.round(Math.min(targetWidth, targetHeight) * 0.04)));
        var bestColumns = 0;
        var bestRows = 0;
        var bestScore = null;
        var columns, rows, totalWidth, totalHeight, score, i;

        for (columns = 1; columns <= boards.length; columns++) {
            rows = Math.ceil(boards.length / columns);
            totalWidth = columns * targetWidth + (columns - 1) * gap;
            totalHeight = rows * targetHeight + (rows - 1) * gap;
            if (totalWidth <= SAFE_CANVAS_EXTENT && totalHeight <= SAFE_CANVAS_EXTENT) {
                score = Math.abs(totalWidth - totalHeight);
                if (bestScore === null || score < bestScore) {
                    bestScore = score;
                    bestColumns = columns;
                    bestRows = rows;
                }
            }
        }

        if (!bestColumns) {
            throw new Error("The artboards cannot fit safely on Illustrator's canvas at this size. Resize fewer artboards at a time.");
        }

        var ordered = boards.slice(0);
        ordered.sort(function (a, b) {
            var topDifference = b.oldRect[1] - a.oldRect[1];
            var tolerance = Math.min(rectHeight(a.oldRect), rectHeight(b.oldRect)) * 0.35;
            if (Math.abs(topDifference) > tolerance) return topDifference;
            return a.oldRect[0] - b.oldRect[0];
        });

        totalWidth = bestColumns * targetWidth + (bestColumns - 1) * gap;
        totalHeight = bestRows * targetHeight + (bestRows - 1) * gap;
        // Use Illustrator's native artboard quadrant: X grows rightward and
        // Y grows downward from 0. This avoids AOoC on documents whose
        // regular canvas does not accept negative X coordinates.
        var startLeft = 0;
        var startTop = 0;

        for (i = 0; i < ordered.length; i++) {
            var row = Math.floor(i / bestColumns);
            var column = i % bestColumns;
            var left = startLeft + column * (targetWidth + gap);
            var top = startTop - row * (targetHeight + gap);
            ordered[i].newRect = [left, top, left + targetWidth, top - targetHeight];
        }
    }

    function rectOverlapArea(a, b) {
        var left = Math.max(a[0], b[0]);
        var right = Math.min(a[2], b[2]);
        var top = Math.min(a[1], b[1]);
        var bottom = Math.max(a[3], b[3]);
        if (right <= left || top <= bottom) return 0;
        return (right - left) * (top - bottom);
    }

    function findBoardForItem(item, boards) {
        // Pick the board with the largest overlap against the item's
        // bounds, not just whichever rect contains the bounding-box center.
        // A live effect (Warp/Arc, etc.) can push an item's visible bounds
        // well off-center relative to its actual artwork, especially when
        // source artboards sit edge to edge - a pure center-point test can
        // then match the wrong neighboring artboard entirely.
        //
        // There is deliberately no "nearest board" fallback when nothing
        // overlaps: `boards` can be a SUBSET of the document's artboards
        // (a single active artboard among several, or one batch out of
        // several when a large layout is split across output files). An
        // item with no overlap here genuinely belongs to a different
        // artboard/batch and must be skipped, not force-fitted onto the
        // nearest board in this subset - that previously stole every other
        // artboard's content into whichever batch ran last.
        var bounds = getBounds(item);
        var i, best, bestArea, area;

        best = null;
        bestArea = 0;
        for (i = 0; i < boards.length; i++) {
            area = rectOverlapArea(bounds, boards[i].oldRect);
            if (area > bestArea) {
                bestArea = area;
                best = boards[i];
            }
        }
        return best;
    }

    function transformItem(item, board, scaleAppearance) {
        var before = getBounds(item);
        transformItemFromSourceBounds(item, before, board, scaleAppearance);
    }

    function transformItemFromSourceBounds(item, sourceBounds, board, scaleAppearance) {
        // Scale about the item's own top-left, then translate it into
        // position. The matrix's translation components are self-cancelling
        // here, which matters because item.transform() re-anchors the
        // matrix to scaleAbout (TOPLEFT). A matrix expressed in absolute
        // document coordinates was tried instead and collapsed the whole
        // layout, because that re-anchoring destroys an absolute
        // translation.
        var desiredLeft = board.newRect[0] + (sourceBounds[0] - board.oldRect[0]) * board.scaleX;
        var desiredTop = board.newRect[1] + (sourceBounds[1] - board.oldRect[1]) * board.scaleY;
        var lineScale = scaleAppearance ? Math.sqrt(board.scaleX * board.scaleY) * 100 : 100;
        var anchorX = sourceBounds[0];
        var anchorY = sourceBounds[1];

        var matrix = app.getIdentityMatrix();
        matrix = app.concatenateTranslationMatrix(matrix, -anchorX, -anchorY);
        // concatenateScaleMatrix takes a percentage (100 = unchanged), the
        // same convention as resize() - board.scaleX/Y are plain ratios
        // (10 = 10x), so they must be scaled up by 100 here too.
        matrix = app.concatenateScaleMatrix(matrix, board.scaleX * 100, board.scaleY * 100);
        matrix = app.concatenateTranslationMatrix(matrix, anchorX, anchorY);

        item.transform(
            matrix,
            true,
            scaleAppearance,
            scaleAppearance,
            scaleAppearance,
            lineScale,
            Transformation.TOPLEFT
        );

        var after = getBounds(item);
        item.translate(
            desiredLeft - after[0],
            desiredTop - after[1],
            true,
            scaleAppearance,
            scaleAppearance,
            scaleAppearance
        );
    }

    function applyArtboards(doc, boardData, requestedWidth, requestedHeight) {
        var i, board, rect, actualWidth, actualHeight;
        for (i = 0; i < boardData.boards.length; i++) {
            board = boardData.boards[i];
            doc.artboards[board.index].artboardRect = board.newRect;
        }

        for (i = 0; i < boardData.boards.length; i++) {
            board = boardData.boards[i];
            rect = doc.artboards[board.index].artboardRect;
            actualWidth = rectWidth(rect) * boardData.scaleFactor;
            actualHeight = rectHeight(rect) * boardData.scaleFactor;
            if (Math.abs(actualWidth - requestedWidth) > 0.05 || Math.abs(actualHeight - requestedHeight) > 0.05) {
                throw new Error("Illustrator did not apply the requested dimensions to artboard " + (board.index + 1) + ".");
            }
        }
    }

    function uniqueOutputFile(sourceFile) {
        var name = sourceFile.name.replace(/\.[^\.]+$/, "");
        var folder = sourceFile.parent;
        var candidate = new File(folder.fsName + "/" + name + "_resized.ai");
        var suffix = 2;
        while (candidate.exists) {
            candidate = new File(folder.fsName + "/" + name + "_resized_" + suffix + ".ai");
            suffix++;
        }
        return candidate;
    }

    function writeDebugLog(outputFile, debugLines) {
        if (!debugLines || !debugLines.length) return;
        try {
            var name = outputFile.name.replace(/\.[^\.]+$/, "");
            var logFile = new File(outputFile.parent.fsName + "/" + name + "_debug.txt");
            logFile.encoding = "UTF-8";
            logFile.open("w");
            logFile.write(debugLines.join("\n"));
            logFile.close();
        } catch (error) {}
    }

    function createWorkingCopy(doc) {
        var sourceFile;
        try {
            sourceFile = doc.fullName;
        } catch (error) {
            throw new Error("Save the Illustrator document once before using Create a new file.");
        }
        var outputFile = uniqueOutputFile(sourceFile);
        var options = new IllustratorSaveOptions();
        options.pdfCompatible = true;
        // compressed:true adds a slow zip pass on top of pdfCompatible's
        // own PDF snapshot - for files this heavy (large embedded media
        // across many artboards) that combination made saveAs take long
        // enough to look like a hang. pdfCompatible alone is what Overlord
        // needs; leaving compression off trades disk space for speed.
        options.compressed = false;
        doc.saveAs(outputFile, options);
        return outputFile;
    }

    function parseRangeIndices(rangeText, artboardCount) {
        var text = String(rangeText === undefined || rangeText === null ? "" : rangeText).replace(/^\s+|\s+$/g, "");
        var tokens, seen, indices, i, token, match, start, end, index;
        if (!text) throw new Error("Enter an artboard range, for example: 1-5, 8, 12-15.");

        tokens = text.split(",");
        seen = {};
        indices = [];
        for (i = 0; i < tokens.length; i++) {
            token = tokens[i].replace(/^\s+|\s+$/g, "");
            match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
            if (!match) throw new Error("Use artboard numbers such as 1-5, 8, 12-15.");
            start = Number(match[1]);
            end = match[2] ? Number(match[2]) : start;
            if (!isFinite(start) || !isFinite(end) || start < 1 || end < start) {
                throw new Error("Each artboard range must use positive numbers in ascending order.");
            }
            if (end > artboardCount) throw new Error("This document has " + artboardCount + " artboards. Adjust the range.");
            for (index = start; index <= end; index++) {
                if (!seen[index]) {
                    seen[index] = true;
                    indices.push(index - 1);
                }
            }
        }
        indices.sort(function (a, b) { return a - b; });
        return indices;
    }

    function getScopeIndices(doc, scope, rangeText) {
        var indices = [];
        var i;
        if (scope === "active") return [doc.artboards.getActiveArtboardIndex()];
        if (scope === "range") return parseRangeIndices(rangeText, doc.artboards.length);
        if (scope !== "all") throw new Error("Choose All artboards, Active artboard only, or Range.");
        for (i = 0; i < doc.artboards.length; i++) indices.push(i);
        return indices;
    }

    function collectBoardRecords(doc, indices) {
        var records = [];
        var i, index, rect;
        for (i = 0; i < indices.length; i++) {
            index = indices[i];
            rect = copyRect(doc.artboards[index].artboardRect);
            records.push({ index: index, oldRect: rect, newRect: null, targetIndex: -1, name: doc.artboards[index].name });
        }
        return records;
    }

    function chooseTargetGrid(count, width, height) {
        var gap = Math.max(50, Math.min(150, Math.round(Math.min(width, height) * 0.04)));
        var best = null;
        var columns, rows, totalWidth, totalHeight, score;
        for (columns = 1; columns <= count; columns++) {
            rows = Math.ceil(count / columns);
            totalWidth = columns * width + (columns - 1) * gap;
            totalHeight = rows * height + (rows - 1) * gap;
            if (totalWidth <= SAFE_CANVAS_EXTENT && totalHeight <= SAFE_CANVAS_EXTENT) {
                score = Math.abs(totalWidth - totalHeight);
                if (best === null || score < best.score) best = { columns: columns, rows: rows, gap: gap, score: score };
            }
        }
        if (best === null) {
            // Every candidate grid for this many boards needs a Large
            // Canvas document, which createTargetDocument refuses (Overlord
            // requires a regular canvas). The caller is expected to batch
            // boards into groups of maxBoardsPerBatch() before reaching
            // here, so in practice this should not happen.
            throw new Error("Too many artboards for a single regular-canvas document at this size.");
        }
        return best;
    }

    function maxBoardsPerBatch(width, height) {
        var gap = Math.max(50, Math.min(150, Math.round(Math.min(width, height) * 0.04)));
        var columns = 1;
        var rows = 1;
        while (((columns + 1) * width + columns * gap) <= SAFE_CANVAS_EXTENT) columns++;
        while (((rows + 1) * height + rows * gap) <= SAFE_CANVAS_EXTENT) rows++;
        return Math.max(1, columns * rows);
    }

    function chunkIndices(indices, size) {
        var chunks = [];
        var i;
        for (i = 0; i < indices.length; i += size) {
            chunks.push(indices.slice(i, i + size));
        }
        return chunks;
    }

    function createTargetDocument(sourceDoc, boardCount, requestedWidth, requestedHeight, grid) {
        var colorSpace = sourceDoc.documentColorSpace;
        var targetDoc = app.documents.add(
            colorSpace,
            requestedWidth,
            requestedHeight,
            boardCount,
            DocumentArtboardLayout.GridByRow,
            grid.gap,
            // GridByRow expects the number of columns. Passing the number of
            // rows produced six 4K columns, which silently created a Large
            // Canvas document and made Overlord import at the wrong scale.
            grid.columns
        );
        if (targetDoc.artboards.length !== boardCount) {
            throw new Error("Illustrator could not create the target artboard grid.");
        }
        if (getScaleFactor(targetDoc) !== 1 && requestedWidth <= 4096 && requestedHeight <= 4096) {
            throw new Error("Illustrator created a Large Canvas document. This layout must remain on a regular canvas for correct Overlord transfer.");
        }
        return targetDoc;
    }

    function assignTargetArtboards(sourceBoards, targetDoc, requestedWidth, requestedHeight) {
        var ordered = sourceBoards.slice(0);
        var i, targetRect, targetFactor, actualWidth, actualHeight;
        ordered.sort(function (a, b) {
            var topDifference = b.oldRect[1] - a.oldRect[1];
            var tolerance = Math.min(rectHeight(a.oldRect), rectHeight(b.oldRect)) * 0.35;
            if (Math.abs(topDifference) > tolerance) return topDifference;
            return a.oldRect[0] - b.oldRect[0];
        });

        targetFactor = getScaleFactor(targetDoc);
        for (i = 0; i < ordered.length; i++) {
            targetRect = copyRect(targetDoc.artboards[i].artboardRect);
            actualWidth = rectWidth(targetRect) * targetFactor;
            actualHeight = rectHeight(targetRect) * targetFactor;
            if (Math.abs(actualWidth - requestedWidth) > 0.05 || Math.abs(actualHeight - requestedHeight) > 0.05) {
                throw new Error("Illustrator created artboard " + (i + 1) + " at an unexpected size.");
            }
            ordered[i].newRect = targetRect;
            ordered[i].targetIndex = i;
            ordered[i].scaleX = rectWidth(targetRect) / rectWidth(ordered[i].oldRect);
            ordered[i].scaleY = rectHeight(targetRect) / rectHeight(ordered[i].oldRect);
            try { targetDoc.artboards[i].name = ordered[i].name; } catch (nameError) {}
        }
    }

    function addLayerTree(sourceCollection, targetParent, layerMap) {
        var i, sourceLayer, targetLayer;
        for (i = sourceCollection.length - 1; i >= 0; i--) {
            sourceLayer = sourceCollection[i];
            targetLayer = targetParent.layers.add();
            try { targetLayer.name = sourceLayer.name; } catch (nameError) {}
            layerMap.push({ source: sourceLayer, target: targetLayer, locked: sourceLayer.locked, visible: sourceLayer.visible });
            if (sourceLayer.layers && sourceLayer.layers.length) addLayerTree(sourceLayer.layers, targetLayer, layerMap);
        }
    }

    function createLayerMap(sourceDoc, targetDoc) {
        var map = [];
        var defaultLayer = targetDoc.layers[0];
        addLayerTree(sourceDoc.layers, targetDoc, map);
        if (targetDoc.layers.length > 1) {
            try { defaultLayer.remove(); } catch (removeError) {}
        }
        return map;
    }

    function getMappedLayer(layerMap, sourceLayer) {
        var i;
        for (i = 0; i < layerMap.length; i++) {
            if (layerMap[i].source === sourceLayer) return layerMap[i].target;
        }
        return null;
    }

    function restoreTargetLayerStates(layerMap) {
        var i;
        for (i = layerMap.length - 1; i >= 0; i--) {
            try { layerMap[i].target.locked = layerMap[i].locked; } catch (lockError) {}
            try { layerMap[i].target.visible = layerMap[i].visible; } catch (visibleError) {}
        }
    }

    function positionUnscaledItem(item, sourceBounds, board) {
        var bounds = getBounds(item);
        var left = board.newRect[0] + (sourceBounds[0] - board.oldRect[0]);
        var top = board.newRect[1] + (sourceBounds[1] - board.oldRect[1]);
        item.translate(left - bounds[0], top - bounds[1], true, false, false, false);
    }

    function describeItemForLog(item) {
        var name = "(unnamed)";
        var typename = "?";
        var extra = "";
        try { name = item.name || name; } catch (nameError) {}
        try { typename = item.typename; } catch (typeError) {}
        try {
            if (typename === "TextFrame") {
                extra = " text=\"" + String(item.contents).substring(0, 40) + "\"";
            } else if (typename === "GroupItem") {
                var childTypes = [];
                var n = Math.min(item.pageItems.length, 6);
                for (var c = 0; c < n; c++) {
                    var childType = item.pageItems[c].typename;
                    if (childType === "TextFrame") {
                        try { childType += "(\"" + String(item.pageItems[c].contents).substring(0, 20) + "\")"; } catch (ce) {}
                    }
                    childTypes.push(childType);
                }
                extra = " children=" + item.pageItems.length + " [" + childTypes.join(",") + "]";
            }
        } catch (extraError) {}
        return typename + " \"" + name + "\"" + extra;
    }

    function collectPluginItems(container, output) {
        function walk(coll) {
            for (var j = 0; j < coll.length; j++) {
                var it = coll[j];
                var tn = null;
                try { tn = it.typename; } catch (typeError) { continue; }
                if (tn === "PluginItem") output.push(it);
                else if (tn === "GroupItem") walk(it.pageItems);
            }
        }
        try { walk(container.pageItems); } catch (collectError) {}
    }

    function expandEnvelopes(root, targetDoc, debugLines, label) {
        // A PluginItem is how Illustrator represents an Envelope Distort
        // object. Two kinds exist and they behave very differently:
        //
        //   - a Warp EFFECT scales fine and survives saveAs
        //   - a real Envelope Distort (mesh) scales in memory but
        //     saveAs re-serializes it from its ORIGINAL, unscaled mesh,
        //     so it snaps back to its source size in the saved file
        //
        // That second case is why some ribbons came out correct and
        // others appeared to "vanish": they were not gone, they were
        // sitting at 1/10th size. Neither transform(), resize(), nor
        // Expand Appearance ("expandStyle") persists through the save.
        // Object > Expand ("Expand3") does: it bakes the envelope into
        // plain paths that keep the warped look and scale normally.
        //
        // Every envelope in this item is selected and expanded in ONE
        // command. Driving the menu command once per envelope in a loop
        // was enough repeated selection churn to knock Illustrator's
        // scripting bridge over on a large document.
        //
        // Runs only on the disposable clone in the rebuilt target
        // document, never on the user's source file.
        var rootType = null;
        try { rootType = root.typename; } catch (staleError) { return root; }

        var victims = [];
        if (rootType === "PluginItem") victims.push(root);
        else collectPluginItems(root, victims);
        if (!victims.length) return root;

        try {
            app.activeDocument = targetDoc;
            targetDoc.selection = null;
            targetDoc.selection = victims;
            app.executeMenuCommand("Expand3");
        } catch (expandError) {
            if (debugLines) debugLines.push(label + " -> envelope expand failed: " + (expandError && expandError.message ? expandError.message : String(expandError)));
            return root;
        }

        if (rootType === "PluginItem") {
            // Expanding replaces the PluginItem with a new group, so the
            // old reference is stale - re-acquire it from the selection
            // the command leaves behind.
            var sel = null;
            try { sel = targetDoc.selection; } catch (selError) { sel = null; }
            if (sel && sel.length) root = sel[0];
        }

        if (debugLines) debugLines.push(label + " -> expanded " + victims.length + " envelope(s)");
        try { targetDoc.selection = null; } catch (clearError) {}
        return root;
    }

    function rebuildDocument(sourceDoc, requestedWidth, requestedHeight, selectedIndices, scaleArtwork, scaleAppearance, debugLines) {
        var sourceBoards = collectBoardRecords(sourceDoc, selectedIndices);
        var grid = chooseTargetGrid(sourceBoards.length, requestedWidth, requestedHeight);
        var targetDoc = null;
        var sourceItems = collectTopLevelItems(sourceDoc);
        var sourceState = null;
        var layerMap = null;
        var copied = 0;
        var skipped = 0;
        var i, sourceItem, sourceBounds, board, targetLayer, clone, cloneLocked, cloneHidden, afterBounds, label;

        try {
            targetDoc = createTargetDocument(sourceDoc, sourceBoards.length, requestedWidth, requestedHeight, grid);
            assignTargetArtboards(sourceBoards, targetDoc, requestedWidth, requestedHeight);
            layerMap = createLayerMap(sourceDoc, targetDoc);
            sourceState = unlockDocument(sourceDoc, sourceItems);

            for (i = 0; i < sourceItems.length; i++) {
                sourceItem = sourceItems[i];
                label = describeItemForLog(sourceItem);
                try {
                    // Finding the board and reading bounds can throw for a
                    // handful of problematic item types (e.g. broken links,
                    // certain meshes). One bad item must not abort the whole
                    // rebuild, so the lookup lives inside this try too.
                    board = findBoardForItem(sourceItem, sourceBoards);
                    if (!board) {
                        skipped++;
                        if (debugLines) debugLines.push(label + " -> SKIPPED (no board matched)");
                        continue;
                    }
                    targetLayer = getMappedLayer(layerMap, sourceItem.layer);
                    if (!targetLayer) {
                        skipped++;
                        if (debugLines) debugLines.push(label + " -> SKIPPED (no target layer)");
                        continue;
                    }
                    // Illustrator can reposition an item as it is duplicated
                    // into another document. Capture its original bounds first
                    // so the final transform is always based on the source.
                    sourceBounds = getBounds(sourceItem);
                    clone = sourceItem.duplicate(targetLayer, ElementPlacement.PLACEATEND);
                    cloneLocked = false;
                    cloneHidden = false;
                    try { cloneLocked = clone.locked; clone.locked = false; } catch (cloneLockError) {}
                    try { cloneHidden = clone.hidden; clone.hidden = false; } catch (cloneHiddenError) {}
                    if (scaleArtwork) {
                        clone = expandEnvelopes(clone, targetDoc, debugLines, label);
                        transformItemFromSourceBounds(clone, sourceBounds, board, scaleAppearance);
                    } else {
                        positionUnscaledItem(clone, sourceBounds, board);
                    }
                    try { clone.locked = cloneLocked; } catch (restoreCloneLockError) {}
                    try { clone.hidden = cloneHidden; } catch (restoreCloneHiddenError) {}
                    copied++;
                    if (debugLines) {
                        try { afterBounds = getBounds(clone); } catch (afterError) { afterBounds = null; }
                        debugLines.push(label + " -> board " + (board.index + 1) + " \"" + board.name + "\"" +
                            " | sourceBounds=" + sourceBounds.join(",") +
                            " | boardOldRect=" + board.oldRect.join(",") +
                            " | boardNewRect=" + board.newRect.join(",") +
                            " | scaleX=" + round(board.scaleX) + " scaleY=" + round(board.scaleY) +
                            " | afterBounds=" + (afterBounds ? afterBounds.join(",") : "?") +
                            " | hidden=" + cloneHidden + " opacity=" + (function () { try { return clone.opacity; } catch (e) { return "?"; } }()));
                    }
                } catch (duplicateError) {
                    skipped++;
                    if (debugLines) debugLines.push(label + " -> ERROR: " + (duplicateError && duplicateError.message ? duplicateError.message : String(duplicateError)));
                }
            }

            restoreDocument(sourceState);
            sourceState = null;
            restoreTargetLayerStates(layerMap);
            app.redraw();
            return { targetDoc: targetDoc, boardCount: sourceBoards.length, copied: copied, skipped: skipped };
        } catch (error) {
            try { restoreDocument(sourceState); } catch (restoreError) {}
            try {
                if (targetDoc) targetDoc.close(SaveOptions.DONOTSAVECHANGES);
            } catch (closeError) {}
            throw error;
        }
    }

    function saveRebuiltDocument(sourceDoc, targetDoc) {
        var sourceFile;
        try {
            sourceFile = sourceDoc.fullName;
        } catch (error) {
            throw new Error("Save the original Illustrator document once before creating a resized copy.");
        }
        var outputFile = uniqueOutputFile(sourceFile);
        var options = new IllustratorSaveOptions();
        options.pdfCompatible = true;
        // See createWorkingCopy: compressed:true on top of pdfCompatible
        // is the slow combination that made saveAs look hung on heavy files.
        options.compressed = false;
        targetDoc.saveAs(outputFile, options);
        return outputFile;
    }

    api.getDocumentInfo = function () {
        try {
            if (app.documents.length === 0) return "ERROR|" + encode("Open an Illustrator document first.");
            var doc = app.activeDocument;
            var rect = getActiveRect(doc);
            var factor = getScaleFactor(doc);
            return ok([
                round(rectWidth(rect) * factor),
                round(rectHeight(rect) * factor),
                doc.artboards.length,
                encode(doc.name),
                factor,
                VERSION
            ]);
        } catch (error) {
            return errorResult(error);
        }
    };

    api.resize = function (requestedWidth, requestedHeight, scope, rangeText, scaleArtwork, scaleAppearance, createCopy) {
        var state = null;
        var outputFile = null;
        var previousScaleLineWeight = getScaleLineWeightPref();
        // Expanding envelopes goes through a menu command; suppress any
        // dialog so a long batch can never stall waiting on the user.
        var previousInteraction = null;
        try { previousInteraction = app.userInteractionLevel; } catch (levelError) { previousInteraction = null; }
        try { app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS; } catch (setLevelError) {}
        try {
            requestedWidth = Number(requestedWidth);
            requestedHeight = Number(requestedHeight);
            scope = String(scope || "all");
            rangeText = String(rangeText === undefined || rangeText === null ? "" : rangeText);
            scaleArtwork = Boolean(scaleArtwork);
            scaleAppearance = Boolean(scaleAppearance);
            createCopy = Boolean(createCopy);

            // Illustrator only scales live effects (Warp, Drop Shadow, etc.)
            // during a transform when this app-level preference is on -
            // item.resize()'s own parameters only cover stroke width, not
            // effects with absolute parameters. Without this, anything with
            // a live effect kept its old on-canvas size after the resize.
            if (previousScaleLineWeight !== null) setScaleLineWeightPref(scaleAppearance);

            if (app.documents.length === 0) throw new Error("Open an Illustrator document first.");
            if (!isFinite(requestedWidth) || !isFinite(requestedHeight) || requestedWidth <= 0 || requestedHeight <= 0) {
                throw new Error("Enter valid width and height values.");
            }

            var doc = app.activeDocument;
            var selectedIndices = getScopeIndices(doc, scope, rangeText);
            // Rebuilding is deliberate for multiple artboards: some existing
            // Illustrator documents reject direct artboardRect writes (AOoC),
            // while Documents.add creates the same grid through Illustrator's
            // own layout engine.
            if (selectedIndices.length > 1) {
                if (!createCopy) {
                    throw new Error("Enable 'Create a new file and preserve the original'. Multiple artboards are rebuilt into a new file for reliability.");
                }
                // A single regular-canvas document can only hold so many
                // artboards side by side before Illustrator is forced into
                // a Large Canvas layout (rejected below for Overlord
                // compatibility). Past that limit, split the artboards
                // across multiple output files instead of failing outright.
                var maxPerBatch = maxBoardsPerBatch(requestedWidth, requestedHeight);
                var batches = chunkIndices(selectedIndices, maxPerBatch);
                var totalBoards = 0, totalCopied = 0, totalSkipped = 0;
                var outputPaths = [];
                var batchIndex, batchDebugLines, batchResult, batchFile;
                for (batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                    batchDebugLines = [];
                    batchResult = rebuildDocument(doc, requestedWidth, requestedHeight, batches[batchIndex], scaleArtwork, scaleAppearance, batchDebugLines);
                    batchFile = saveRebuiltDocument(doc, batchResult.targetDoc);
                    writeDebugLog(batchFile, batchDebugLines);
                    totalBoards += batchResult.boardCount;
                    totalCopied += batchResult.copied;
                    totalSkipped += batchResult.skipped;
                    outputPaths.push(batchFile.fsName);
                }
                return ok([totalBoards, totalCopied, totalSkipped, encode(outputPaths.join(";;")), VERSION, batches.length]);
            }

            var boardData = buildBoardData(doc, selectedIndices, requestedWidth, requestedHeight);
            if (createCopy) {
                outputFile = createWorkingCopy(doc);
                doc = app.activeDocument;
            }

            var items = collectTopLevelItems(doc);
            state = unlockDocument(doc, items);
            var resizedItems = 0;
            var skippedItems = 0;
            var i, board;

            if (scaleArtwork) {
                for (i = 0; i < items.length; i++) {
                    // A single problematic item (bad bounds, broken link,
                    // unusual item type) must not abort the whole resize.
                    try {
                        board = findBoardForItem(items[i], boardData.boards);
                        if (board) {
                            transformItem(items[i], board, scaleAppearance);
                            resizedItems++;
                        } else {
                            skippedItems++;
                        }
                    } catch (itemError) {
                        skippedItems++;
                    }
                }
            }

            applyArtboards(doc, boardData, requestedWidth, requestedHeight);
            restoreDocument(state);
            state = null;
            app.redraw();

            if (createCopy) doc.save();
            var path = outputFile ? outputFile.fsName : "";
            return ok([boardData.boards.length, resizedItems, skippedItems, encode(path), VERSION]);
        } catch (error) {
            try { restoreDocument(state); } catch (restoreError) {}
            return errorResult(error);
        } finally {
            if (previousScaleLineWeight !== null) setScaleLineWeightPref(previousScaleLineWeight);
            if (previousInteraction !== null) {
                try { app.userInteractionLevel = previousInteraction; } catch (restoreLevelError) {}
            }
        }
    };
}(ArtboardResizer));
