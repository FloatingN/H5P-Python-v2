/** Class representing the content */
export default class PythonContent {
  /**
   * @constructor
   *
   * @param {string} textField Parameters from editor.
   * @param {string} [username=world] Username.
   * @param {number} [random=-1] Random number.
   */

  // TODO !!!!!!!!!!!!!!!!!!!!!!!!!
  // eslint-disable-next-line no-unused-vars
  constructor(python, random = -1) {
    this.python = python;
    this.params = python.params;
    this.codeName = this.python.contentId + '@code@' + this.python.extras.subContentId
    this.savedUserCode = sessionStorage.getItem(this.codeName);

    this.setupApi();

    this.content = document.createElement('div');
    this.content.classList.add('h5p-python-content');
    this.content.style.maxHeight = this.params.editorOptions.maxHeight;

    this.createInstructions();

    this.createEditor();

    this.createOutput();

    this.addButtons();

    //TODO

    window.editor = this.editor;
    window.output = this.output;
    window.tutu = this;
  }

  /**
   * Run the python code in the editor
   */
  run() {

    this.shouldStop = false;
    this.setupApi = {};

    this.python.hideButton('run');
    this.python.showButton('stop');

    this.editor.setOption('readOnly', true);
    this.output.setValue('');

    // todo : remove the true
    Sk.H5P.run(this.getCodeToRun(this.editor.getValue()), {
      output: x => {
        CodeMirror.H5P.appendText(this.output, x);
      },
      input: (p, resolve, reject) => {
        this.currentRejectPromise = reject;
        p.output(p.prompt);
        let lastLine = this.output.lastLine();
        let lastCh = this.output.getLine(lastLine).length;
        this.output.setOption('readOnly', false);
        // mark the text as readonly to prevent deletion (even if we will prevent selection before the start of input, it would be
        // possible to delete with backspace ; this prevent this).
        let readOnlyMarker = this.output.markText({ line: 0, ch: 0 }, { line: lastLine, ch: lastCh }, { readOnly: true });
        let focusHandler = (() => {
          this.output.execCommand('goDocEnd');
        });
        /**
         * Prevent the cursor from going before the start of the input zone in the output
         * @function
         */
        let cursorHandler = (() => {
          let cursorHead = this.output.getCursor('head');
          let cursorAnchor = this.output.getCursor('anchor');
          if (cursorHead.line < lastLine || (cursorHead.line === lastLine && cursorHead.ch < lastCh)) {
            cursorHead = { line: lastLine, ch: lastCh };
          }
          if (cursorAnchor.line < lastLine || (cursorAnchor.line === lastLine && cursorAnchor.ch < lastCh)) {
            cursorAnchor = { line: lastLine, ch: lastCh };
          }
          this.output.setSelection(cursorAnchor, cursorHead);
        });
        this.output.on('focus', focusHandler);
        this.output.on('cursorActivity', cursorHandler);
        this.output.focus();
        this.output.addKeyMap({
          'name': 'sendInput',
          'Enter': () => { // Shift-Enter is not blocked and allow to send multi-lines text !

            let lastLine2 = this.output.lastLine();
            let lastCh2 = this.output.getLine(lastLine2).length;

            p.output("\n");

            this.output.off('focus', focusHandler);
            this.output.off('cursorActivity', cursorHandler);
            this.output.removeKeyMap('sendInput');

            readOnlyMarker.clear();
            this.output.setOption('readOnly', true);

            this.output.getInputField().blur();

            resolve(this.output.getRange({ line: lastLine, ch: lastCh }, { line: lastLine2, ch: lastCh2 }));

          }
        });
      },
      onSuccess: () => {
        if (this.params.requireRunBeforeCheck) {
          this.python.showButton('check-answer');
        }
      },
      onError: error => {
        let errorText;
        if (this.shouldStop) {
          errorText = 'Execution interrupted';
        }
        else {
          if (error.traceback) {
            // if code was added before, substract the length of added code to preserve line number error.
            let addedCodeLength = this.getBeforeCode().split('\n').length - 1; // +1 because of \n
            error.traceback.forEach(v => {
              if (v.filename === '<stdin>.py') {
                v.lineno -= addedCodeLength;
              }
            });
          }

          errorText = error.toString();
          // Create stacktrace message
          if (error.traceback && error.traceback.length > 1) {
            errorText += Sk.H5P.getTraceBackFromError(error);
          }
        }
        CodeMirror.H5P.appendLines(this.output, errorText, 'CodeMirror-python-highlighted-error-line');
      },
      onFinally: () => {
        this.python.showButton('run');
        this.python.hideButton('stop');
        this.editor.setOption('readOnly', false);
      },
      shouldStop: () => this.shouldStop
    });
  }

