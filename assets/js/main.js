(function(){
  // Ensure a single backdrop element exists
  function ensureBackdrop(){
    let bd = document.getElementById('drawer-backdrop');
    if (!bd){
      bd = document.createElement('div');
      bd.id = 'drawer-backdrop';
      bd.className = 'backdrop';
      document.body.appendChild(bd);
    }
    return bd;
  }

  // Toggle only the off-canvas drawer; do NOT touch the primary nav
  window.toggleMenu = function(){
    const drawer = document.getElementById('drawer');
    if (!drawer) return;
    const backdrop = ensureBackdrop();
    const isOpen = drawer.classList.toggle('open');
    document.body.classList.toggle('no-scroll', isOpen);
    backdrop.classList.toggle('show', isOpen);
  };

  // Close drawer on backdrop click or ESC
  document.addEventListener('click', (e)=>{
    const drawer = document.getElementById('drawer');
    const bd = document.getElementById('drawer-backdrop');
    if (!drawer) return;
    const isBackdrop = e.target && e.target.id === 'drawer-backdrop';
    if (isBackdrop){
      drawer.classList.remove('open');
      document.body.classList.remove('no-scroll');
      bd.classList.remove('show');
    }
  });
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape'){
      const drawer = document.getElementById('drawer');
      const bd = document.getElementById('drawer-backdrop');
      if (drawer && drawer.classList.contains('open')){
        drawer.classList.remove('open');
        document.body.classList.remove('no-scroll');
        if (bd) bd.classList.remove('show');
      }
    }
  });

  // Footer year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();
