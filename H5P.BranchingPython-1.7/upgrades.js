var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.BranchingPython'] = (function () {
  return {
    1: {
      /**
       * Asynchronous content upgrade hook.
       *
       * Add new default parameters.
       *
       * @param {Object} parameters
       * @param {function} finished
       */
      4: function (parameters, finished, extras) {
        // Sanitization
        parameters.branchingPython = parameters.branchingPython || {};
        parameters.branchingPython.content = parameters.branchingPython.content || [];
        parameters.branchingPython.behaviour = parameters.branchingPython.behaviour || {};

        // Set behvaior paramter for each content
        parameters.branchingPython.content.forEach( function (contentNode) {
          if (!contentNode.contentBehaviour) {
            contentNode.contentBehaviour = "useBehavioural";
          }
          if (!contentNode.forceContentFinished) {
            contentNode.forceContentFinished = "useBehavioural";
          }
        });

        // Global backwards navigation default value
        if (!parameters.branchingPython.behaviour.enableBackwardsNavigation) {
          parameters.branchingPython.behaviour.enableBackwardsNavigation = false;
        }

        if (!parameters.branchingPython.behaviour.forceContentFinished) {
          parameters.branchingPython.behaviour.forceContentFinished = false;
        }

        finished(null, parameters, extras);
      },
      5: function (parameters, finished, extras) {
        // Sanitization
        parameters.branchingPython = parameters.branchingPython || {};
        parameters.branchingPython.scoringOptionGroup = parameters.branchingPython.scoringOptionGroup || {};

        // Change from scoringOption to scoringGroup
        parameters.branchingPython.scoringOptionGroup.scoringOption = parameters.branchingPython.scoringOption || "no-score";
        delete  parameters.branchingPython.scoringOption;
        // Don't want to change behaviour of old content
        parameters.branchingPython.scoringOptionGroup.includeInteractionsScores = false;
        finished(null, parameters, extras);
      },
    }
  };
})();
