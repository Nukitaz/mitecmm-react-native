export const getInjectedJavaScript = (targetSvgId: string | null) => `
  (function() {
    var activeTargetId = "${targetSvgId || ''}";

    function applyHighlight() {
      if (!activeTargetId) return;
      var prevs = document.querySelectorAll('.resaltado-activo');
      for (var i = 0; i < prevs.length; i++) {
        prevs[i].classList.remove('resaltado-activo');
      }
      var el = document.getElementById(activeTargetId) || 
               document.getElementById(activeTargetId.toLowerCase()) || 
               document.getElementById(activeTargetId.toUpperCase());
      if (el) {
        el.classList.add('resaltado-activo');
      }
    }

    applyHighlight();
    window.addEventListener('resize', applyHighlight);
    document.addEventListener('touchstart', applyHighlight, { passive: true });
    document.addEventListener('touchend', applyHighlight, { passive: true });

    var isHandled = false;
    function processClick(e) {
      if (isHandled) return;
      var target = e.target;
      while (target && target !== document.body) {
        if (target.id) {
          isHandled = true;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AULA_CLICK',
            id: target.id
          }));
          setTimeout(function() { isHandled = false; }, 400);
          break;
        }
        target = target.parentElement;
      }
    }

    document.addEventListener('click', processClick);
  })();
  true;
`;