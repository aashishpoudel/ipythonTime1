
function toggleMenu(){
  const headerNav = document.querySelector('header nav');
  const drawer = document.getElementById('drawer');
  if (headerNav) headerNav.classList.toggle('open');
  if (drawer) drawer.classList.toggle('open');
}
document.getElementById('year').textContent = new Date().getFullYear();


document.addEventListener('click', (e) => {
  const btn = e.target.closest('.menu');
  const drawer = document.getElementById('drawer');
  if (!drawer) return;
  if (btn) return; // toggle handled by button
  if (!drawer.contains(e.target)) drawer.classList.remove('open');
});