  /**
   * Stop the execution of the current code in the editor.
   * Called by pressing the stop button that appear when the
   * "Run" / "Check" button is pressed and the execution haven't finished.
   */
  stop() {

    this.editor.setOption('readOnly', false);

    this.shouldStop = true;
    if (this.currentRejectPromise !== undefined) {
      this.currentRejectPromise('Interrupted execution');
    }
    if (Sk.rejectSleep !== undefined) {
      Sk.rejectSleep('Interrupted execution');
    }
  }

  /**
   * Check the answer submitted by the student.
   * Will call other function to check the answer
   * depending of the grading method selected.
   */
  checkAnswer() {

    this.stop();
    this.shouldStop = false;
    this.setupApi = {};

    this.python.hideButton('run');
    this.python.showButton('stop');

    this.editor.setOption('readOnly', true);

    this.python.hideButton('check-answer');

    if (this.params.behaviour.enableSolutionsButton && this.params.solutionCode) {
      this.python.showButton('show-solution');
    }

    if (this.params.behaviour.enableRetry) {
      this.python.showButton('try-again');
    }


    // let runError = false;

    if (this.params.grading.gradingMethod === 'compareOutputs') {
      this.checkAnswer_compareOutputs();
    }
    if (this.params.grading.gradingMethod === 'programmedGrading') {
      this.checkAnswer_programmedGrading();
    }
  }

  /**
   * Check the student solution when the grading method is set to "Compare outputs".
   * This will run the student code and the solution code and check both output.
   * The student code will success if both output are the same.
   */

  normalizeString(str) {
    return str.replace(/[\s\n]+/g, ' ');
  }

  partial_comparator(str1, str2) {
    str1 = this.normalizeString(str1);
    str2 = this.normalizeString(str2);

    const regexp = new RegExp(str1, 'i');

    return regexp.test(str2);
  }

  checkAnswer_compareOutputs() {
    let iCheckExecution = -1;
    let iCheckInputs;
    let checkInputs;
    let runError = false;

    this.output.setValue('');
    this.userOutput = '';

    // https://pouchdb.com/2015/05/18/we-have-a-problem-with-promises.html

    let result = Promise.resolve();

    this.params.grading.inputs.map(() => {
      return () => {
        iCheckExecution++;
        checkInputs = this.params.grading.inputs[iCheckExecution].split('\n');
        iCheckInputs = 0;
        this.userOutput += '===\n';
        let isFirstOutput = true;
        return Sk.H5P.run(this.getCodeToRun(this.editor.getValue(), true), {
          output: x => {
            this.userOutput += x; 
          },
          input: (p, resolve) => {
            let r = checkInputs[iCheckInputs] || '';
            iCheckInputs++;
            // p.output(p.prompt);
            // p.output(r);
            // p.output('\n');
            resolve(r);
          },
          chain: true,
          shouldStop: () => this.shouldStop
        }).catch((error) => {
          runError = error;
        }).finally(() => {
          if (!runError) {
            return Promise.resolve();
          }
          else {
            this.userOutput = '!Error!:'+runError
            return Promise.resolve();
          }
        });
      };
    }).forEach((promiseFactory) => {
      result = result.then(promiseFactory);
    });
    result.then(() => {
    var alts = this.params.branchingQuestion.alternatives;
    let matchedAlternative = false;
    for (let i = 0; i < alts.length; i++) {
      if (!alts[i].text) {
        matchedAlternative = alts[i];
        break;
      } else if (alts[i].comp == 'exact') {
        if (this.userOutput.trim() == alts[i].text.trim()) {
          matchedAlternative = alts[i];
          break;
        }
      } else if (alts[i].comp == 'partial') {
        if (this.partial_comparator(alts[i].text.trim(), this.userOutput.trim())) {
          matchedAlternative = alts[i];
          break;
        }
      }
    }
    sessionStorage.setItem(this.codeName, this.editor.getValue())
    var nextScreen = {
      nextContentId: matchedAlternative.nextContentId
    };
    this.python.trigger('navigated', nextScreen);
    })

  }

