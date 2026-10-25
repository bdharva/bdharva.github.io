// Shared behavior for apps hosted on the site (see APPS.md). Plain script, no dependencies.
// The theme class itself is set by the inline snippet in each app's <head> (no flash);
// this file wires up the controls.
//
//   <input type="checkbox" data-theme-toggle>      dark-mode switch (site-wide 'darkMode' key)
//   <button data-open-modal="info-dialog">          opens <dialog id="info-dialog">
//   <button data-close-modal>                       closes the enclosing dialog
//   window.appToast('Link copied')                  shows the .toast element (created on demand)

(function () {
	var root = document.documentElement;

	function setDark(on) {
		root.classList.toggle('dark', on);
		try { localStorage.setItem('darkMode', on ? 'true' : 'false'); } catch (e) {}
		document.querySelectorAll('[data-theme-toggle]').forEach(function (el) { el.checked = on; });
		document.dispatchEvent(new CustomEvent('themechange', { detail: { dark: on } }));
	}

	function init() {
		document.querySelectorAll('[data-theme-toggle]').forEach(function (el) {
			el.checked = root.classList.contains('dark');
			el.addEventListener('change', function () { setDark(el.checked); });
		});

		document.addEventListener('click', function (event) {
			var opener = event.target.closest('[data-open-modal]');
			if (opener) {
				var dialog = document.getElementById(opener.getAttribute('data-open-modal'));
				if (dialog && !dialog.open) dialog.showModal();
				return;
			}
			if (event.target.closest('[data-close-modal]')) {
				var open = event.target.closest('dialog');
				if (open) open.close();
				return;
			}
			// Click on the backdrop closes an .app-modal.
			if (event.target.matches('dialog.app-modal[open]')) event.target.close();
		});
	}

	var toastTimer;
	window.appToast = function (message) {
		var el = document.querySelector('.toast');
		if (!el) {
			el = document.createElement('div');
			el.className = 'toast';
			el.setAttribute('role', 'status');
			document.body.appendChild(el);
		}
		el.textContent = message;
		el.classList.add('is-visible');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 2400);
	};
	window.appSetDark = setDark;

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
