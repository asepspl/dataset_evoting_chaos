// Removes browser extension attributes (bis_skin_checked) that cause React hydration mismatches.
// This script runs immediately and observes DOM mutations to clean up injected attributes.
(function () {
  function cleanNode(node) {
    if (node.nodeType !== 1) return;
    if (node.hasAttribute('bis_skin_checked')) {
      node.removeAttribute('bis_skin_checked');
    }
    var children = node.querySelectorAll('[bis_skin_checked]');
    for (var i = 0; i < children.length; i++) {
      children[i].removeAttribute('bis_skin_checked');
    }
  }

  var observer = new MutationObserver(function (mutations) {
    for (var m = 0; m < mutations.length; m++) {
      var added = mutations[m].addedNodes;
      for (var n = 0; n < added.length; n++) {
        cleanNode(added[n]);
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