  /**
   * Check the student solution when the grading method is set to "Programmed grading".
   */
  checkAnswer_programmedGrading() {
    let iCheckExecution = -1;
    let iCheckInputs;
    let checkInputs;
    let runError = false;

    this.output.setValue('');

    // todo solution empty ? Need to check !

    // https://pouchdb.com/2015/05/18/we-have-a-problem-with-promises.html

    let result = Promise.resolve();

    this.params.grading.inputs.map(() => {
      return () => {
        iCheckExecution++;
        checkInputs = this.params.grading.inputs[iCheckExecution].split('\n');
        iCheckInputs = 0;
        this.userOutput = '';
        this.solOutput = '';
        return Sk.H5P.run(this.getCodeToRun(this.editor.getValue(), true, { execution: iCheckExecution }), {
          output: x => {
            this.userOutput += x;
          },
          input: (p, resolve) => {
            let r = checkInputs[iCheckInputs] || '';
            iCheckInputs++;
            p.output(p.prompt);
            p.output(r);
            p.output('\n');
            resolve(r);
          },
          chain: true,
          shouldStop: () => this.shouldStop
        }).catch((error) => {
          runError = error;
        }).finally(() => {
          if (!runError) {
            return Promise.resolve();
          }
          else {
            let outputText = '';

            if (runError.traceback) {
              // if code was added before, substract the length of added code to preserve line number error.
              let addedCodeLength = this.getBeforeCode(true).split('\n').length - 1; // +1 because of \n
              runError.traceback.forEach(v => {
                if (v.filename === '<stdin>.py') {
                  v.lineno -= addedCodeLength;
                }
              });
            }
            outputText += 'Error while execution\n';
            outputText += '----------------\n';
            outputText += runError.toString();


            CodeMirror.H5P.appendLines(this.output, outputText, 'CodeMirror-python-highlighted-error-line');

            return Promise.reject();
          }
        });
      };
    }).forEach((promiseFactory) => {
      result = result.then(promiseFactory);
    });

    result.catch(() => {

    }).finally(() => {
      this.python.hideButton('stop');
    });

  }

  /**
   * Show the solution.
   * Called when pressing the "Show solution" button
   * which is displayed after pressing the "Check" button.
   */
  showSolution() {
    this.codeBeforeSolution = this.editor.getValue();
    this.editor.setValue(CodeMirror.H5P.decode(this.params.solutionCode));
    // this.editor.setOption('readOnly', true);
    this.python.hideButton('show-solution');
    this.python.showButton('hide-solution');
  }

  /**
   * Hide the solution.
   * Called when presisng the Hide solution button which
   * is displayed after pressing the "Show solution" button.
   */
  hideSolution() {
    this.editor.setValue(this.codeBeforeSolution);
    // this.editor.setOption('readOnly', false);
    this.python.hideButton('hide-solution');
    this.python.showButton('show-solution');
  }

