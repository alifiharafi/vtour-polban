/*
 * Copyright 2016 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

/*** !Customize: Logging ***/
var participantName = null;
while(!participantName) {
  participantName = prompt("What's your name?");
}
alert(`Thank you ${participantName} for participating in this research!`);


// !Customize
let scenePos = 0;
let labelGesture = ["closed", "point", "open"];
let iconGesture = ["hand-close.png", "hand-point.png", "hand-open.png"];

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');
  
  // !Customize
  var webCamToggleElement = document.querySelector('#webCamToggle');

  // Detect desktop or mobile mode.
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Create scenes.
  // !Customize
  let countHotspot = 0;
  
  var scenes = data.scenes.map(function(data) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(data.levels);

    var limiter = Marzipano.RectilinearView.limit.traditional(data.faceSize, 100*Math.PI/180, 120*Math.PI/180);
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // !Customize
    countHotspot = 0;
    data.linkHotspots.forEach(function(hotspot) {
      if(hotspot.hasOwnProperty("target")) {
        var element = createLinkHotspotElement(data.id,hotspot,countHotspot);
        scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
      }
      countHotspot = countHotspot + 1;
    });

    // Create info hotspots.
    data.infoHotspots.forEach(function(hotspot) {
      var element = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return {
      data: data,
      scene: scene,
      view: view
    };
  });

  // Set up autorotate, if enabled.
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI/2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  autorotateToggleElement.addEventListener('click', toggleAutorotate);
  
  // !Customize
  // Set handler for show webcame toggle.
  webCamToggleElement.addEventListener('click', toggleShowWebCam);
  
  // Set up fullscreen mode, if supported.
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) {
        fullscreenToggleElement.classList.add('enabled');
      } else {
        fullscreenToggleElement.classList.remove('enabled');
      }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // Set handler for scene list toggle.
  sceneListToggleElement.addEventListener('click', toggleSceneList);

  // Start with the scene list open on desktop.
  if (!document.body.classList.contains('mobile')) {
    showSceneList();
  }

  // Set handler for scene switch.
  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function() {
      switchScene(scene);
      // On mobile, hide scene list after selecting a scene.
      if (document.body.classList.contains('mobile')) {
        hideSceneList();
      }
    });
  });

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  function switchScene(scene) {
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);

    // !Customize: Update scene
    updateScenePos(scene);
  }
  
  // !Customize
  function updateScenePos(scene) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === scene.data.id) {
        scenePos = i;
        break;
      }
    }
  }
  
  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    }
  }

  function showSceneList() {
    sceneListElement.classList.add('enabled');
    sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    sceneListElement.classList.remove('enabled');
    sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    sceneListElement.classList.toggle('enabled');
    sceneListToggleElement.classList.toggle('enabled');
  }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) {
      return;
    }
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  // !Customize
  function toggleShowWebCam() {
    if (webCamToggleElement.classList.contains('enabled')) {
      webCamToggleElement.classList.remove('enabled');
      document.getElementById("handtrackjs-area").style.display="none";
    } else {
      webCamToggleElement.classList.add('enabled');
      document.getElementById("handtrackjs-area").style.display="block";
    }
  }

  // !Customize. Add new parameters: sceneName, buttonOrder
  function createLinkHotspotElement(sceneName,hotspot,buttonOrder) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');
    
    // !Customize. Deklarasi ID untuk elemen tombol.
    wrapper.setAttribute("id",`from-${sceneName}-to-${hotspot.target}`);

    // Create image element.
    var icon = document.createElement('img');
    // !Customize
    var imgSrc;
    for (let i = 0; i <iconGesture.length ; i++) {
      if(i==buttonOrder){
        imgSrc = iconGesture[i];
      }
    }
    icon.src = `img/${imgSrc}`; // End of !Customize
    icon.classList.add('link-hotspot-icon');

    // Set rotation transform.
    var transformProperties = [ '-ms-transform', '-webkit-transform', 'transform' ];
    for (var i = 0; i < transformProperties.length; i++) {
      var property = transformProperties[i];
      icon.style[property] = 'rotate(' + hotspot.rotation + 'rad)';
    }

    // Add click event handler.
    wrapper.addEventListener('click', function() {
      switchScene(findSceneById(hotspot.target));
    });

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    // Create tooltip element.
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');
    tooltip.innerHTML = findSceneDataById(hotspot.target).name;

    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);

    return wrapper;
  }

  function createInfoHotspotElement(hotspot) {

    // Create wrapper element to hold icon and tooltip.
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('info-hotspot');

    // Create hotspot/tooltip header.
    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    // Create image element.
    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    /* !Costumize */
    // icon.src = 'img/info.png';
    icon.src = 'img/info-hand-pinch.png';
    // icon.src = 'img/hand-pinch.png';
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    // Create title element.
    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    // Create close element.
    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    // Construct header element.
    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    // Create text element.
    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    // Place header and text into wrapper element.
    wrapper.appendChild(header);
    wrapper.appendChild(text);

    // Create a modal for the hotspot content to appear on mobile mode.
    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var toggle = function() {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };

    // Show content when hotspot is clicked.
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);

    // Hide content when close icon is clicked.
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    // Prevent touch and scroll events from reaching the parent element.
    // This prevents the view control logic from interfering with the hotspot.
    stopTouchAndScrollEventPropagation(wrapper);

    return wrapper;
  }

  // Prevent touch and scroll events from reaching the parent element.
  function stopTouchAndScrollEventPropagation(element, eventList) {
    var eventList = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel',
                      'wheel', 'mousewheel' ];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function(event) {
        event.stopPropagation();
      });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) {
        return scenes[i];
      }
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) {
        return data.scenes[i];
      }
    }
    return null;
  }


  // Display the initial scene.
  switchScene(scenes[0]);
  
  /*** !Customize. Handtrack.js ***/
  // Default Parameter of handtrack.js
    const modelParams = {
      flipHorizontal: false,
      outputStride: 16,
      imageScaleFactor: 1,
      maxNumBoxes: 20,
      iouThreshold: 0.2,
      scoreThreshold: 0.6,
      modelType: "ssd320fpnlite",
      modelSize: "large",
      bboxLineWidth: "2",
      fontSize: 17,
  }

  // Web Camera Access
  navigator.getUserMedia = 
      navigator.getUserMedia || 
      navigator.webkitGetUserMedia || 
      navigator.mozGetUserMedia || 
      navigator.msGetUserMedia;

  // !Customize
  const video = document.querySelector("#video");
  let model;
  // Insert Web Camera Ouput to Video Element
  handTrack.startVideo(video)
      .then(status => {
          if(status){
              navigator.getUserMedia({video : {} }, stream => {
                  video.srcObject = stream;
                  setInterval(runDetection, 10);
                },
                err => console.log(error)
              );
          }
      });

  // Show Prediction to Web Camera 
  const canvas = document.querySelector("#handtrackjs-area");
  const context = canvas.getContext("2d");

  // Create Dataset for All Buttons to Each Scene
  // Return: Array of Object
  function createButtonDataset() {
    let buttonDataset = [];
    let buttonIdSetTemp = [];
    let numberOfButton;

    for (let i = 0; i < scenes.length; i++) {
      buttonIdSetTemp = [];
      numberOfButton = scenes[i].data.linkHotspots.length;
      
      for (var j = 0; j < numberOfButton; j++) {
          buttonIdSetTemp.push(
            "from-"+scenes[i].data.id+"-to-"+scenes[i].data.linkHotspots[j].target
          );      
      }
      buttonDataset.push({buttonIdSet : buttonIdSetTemp});
    }
    
    return buttonDataset;
  }

  const buttonDataset = createButtonDataset();

  // Load Model
  handTrack.load(modelParams)
    .then(lmodel => {
        model = lmodel;
    })

  // Action same as to Click Button using Detected Gesture

  // Return Total Button on Current Scene
  function getTotalActiveButtonNow() {
    return scenes[scenePos].data.linkHotspots.length;
  }

  // Match Predicted Gesture to Provided Button
  function moveScene(predictionLabel) {
    const totalActiveButtonNow = getTotalActiveButtonNow();
    for (let i = 0; i < totalActiveButtonNow; i++) {
      if(predictionLabel == labelGesture[i]){
        document.getElementById(buttonDataset[scenePos].buttonIdSet[i]).click();
        console.log(buttonDataset[scenePos].buttonIdSet[i]);
      }
    }
  }

  // Display Information on Current Scene
  function toggleInfo() {
    console.log(document.querySelectorAll('.info-hotspot[style*="display: block"] .info-hotspot-header'));
    let buttonInfo = document.querySelectorAll('.info-hotspot[style*="display: block"] .info-hotspot-header');

    buttonInfo.forEach(btn => {
      btn.click();
    });
  }

  // Gesture Detection Checking
  function isDetected(predictions){
    let isDetected = false;
    if(predictions.length > 0){
      isDetected = true;
    }
    return isDetected;
  }

  /* Miscellaneous */
  var previousLabel;
  var countPreviousLabel = 0;
  var limitPreviousLabel = 75;

  function runDetection() {
    model.detect(video)
      .then(predictions => {
        model.renderPredictions(predictions,canvas,context,video);

        if(isDetected(predictions)) {
          if(predictions[0].label != 'face') {
            if(previousLabel == predictions[0].label) {
              countPreviousLabel++;
              console.log(previousLabel + ' : ' + countPreviousLabel);

              if(countPreviousLabel > limitPreviousLabel) {
                console.log(participantName + ' - ' + new Date().toISOString() + ' - ' + predictions[0].label);
                
                if(predictions[0].label != 'pinch') {
                  moveScene(predictions[0].label);
                } else {
                  toggleInfo();
                }
                
                previousLabel = null;
                countPreviousLabel = 0;
              }
            } else {
              previousLabel = predictions[0].label;
              countPreviousLabel = 0;
            }
          }
        }
        
      });
  }

  /* function runDetection() {
    model.detect(video)
      .then(predictions => {
        model.renderPredictions(predictions,canvas,context,video);

        if(isDetected(predictions)) {
          if(predictions[0].label != 'face') {
            if(previousLabel != predictions[0].label) {
              console.log(previousLabel);
              console.log(participantName + ' - ' + new Date().toISOString() + ' - ' + predictions[0].label);
              moveScene(predictions[0].label);
              previousLabel = predictions[0].label;
            } else {
              countPreviousLabel++;
              console.log(previousLabel + ' : ' + countPreviousLabel);
              if(countPreviousLabel > limitPreviousLabel) {
                previousLabel = null;
                countPreviousLabel = 0; // reset counter
              }
            }
          }
        }
        
      });
  } */
})();