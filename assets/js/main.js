
function toggleMenu() {
  const drawer = document.getElementById('drawer');
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

// ---- Country & Phone with flags + dial codes ----
(function () {
  const countrySelect = document.getElementById('country');
  const phoneInput = document.getElementById('phone');
  if (!countrySelect || !phoneInput || !window.intlTelInput) return;

  // 1) Init phone input (flag + dial code)
  const iti = window.intlTelInput(phoneInput, {
    initialCountry: "us",          // pick whatever default you prefer
    separateDialCode: true,        // shows “+1” separate from the number
    utilsScript: undefined         // already loaded via separate <script>
  });

  // Helper: ISO alpha-2 -> flag emoji (🇺🇸 🇮🇳 etc.)
  function isoToFlag(iso2) {
    return iso2
      .toUpperCase()
      .replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt()));
  }

  // 2) Populate Country <select> using the same data as the phone widget
  //    This guarantees a full list with consistent names and ISO codes.
  const allCountries = window.intlTelInputGlobals.getCountryData();
  // Sort by name for a nice UX
  allCountries.sort((a, b) => a.name.localeCompare(b.name));

  // Build options (e.g., "🇺🇸 United States")
  countrySelect.innerHTML = '';
  for (const c of allCountries) {
    const opt = document.createElement('option');
    opt.value = c.iso2; // store ISO (e.g., "us")
    opt.textContent = `${isoToFlag(c.iso2)} ${c.name}`;
    countrySelect.appendChild(opt);
  }

  // Set select to match the phone’s initial country
  countrySelect.value = iti.getSelectedCountryData().iso2;

  // 3) Keep them in sync (Country <-> Phone)
  // When Country changes, update phone widget country
  countrySelect.addEventListener('change', () => {
    iti.setCountry(countrySelect.value);
  });

  // When phone widget country changes (via its own dropdown), update Country select
  phoneInput.addEventListener('countrychange', () => {
    const data = iti.getSelectedCountryData();
    countrySelect.value = data.iso2;

    // Optional hidden fields if you want these on submit:
    const isoEl = document.getElementById('phone_country_iso');
    const dialEl = document.getElementById('phone_dial_code');
    if (isoEl) isoEl.value = data.iso2;          // e.g., "us"
    if (dialEl) dialEl.value = `+${data.dialCode}`; // e.g., "+1"
  });

  // 4) On first load, set hidden fields too (if present)
  const data = iti.getSelectedCountryData();
  const isoEl = document.getElementById('phone_country_iso');
  const dialEl = document.getElementById('phone_dial_code');
  if (isoEl) isoEl.value = data.iso2;
  if (dialEl) dialEl.value = `+${data.dialCode}`;
})();

(function () {
  const form = document.getElementById('signupForm');
  const msg  = document.getElementById('formMsg');
  if (!form) return;

  // TODO: replace with your real Workers URL:
  const API_URL = "https://ipythontime-signup-api.ipythontime.workers.dev/api/submit";  // ← put YOUR workers.dev URL

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // ✅ Custom validation for Full Name
    const nameField = form.name;
    if (!nameField.value.trim()) {
        if (msg) msg.textContent = 'Full Name is required.';
        nameField.focus();
        return; // stop here, don’t submit
    }

    if (msg) msg.textContent = 'Submitting…';

    const countrySel = document.getElementById('country');
    const payload = {
      who_is_learning: form.whoislearning?.value || null,
      student_name:    form.name?.value || null,
      student_dob:     form.dob?.value || null,
      parent_name:     null,
      email:           form.email?.value || null,
      phone:           form.phone?.value || null,
      phone_country_iso: document.getElementById('phone_country_iso')?.value || null,
      phone_dial_code:   document.getElementById('phone_dial_code')?.value || null,
      country_iso:       countrySel?.value || null,
      country_label:     countrySel?.selectedOptions?.[0]?.textContent || null,
      message: [
        form.city?.value ? `City: ${form.city.value}` : null,
        form.preferred_time?.value ? `Preferred time: ${form.preferred_time.value}` : null,
        form.learning_goal?.value ? `Goal: ${form.learning_goal.value}` : null,
      ].filter(Boolean).join(' | ')
    };

    try {
      const res  = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        if (msg) msg.textContent = 'Thanks! We received your request.';
        form.reset();
      } else {
        if (msg) msg.textContent = 'Sorry—something went wrong. Please try again.';
        console.error('Submit error:', data);
      }
    } catch (err) {
      if (msg) msg.textContent = 'Network error—please try again.';
      console.error(err);
    }
  });
})();