  /**
   * Create and append the instruction block (and it's show/hide vertical bar) if some instruction are set.
   * This block will contain instruction on what the student have to do.
   */
  createInstructions() {
    if (this.params.instructions !== '') {

      this.instructions = document.createElement('div');
      this.instructions.classList.add('h5p-python-instructions');

      CodeMirror.requireMode('python', () => {
        this.instructions.innerHTML = this.params.instructions.replace(
          /`(?:([^`<]+)|``([^`]+)``)`/g, // `XXX` or ```YYY``` ; XXX can't have html tag (so no new line)
          (m, inlineCode, blockCode) => {
            let code;
            if (inlineCode) {
              code = CodeMirror.H5P.decode(inlineCode);
            }
            else {
              // the code will be contaminated with the html of the WYSIWYG engine, we need to clean that. There is a new
              // line before/after ``` so there will be </div> at the start and <div> at the end, we need to remove them.
              let start = blockCode.indexOf('</div>') + '</div>'.length;
              let end = blockCode.lastIndexOf('<div>') - '<div>'.length - 1;
              // if they are not found (probably because there is no new line after/before ```) we don't highlight the code
              if (start === -1 || end === -1) return m;
              code = blockCode.substr(start, end).trim(); // trim will not remove wanted space at the start because code will be inside other div
              code = new DOMParser().parseFromString(code, 'text/html').documentElement.textContent; // we get the textContent to remove the unwated html
            }
            let codeNode = document.createElement('pre');
            codeNode.classList.add('cm-s-default');
            if (inlineCode) {
              codeNode.classList.add('h5p-python-instructions-inlineCode');
            }
            CodeMirror.runMode(code, 'python', codeNode);
            return codeNode.outerHTML;
          }
        );
      }, {
        path: function (mode) {
          return CodeMirror.H5P.getPath('mode/' + mode + '/' + mode + '.js');
        }
      });

      this.content.appendChild(this.instructions);

    }
  }

  /**
   * Append the codemirror that will act as editor
   */
  createEditor() {

    this.nodeEditor = document.createElement('div');
    this.nodeEditor.classList.add('h5p-python-codeEditor');
    this.content.appendChild(this.nodeEditor);

    let instructionHandle = document.createElement('div');
    instructionHandle.classList.add('h5p-python-instructions-handle');
    this.nodeEditor.appendChild(instructionHandle);

    instructionHandle.addEventListener('click', () => {
      if (!this.instructions.classList.contains('hidden')) {
        this.instructions.classList.add('hidden');
        instructionHandle.classList.add('hidden');
      }
      else {
        this.instructions.classList.remove('hidden');
        instructionHandle.classList.remove('hidden');
      }
    });



    this.editor = CodeMirror(this.nodeEditor, {
      value: CodeMirror.H5P.decode(this.savedUserCode || this.params.startingCode || ''),
      inputStyle: 'textarea',
      keyMap: 'sublime',
      tabSize: this.params.editorOptions.tabSize,
      lineWrapping: true,
      indentWithTabs: true,
      lineNumbers: true,
      matchBrackets: true,
      matchTags: this.params.editorOptions.matchTags ? {
        bothTags: true
      } : false,
      foldGutter: this.params.editorOptions.foldGutter,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      styleActiveLine: {
        nonEmpty: true
      },
      extraKeys: {
        'F11': function (cm) {
          cm.setOption('fullScreen', !cm.getOption('fullScreen'));
        },
        'Esc': function (cm) {
          if (cm.getOption('fullScreen')) {
            cm.setOption('fullScreen', false);
          }
          else {
            // The user pressed the escape key, tab will now tab to the next element
            // instead of adding a tab in the code. This is important for accessibility
            // The tab behaviour will revert to default the next time the editor is focused.
            if (!cm.state.keyMaps.some(x => x.name === 'tabAccessibility')) {
              cm.addKeyMap({
                'name': 'tabAccessibility',
                'Tab': false,
                'Shift-Tab': false
              });
            }
          }
        },
        'Ctrl-Enter': () => {
          this.run();
        }
      }
    });

    this.editor.on('focus', function (cm) { // On focus, make tab add tab in editor
      cm.removeKeyMap('tabAccessibility');
    });

    this.editor.on('refresh', () => {
      this.python.trigger('resize');
    });

    if (this.params.editorOptions.highlightLines !== '') {
      CodeMirror.H5P.highlightLines(this.editor, this.params.editorOptions.highlightLines);
    } // TODO : BE CARREFULL WITH THIS AND CONTENT STATE AS THE LINES WILL NOT BE THE SAME !

    if (this.params.editorOptions.readOnlyLines !== '') {
      CodeMirror.H5P.readOnlyLines(this.editor, this.params.editorOptions.readOnlyLines, this.params.editorOptions.readOnlyStyle ? 'CodeMirror-python-readonly' : undefined);
    } // TODO : BE CARREFULL WITH THIS AND CONTENT STATE AS THE LINES WILL NOT BE THE SAME !

    if (this.params.requireRunBeforeCheck) {
      this.editor.on('changes', () => {
        this.python.hideButton('check-answer');
      });
    }

    this.editor.on('changes', () => {
      this.python.trigger('resize');
    });

    this.editor.refresh(); // required to avoid bug where line number overlap code that might happen in some condition

    CodeMirror.H5P.setLanguage(this.editor, 'python');

    let outputHandle = document.createElement('div');
    outputHandle.classList.add('h5p-python-output-handle');
    this.nodeEditor.appendChild(outputHandle);

    outputHandle.addEventListener('click', () => {
      if (!this.nodeOutput.classList.contains('hidden')) {
        this.nodeOutput.classList.add('hidden');
        outputHandle.classList.add('hidden');
      }
      else {
        this.nodeOutput.classList.remove('hidden');
        outputHandle.classList.remove('hidden');
      }
    });


  }

