let dotnetRef = null;
let overlay = null;
let context = null;
let cvr = null;
let cameraEnhancerInstance = null;
let templateName = '';
let cameraViewInstance = null;

async function createScanner(dotnetObject, licenceKey, videoId, overlayId) {
    await setLicense(licenceKey);
    dotnetRef = dotnetObject;

    await initScanner(videoId, overlayId);
    await openCamera();
}

async function setLicense(licenceKey) {
    try {
        Dynamsoft.Core.CoreModule.engineResourcePaths.rootDirectory = "https://cdn.jsdelivr.net/npm";
        Dynamsoft.License.LicenseManager.initLicense(licenceKey, true);

        await Dynamsoft.Core.CoreModule.loadWasm(["DIP", "DBR", "DDN", "DLR"]);

        cvr = await Dynamsoft.CVR.CaptureVisionRouter.createInstance();
        await Dynamsoft.DDV.Core.init();

        Dynamsoft.DWT.ResourcesPath = "dist";
    } catch (e) {
        console.error(e);
    }
}

async function initScanner(videoId, overlayId) {

    let overlayElement = document.getElementById(overlayId);
    await initOverlay(overlayElement);

    try {
        templateName = 'ReadSingleBarcode'; // For better performance

        cameraViewInstance = await Dynamsoft.DCE.CameraView.createInstance();
        cameraEnhancerInstance = await Dynamsoft.DCE.CameraEnhancer.createInstance(cameraViewInstance);

        let videoElement = document.getElementById(videoId);
        videoElement.append(cameraViewInstance.getUIElement());

        cameraViewInstance.getUIElement().shadowRoot?.querySelector('.dce-sel-camera')?.setAttribute('style', 'display: none');
        cameraViewInstance.getUIElement().shadowRoot?.querySelector('.dce-sel-resolution')?.setAttribute('style', 'display: none');
        cameraViewInstance.setVideoFit("cover");

        cvr = await Dynamsoft.CVR.CaptureVisionRouter.createInstance();

        // Filter out unchecked and duplicate results.
        const filter = new Dynamsoft.Utility.MultiFrameResultCrossFilter();
        // Filter out unchecked barcodes.
        filter.enableResultCrossVerification("barcode", true);
        // Filter out duplicate barcodes within 3 seconds.
        filter.enableResultDeduplication("barcode", true);
        await cvr.addResultFilter(filter);

        cvr.setInput(cameraEnhancerInstance);

        cvr.addResultReceiver({
            onCapturedResultReceived: async (result) => {
                await showBarcodeResults(result, dotnetRef);
            }
        });

        cvr.addResultReceiver({
            onDecodedBarcodesReceived: (result) => {
                if (!result.barcodeResultItems.length) return;
            }
        });

        cameraEnhancerInstance.on('played', () => {
            updateResolution();
        });

    } catch (e) {
        console.error(e);
    }
}

async function initOverlay(ol) {
    overlay = ol;
    context = overlay.getContext('2d');
}

async function updateOverlay(width, height) {
    if (overlay) {
        overlay.width = width;
        overlay.height = height;
        await clearOverlay();
    }
}

async function clearOverlay() {
    if (context) {
        context.clearRect(0, 0, overlay.width, overlay.height);
        context.strokeStyle = '#ff0000';
        context.lineWidth = 5;
    }
}

async function drawOverlay(localization, text) {
    if (context) {
        let points = localization.points;

        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        context.lineTo(points[1].x, points[1].y);
        context.lineTo(points[2].x, points[2].y);
        context.lineTo(points[3].x, points[3].y);
        context.lineTo(points[0].x, points[0].y);
        context.stroke();

        context.font = '18px Verdana';
        context.fillStyle = '#ff0000';
        let x = [
            points[0].x,
            points[1].x,
            points[2].x,
            points[3].x,
        ];
        let y = [
            points[0].y,
            points[1].y,
            points[2].y,
            points[3].y,
        ];
        x.sort(function (a, b) {
            return a - b;
        });
        y.sort(function (a, b) {
            return b - a;
        });
        let left = x[0];
        let top = y[0];

        context.fillText(text, left, top + 50);
    }
}

async function showBarcodeResults(result, dotnetRef) {
    await clearOverlay();

    let txts = [];
    try {
        let localization;
        let items = result.items
        if (items.length > 0) {
            for (var i = 0; i < items.length; ++i) {

                if (items[i].type !== Dynamsoft.Core.EnumCapturedResultItemType.CRIT_BARCODE) {
                    continue;
                }

                let item = items[i];

                txts.push(item.text);
                localization = item.location;

                await drawOverlay(
                    localization,
                    item.text
                );
            }


        }
    } catch (e) {
        console.error(e);
    }

    let barcoderesults = txts.join(', ');
    if (txts.length == 0) {
        barcoderesults = 'No barcode found';
    }

    if (dotnetRef && txts.length > 0) {
        await dotnetRef.invokeMethodAsync('ReturnBarcodeResults', barcoderesults);
    }
}

async function updateResolution() {
    if (cameraEnhancerInstance) {
        let resolution = cameraEnhancerInstance.getResolution();
        await updateOverlay(resolution.width, resolution.height);
    }
}

async function openCamera() {
    await clearOverlay();

    try {
        let availableCameras = await cameraEnhancerInstance.getAllCameras();
        if (cameraEnhancerInstance && availableCameras.length > 0) {
            await cameraEnhancerInstance.open();
            cvr.startCapturing(templateName);
        }
    }
    catch (e) {
        console.error(e);
    }
}

async function disposeScanner() {
    if (cvr) {
        cvr.dispose();
        cvr = null;
    }

    if (cameraEnhancerInstance) {
        cameraEnhancerInstance.dispose();
        cameraEnhancerInstance = null;
    }

    if (cameraViewInstance) {
        cameraViewInstance.dispose();
        cameraViewInstance = null;
    }
}

export { createScanner, disposeScanner };