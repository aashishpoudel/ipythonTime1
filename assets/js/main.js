
function toggleMenu(){
  const nav = document.querySelector('header nav');
  nav.classList.toggle('open');
}
document.getElementById('year').textContent = new Date().getFullYear();