  /**
   * Append the codemirror that will act as ouput
   */
  createOutput() {

    this.nodeOutput = document.createElement('div');
    this.nodeOutput.classList.add('h5p-python-output');
    this.content.appendChild(this.nodeOutput);

    CodeMirror.H5P.loadTheme('nord');

    this.output = CodeMirror(this.nodeOutput, {
      value: '',
      inputStyle: 'textarea',
      theme: 'nord',
      readOnly: true,
      tabSize: 2,
      indentWithTabs: true,
      lineWrapping: true,
      styleActiveLine: false,
      extraKeys: {
        'F11': function (cm) {
          cm.setOption('fullScreen', !cm.getOption('fullScreen'));
        },
        'Esc': function (cm) {
          if (cm.getOption('fullScreen')) {
            cm.setOption('fullScreen', false);
          }
        },
        'Tab': false,
        'Shift-Tab': false
      }
    });

    this.output.on('focus', () => {
      this.output.setOption('styleActiveLine', {
        nonEmpty: true
      });
    });

    this.output.on('blur', () => {
      this.output.setOption('styleActiveLine', false);
    });

    this.output.on('refresh', () => {
      this.python.trigger('resize');
    });

    this.output.on('changes', () => {
      this.python.trigger('resize');
    });

    this.output.refresh(); // required to avoid bug where line number overlap code that might happen in some condition

  }

  /**
   * It is possible to add code to run before / after user code.
   * This function return the code with the added code.
   * @param {string} code 
   * @param {boolean} [grading] Set to true to inject grading code
   * @param {Object} [options]
   * @param {Object} [options.execution] The execution number, used when there is multiple executions set.
   */

  getCodeToRun(code, grading, options) {
    options = options || {};
    return this.getBeforeCode(grading, options) + code + '\n' + this.getAfterCode(grading, options);
  }

  getBeforeCode(grading, options) {
    let beforeCode = '';
    options = options || {};

    if (options.execution !== undefined) {
      beforeCode += 'h5p_execution = ' + options.execution + '\n';
      beforeCode += 'h5p_lastExecution = ' + (options.execution === this.params.grading.inputs.length - 1 ? 'True' : 'False') + '\n';
    }

    if (this.params.grading.gradingMethod === 'programmedGrading' && this.params.grading.executeBeforeGradingCode && grading === true) {
      beforeCode += CodeMirror.H5P.decode(this.params.grading.executeBeforeGradingCode) + '\n';
    }

    if (this.params.advancedOptions.executeBeforeCode) {
      beforeCode += CodeMirror.H5P.decode(this.params.advancedOptions.executeBeforeCode || '') + '\n';
    }

    return this.injectApi(beforeCode);
  }

  getAfterCode(grading, options) {
    let afterCode = '';
    options = options || {};

    if (this.params.advancedOptions.executeAfterCode) {
      afterCode += CodeMirror.H5P.decode(this.params.advancedOptions.executeBeforeCode || '') + '\n';
    }

    if (this.params.grading.gradingMethod === 'programmedGrading' && grading === true) {
      if (options.execution !== undefined) {
        afterCode += 'h5p_execution = ' + options.execution + '\n';
        afterCode += 'h5p_lastExecution = ' + (options.execution === this.params.grading.inputs.length - 1 ? 'True' : 'False') + '\n';
      }
      afterCode += CodeMirror.H5P.decode(this.params.grading.gradingCode || '');
    }

    return this.injectApi(afterCode);
  }

