Если возникнет проблема придётся лезть в `libraryScreen.js`

В целом ничего особо кроме этих блоков ничего интересного тут не было



`libraryScreen.js` #372
#######################
```// Content overlay required for some instances
this.contentOverlays[library.contentId] = new H5P.BranchingScenario.LibraryScreenOverlay(this);
wrapper.appendChild(this.contentOverlays[library.contentId].getDOM());
if (libraryMachineName === 'H5P.InteractiveVideo' || libraryMachineName === 'H5P.Video') {
  this.contentOverlays[library.contentId].addButton(
    'replay',
    this.parent.params.l10n.replayButtonText,
    () => {
      this.handleReplayVideo(libraryMachineName, library);
    }
  );
  this.contentOverlays[library.contentId].addButton(
    'proceed',
    library.proceedButtonText,
    () => {
      this.handleProceedAfterVideo();
    }
  );
}```
#######################

`libraryScreen.js` #504
#######################
```// Proceed to Branching Question automatically after video has ended
if (library === 'H5P.Video' && this.nextIsBranching(id)) {
  instance.on('stateChange', function (event) {
    if (event.data === H5P.Video.ENDED && self.navButton) {
      self.handleProceed();
    }
  });
}
else if (library === 'H5P.Image') {
  // Ensure that iframe is resized when image is loaded.
  instance.on('loaded', function () {
    self.handleLibraryResize();
    self.parent.trigger('resize');
  });
}

if (library === 'H5P.Video' || library === 'H5P.InteractiveVideo') {
  const videoInstance = (library === 'H5P.Video') ? instance : instance.video;

  videoInstance.on('loaded', () => {
    self.handleLibraryResize();
  });

  videoInstance.on('error', () => {
    self.parent.enableNavButton();
  });
}```
#######################

`libraryScreen.js` #590
#######################
```LibraryScreen.prototype.forceContentFinished = function (instance, library) {
  let forceContentFinished = false;

  if (instance) {
    forceContentFinished = forceContentFinished || (instance.getScore && typeof instance.getScore === 'function');
  }

  /*
   * Some libraries need to tuned explicitly because there's no way to
   * detect whether they are a "finishable" content type
   */
  if (library) {
    forceContentFinished = forceContentFinished || (library === 'H5P.Audio' || library === 'H5P.Video');
  }

  // Exceptions
  if (
    library === 'H5P.CoursePresentation' &&
    instance &&
    (instance.children.length + (instance.isTask ? 1 : 0) === 1) ||
    instance.activeSurface === true
  ) {
    forceContentFinished = false;
  }

  return forceContentFinished;
};```
#######################

`libraryScreen.js` #624
#######################
```LibraryScreen.prototype.addFinishedListeners = function (instance, library) {
  const that = this;

  if (typeof library !== 'string' || !instance) {
    return;
  }
  switch (library) {
    case 'H5P.CoursePresentation':
      // Permit progression when final slide has been reached
      instance.on('xAPI', (event) => {
        if (event.data.statement.verb.display['en-US'] === 'progressed') {
          const slideProgressedTo = parseInt(event.data.statement.object.definition.extensions['http://id.tincanapi.com/extension/ending-point']);
          if (slideProgressedTo === instance.children.length + (instance.isTask ? 1 : 0)) {
            if (this.navButton.classList.contains('h5p-disabled')) {
              that.parent.enableNavButton(true);
            }
          }
        }
      });
      break;

    case 'H5P.InteractiveVideo':
      // Permit progression when results have been submitted or video ended if no tasks
      instance.on('xAPI', (event) => {
        if (event.data.statement.verb.display['en-US'] === 'completed') {
          that.handleVideoOver();
        }
      });
      instance.video.on('stateChange', function (event) {
        if (event.data === H5P.Video.ENDED || (event.data === H5P.Video.PLAYING && that.contentOverlays[that.currentLibraryId].hidden === false)) {
          const answered = instance.interactions
            .filter(interaction => interaction.getProgress() !== undefined);

          // Giving opportunity to submit the answers
          if (instance.hasStar && answered.length > 0) {
            that.parent.enableNavButton();
          }
          else {
            that.handleVideoOver();
          }
          this.pause();
        }
      });
      break;

    // Permit progression when video ended
    case 'H5P.Video':
      instance.on('stateChange', function (event) {
        if (event.data === H5P.Video.ENDED) {
          if (!that.nextIsBranching(that.currentLibraryId)) {
            that.handleVideoOver();
          }
          // else already handled by general video listener
        }
      });
      break;

    // Permit progression when audio ended
    case 'H5P.Audio':
      instance.audio.on('ended', function () {
        that.parent.enableNavButton();
      });
      break;

    // Permit progression when xAPI sends "answered" or "completed"
    default:
      if (typeof instance.getAnswerGiven === 'function') {
        instance.on('xAPI', (event) => {
          if (
            event.data.statement.verb.display['en-US'] === 'answered' ||
            event.data.statement.verb.display['en-US'] === 'completed'
          ) {
            that.parent.enableNavButton();
          }
        });
      }
  }
};```
#######################

`libraryScreen.js` #1350
#######################
```const isImage = (instance && instance.libraryInfo.machineName === 'H5P.Image');
const isCP = (instance && instance.libraryInfo.machineName === 'H5P.CoursePresentation');
const isHotspots = (instance && instance.libraryInfo.machineName === 'H5P.ImageHotspots');
const isVideo = (instance && instance.libraryInfo.machineName === 'H5P.Video');
const isIV = (instance && instance.libraryInfo.machineName === 'H5P.InteractiveVideo');
const hasSize = (instance && instance.width && instance.height);
const isYoutube = element.classList.contains('h5p-youtube');```
#######################
