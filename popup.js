'use strict';

let tryToFocusOnInput = () => {
  let inputEls = Array.prototype.slice.call(
    document.querySelectorAll('input'));
  _.remove(inputEls, inputEl => inputEl.offsetParent === null);
  if (inputEls.length) inputEls[0].focus();
};

let getStashEl = el => el.closest('.stash');

// Moves focus to next/previous stash. Direction is 'up' or 'down'.
let moveFocus = (direction, event) => {
  let nextStash;
  if (document.activeElement instanceof Element) {
    let stash = getStashEl(document.activeElement);
    if (stash) {
      let next = stash[{
        up: 'previousElementSibling',
        down: 'nextElementSibling'
      }[direction]];
      if (next) {
        next.focus();
        event.preventDefault();
      }
      return;
    }
  }
  let first = document.getElementById('stash-list')[{
    up: 'lastElementChild',
    down: 'firstElementChild'
  }[direction]];
  if (first && first !== document.activeElement) {
    first.focus();
    event.preventDefault();
  }
};

let init = async function () {
  let [
    highlightedTabs,
    windowTabs,
    stashes,
    messages,
    originalStashName
  ] = await Promise.all([
    chrome.promise.tabs.query({ currentWindow: true, highlighted: true }),
    chrome.promise.tabs.query({ currentWindow: true }),
    getStashes(),
    getMessages(),
    getOriginalStashName()
  ]);

  let mode;
  if (windowTabs.length == 1) {
    mode = 'singleTab';
  } else {
    if (highlightedTabs.length > 1) {
      mode = 'selection';
    } else {
      mode = 'default';
    }
  }

  let stashNameTab;
  if (mode == 'singleTab' && originalStashName) {
    stashNameTab = originalStashName;
  } else {
    stashNameTab = highlightedTabs[0].title || '';
  }

  Vue.filter('tabs', numTabs => {
    return numTabs.toString() + (numTabs == 1 ? ' tab' : ' tabs');
  });

  Vue.filter('from-now', timestamp => {
    return moment(timestamp).fromNow();
  });

  let vm = new Vue({
    el: 'html',
    data: {
      mode: mode,
      highlightedTabsLenth: highlightedTabs.length,
      stashNameWindow: originalStashName,
      stashNameTab: stashNameTab,
      stathNameTabs: originalStashName,
      stashes: stashes,
      messages: messages,
      modifierKey: (navigator.platform.toLowerCase().indexOf('mac') >= 0) ?
        'Command' : 'Control',
      stashNamePlaceholder: stashNamePlaceholder,
      topUpTabsLabel: mode == 'selection' ?
        highlightedTabs.length.toString() + ' tabs' : 'current tab'
    },
    methods: {
      stashWindow: function () {
        saveStash(this.stashNameWindow, windowTabs,
          _.findIndex(windowTabs, { 'active': true }));
      },
      stashTab: function () {
        saveStash(this.stashNameTab, highlightedTabs, 0);
      },
      stashTabs: function () {
        saveStash(this.stathNameTabs, highlightedTabs,
          _.findIndex(highlightedTabs, { 'active': true }));
      },
      topUp: function (stashId) {
        topUp(stashId, highlightedTabs);
      },
      unstash: function (stashId, stash) {
        // Have to call the function in the background page because the popup
        // closes too early.
        chrome.extension.getBackgroundPage().unstash(stashId, stash,
          !this.messages.openStash);
        // For better visual transition.
        window.close();
      },
      deleteStash: deleteStash,
      gotIt: function () {
        setMessageRead('welcome');
        setTimeout(tryToFocusOnInput, 100);
      },
      isEmpty: _.isEmpty,
      handleFocus: function (event) {
        getStashEl(event.target).classList.add('focused');
      },
      handleBlur: function (event) {
        let stashOut = getStashEl(event.target);
        if (event.relatedTarget instanceof Element) {
          let stashIn = getStashEl(event.relatedTarget);
          if (stashIn === stashOut) return;
        }
        stashOut.classList.remove('focused');
      },
      up: function (event) {
        moveFocus('up', event);
      },
      down: function (event) {
        moveFocus('down', event);
      }
    },
    ready: function () {
      tryToFocusOnInput();
    }
  });

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    let [stashes, messages] = await Promise.all([getStashes(), getMessages()]);
    vm.stashes = stashes;
    vm.messages = messages;
  });

  // Workaround for https://bugs.chromium.org/p/chromium/issues/detail?id=307912
  setTimeout(() => {
    document.body.style.width = '421px';
  }, 200)
};

init();
