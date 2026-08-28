/* docuservice runtime: theme toggle, sidebar, code copy, TOC highlight, search. */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------- colour scheme ---------- */

  function currentScheme() {
    var explicit = root.getAttribute('data-color-scheme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  var toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentScheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-color-scheme', next);
      try {
        localStorage.setItem('docuservice-theme', next);
      } catch (error) {
        /* private mode: the choice just does not persist */
      }
    });
  }

  /* ---------- sidebar ---------- */

  var sidebarToggle = document.querySelector('.sidebar-toggle');
  var sidebar = document.getElementById('sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', function () {
      var open = sidebar.classList.toggle('open');
      sidebarToggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ---------- copy buttons ---------- */

  document.querySelectorAll('.copy-button').forEach(function (button) {
    button.addEventListener('click', function () {
      var block = button.closest('.code-block');
      var code = block && block.querySelector('code');
      if (!code || !navigator.clipboard) return;
      navigator.clipboard.writeText(code.innerText).then(function () {
        button.textContent = 'Copied';
        setTimeout(function () {
          button.textContent = 'Copy';
        }, 1500);
      });
    });
  });

  /* ---------- table of contents highlight ---------- */

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var byId = {};
    tocLinks.forEach(function (link) {
      byId[link.getAttribute('href').slice(1)] = link;
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var link = byId[entry.target.id];
          if (!link) return;
          if (entry.isIntersecting) {
            tocLinks.forEach(function (other) {
              other.classList.remove('active');
            });
            link.classList.add('active');
          }
        });
      },
      { rootMargin: '-72px 0px -70% 0px', threshold: 0 },
    );

    Object.keys(byId).forEach(function (id) {
      var heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    });
  }

  /* ---------- search ---------- */

  var overlay = document.querySelector('[data-search-overlay]');
  var input = document.querySelector('[data-search-input]');
  var results = document.querySelector('[data-search-results]');
  var empty = document.querySelector('[data-search-empty]');
  if (!overlay || !input || !results) return;

  var index = null;
  var loading = null;
  var activeIndex = -1;

  function loadIndex() {
    if (index) return Promise.resolve(index);
    if (loading) return loading;
    loading = fetch(window.__DOCUSERVICE_SEARCH__ || '/search-index.json')
      .then(function (response) {
        if (!response.ok) throw new Error('search index unavailable');
        return response.json();
      })
      .then(function (docs) {
        index = docs;
        return docs;
      })
      .catch(function (error) {
        console.warn('Search is unavailable.', error);
        index = [];
        return index;
      });
    return loading;
  }

  function openSearch() {
    overlay.hidden = false;
    input.value = '';
    render([]);
    input.focus();
    loadIndex();
  }

  function closeSearch() {
    overlay.hidden = true;
    activeIndex = -1;
  }

  /** Score = every term must appear; title and section hits outweigh body hits. */
  function search(query) {
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length || !index) return [];

    return index
      .map(function (doc) {
        var haystack = (doc.title + ' ' + doc.section + ' ' + doc.text).toLowerCase();
        var score = 0;
        for (var i = 0; i < terms.length; i += 1) {
          if (haystack.indexOf(terms[i]) === -1) return null;
          if (doc.title.toLowerCase().indexOf(terms[i]) !== -1) score += 8;
          if (doc.section.toLowerCase().indexOf(terms[i]) !== -1) score += 5;
          score += 1;
        }
        return { doc: doc, score: score };
      })
      .filter(Boolean)
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 20)
      .map(function (hit) {
        return hit.doc;
      });
  }

  function excerpt(text, query) {
    var term = query.toLowerCase().split(/\s+/).filter(Boolean)[0] || '';
    var at = text.toLowerCase().indexOf(term);
    var start = at > 40 ? at - 40 : 0;
    return (start > 0 ? '…' : '') + text.slice(start, start + 140);
  }

  function render(docs, query) {
    results.innerHTML = '';
    activeIndex = docs.length ? 0 : -1;

    docs.forEach(function (doc, i) {
      var li = document.createElement('li');
      if (i === 0) li.className = 'active';
      var link = document.createElement('a');
      link.href = doc.url;

      var title = document.createElement('strong');
      title.textContent = doc.section ? doc.title + ' › ' + doc.section : doc.title;
      var snippet = document.createElement('small');
      snippet.textContent = excerpt(doc.text, query || '');

      link.appendChild(title);
      link.appendChild(snippet);
      li.appendChild(link);
      results.appendChild(li);
    });

    if (empty) empty.hidden = !(query && docs.length === 0);
  }

  function move(delta) {
    var items = results.querySelectorAll('li');
    if (!items.length) return;
    if (activeIndex >= 0) items[activeIndex].classList.remove('active');
    activeIndex = (activeIndex + delta + items.length) % items.length;
    items[activeIndex].classList.add('active');
    items[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  document.querySelectorAll('[data-search-open]').forEach(function (button) {
    button.addEventListener('click', openSearch);
  });

  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) closeSearch();
  });

  input.addEventListener('input', function () {
    var query = input.value.trim();
    loadIndex().then(function () {
      render(query ? search(query) : [], query);
    });
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'Enter') {
      var items = results.querySelectorAll('li');
      if (activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        items[activeIndex].querySelector('a').click();
      }
    }
  });

  document.addEventListener('keydown', function (event) {
    var typingElsewhere = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);

    if (event.key === 'Escape' && !overlay.hidden) {
      closeSearch();
      return;
    }
    if (typingElsewhere) return;
    if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key === 'k')) {
      event.preventDefault();
      openSearch();
    }
  });
})();