  /**
   * Setup the Api.
   * This will set the various api functions under a random name to reduce cheating.
   */
  setupApi() {
    this.randomApiKey = (parseInt(Math.random() * 58786559 + 1679616)).toString(36); // generate a string between 10000 and ZZZZZ
    this.apis = {
      /**
       * Set the score to the activity and optionnaly display a message.
       * @param {number} score
       * @param {boolean} [passed]
       * @param {string} [message]
       * @returns 
       */
      setScore: (score, passed, message) => {
        score = Sk.ffi.remapToJs(score);
        passed = Sk.ffi.remapToJs(passed);
        message = Sk.ffi.remapToJs(message);
        if (typeof score !== 'number') return;
        if (typeof passed !== 'undefined' && typeof passed !== 'boolean') return;
        if (typeof message !== 'undefined' && typeof message !== 'string') return;
        this.python.passed = typeof passed === 'boolean' ? passed : (score === this.python.maxScore);
        if (message !== undefined) {
          message = H5P.jQuery('div').text(message).html();
        }
        this.python.setFeedback(message, score, this.params.maxScore);
      },
      /**
       * Return the outputed values by the program.
       * @returns {String}
       */
      getOutput: () => {
        return Sk.ffi.remapToPy(this.userOutput);
      },
      /**
       * Display a message in the output.
       * @param {string} message The message to display
       * @param {string} [type] Optionnal style to add to the text
       */
      output: (message, type) => {
        message = Sk.ffi.remapToJs(message);
        type = Sk.ffi.remapToJs(type);
        if (typeof message !== 'string') return;
        if (typeof type !== 'undefined' && typeof type !== 'string') return;
        let types = {
          'error': 'CodeMirror-python-highlighted-error-line',
          'red': 'CodeMirror-python-highlighted-error-line',
          'success': 'CodeMirror-python-highlighted-success-line',
          'green': 'CodeMirror-python-highlighted-success-line',
          'info': 'CodeMirror-python-highlighted-info-line',
          'blue': 'CodeMirror-python-highlighted-info-line',
          'alert': 'CodeMirror-python-highlighted-alert-line',
          'yellow': 'CodeMirror-python-highlighted-alert-line',
          'note': 'CodeMirror-python-highlighted-note-line',
          'white': 'CodeMirror-python-highlighted-note-line',
          'cyan': 'CodeMirror-python-highlighted-cyan-line',
          'purple': 'CodeMirror-python-highlighted-purple-line'
        };
        // eslint-disable-next-line no-prototype-builtins
        if (!types.hasOwnProperty(type)) {
          type = undefined;
        }
        else {
          type = types[type];
        }
        CodeMirror.H5P.appendLines(this.output, message, type);
      },
      /**
       * Set some data that can be retrieve between multiples executions of the same check.
       * @param {string} name 
       * @param {number|string} data 
       */
      setData: (name, data) => {
        name = Sk.ffi.remapToJs(name);
        data = Sk.ffi.remapToJs(data);
        if (typeof name !== 'string') return;
        if (typeof data !== 'number' && typeof data !== 'string') return;
        this.apiData[name] = data;
      },
      /**
       * Return a previously stored value during an execution of the same check.
       * @param {string} name 
       * @returns {string} 
       */
      getData: (name) => {
        return Sk.ffi.remapToPy(this.apiData[name]);
      },
      /**
       * Dispatch an event to parent (or parent of parent) window.
       * Event can be listened with :
       *    window.removeEventListener('message', function() {
       *      if (event.data && event.data.context === 'h5p' && event.data.action === 'H5P.Python.nameExample') {
       *        console.log(event.data.value);
       *      }
       *    });
       * @param {string} [name] 
       * @param {Object} [data] 
       * @returns 
       * 
       */
      trigger: (name, data) => {
        name = Sk.ffi.remapToJs(name);
        data = Sk.ffi.remapToJs(data);
        if (typeof name !== 'undefined' && typeof name !== 'string') return;
        name = name !== undefined ? 'H5P.Python.' + name : 'H5P.Python';
        let messageData = {
          context: 'h5p',
          action: name,
          value: data
        };
        if (typeof this.triggerMode === 'undefined' || this.triggerMode === 1) window.parent.postMessage(messageData, '*');
        if (this.triggerMode === 2) window.parent.parent.postMessage(messageData, '*');
      },
      /**
       * Select how event should be dispatched
       * @param {number} mode 
       *    1 : send message to parent
       *    2 : send message to parent of parent (mode for moodle with h5p core integration)
       */
      triggerMode: (mode) => {
        mode = Sk.ffi.remapToJs(mode);
        if (typeof mode !== 'number') return;
        this.triggerMode = mode;
      },
      /**
       * Dispatch an event to parent (or parent of parent) window and await an answer.
       * Event can be listened and replied with :
       *    window.addEventListener('message', function() {
       *      if (event.data && event.data.context === 'h5p' && event.data.action === 'H5P.Python.nameExample') {
       *        event.source.postMessage({
       *          context: 'h5p',
       *          action: 'H5P.Python.query',
       *          value: 'returnValueExample'
       *        }, event.origin);
       *      }
       *    });
       * @param {string} [name] 
       * @param {Object} [data] 
       * @returns 
       */
      query: (name, data) => {
        if (typeof Sk.ffi.remapToJs(name) !== 'undefined' && typeof Sk.ffi.remapToJs(name) !== 'string') return;
        return new Sk.misceval.promiseToSuspension(new Promise((resolve, reject) => {
          this.currentRejectPromise = reject;
          let queryListener = function (event) {
            if (event.data && event.data.context === 'h5p' && event.data.action === 'H5P.Python.query') {
              window.removeEventListener('message', queryListener);
              resolve(event.data.value);
            }
          };
          window.addEventListener('message', queryListener);
          this.apis.trigger(name, data);
        }).then((r) => Sk.ffi.remapToPy(r)));
      }
    };
    Object.entries(this.apis).forEach(([n, v]) => {
      Sk.builtins['h5p_' + n + '_' + this.randomApiKey] = v;
    });
  }

  /**
   * Add python code to the passed code in parameter to give it access to the api methods.
   * The code is also executed in it's own context to prevent unwanted scope issues.
   * @param {string} code 
   * @returns {string}
   */
  injectApi(code) {
    let injectedCode = 'def h5p_loader() :\n';

    let indentedCode = '';
    Object.keys(this.apis).forEach(n => {
      indentedCode += 'h5p_' + n + ' = h5p_' + n + '_' + this.randomApiKey + '\n';
    });
    indentedCode += code;
    indentedCode = indentedCode.split('\n').map(x => '\t' + x).join('\n') + '\n';

    injectedCode += indentedCode;
    injectedCode += 'h5p_loader()\n';
    injectedCode += 'del h5p_loader\n';

    return injectedCode;
  }

  /**
   * Adds run, stop, check-answer, show-solution, hide-solution, try again and reset buttons
   */
  addButtons() {
    this.python.addButton('run', this.params.l10n.run, () => {
      this.run();
    });

    this.python.addButton('stop', this.params.l10n.stop, () => {
      this.stop();
    }, false);

    this.python.addButton('check-answer', this.params.l10n.checkAnswer, () => {
      this.checkAnswer();
    }, !this.params.requireRunBeforeCheck, {}, {});

    this.python.addButton('show-solution', this.params.l10n.showSolution, () => {
      this.showSolution();
    }, false, {}, {});

    this.python.addButton('hide-solution', this.params.l10n.hideSolution, () => {
      this.hideSolution();
    }, false, {}, {});

    this.python.addButton('try-again', this.params.l10n.tryAgain, () => {
      this.python.removeFeedback();
      this.editor.setOption('readOnly', false);
      this.python.showButton('run');
      this.python.showButton('check-answer');
      this.python.hideButton('show-solution');
      this.python.hideButton('try-again');
      this.python.trigger('resize');
    }, false, {}, {});

    this.python.addButton('reset', this.params.l10n.reset, () => {
      this.python.resetTask();
    }, true, {}, {
      confirmationDialog: {
        enable: true,
        instance: this.python,
        l10n: {}
      }
    });
  }

  /**
   * Return the DOM for this class.
   *
   * @return {HTMLElement} DOM for this class.
   */
  getDOM() {
    return this.content;
  }

}
