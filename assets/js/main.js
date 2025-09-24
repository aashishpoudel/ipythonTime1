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
    initialCountry: "us",          // default to United States
    preferredCountries: ["us"],    // keep US at the top
    separateDialCode: true,
    utilsScript: undefined
  });

  // Helper: ISO alpha-2 -> flag emoji (🇺🇸 🇮🇳 etc.)
  function isoToFlag(iso2) {
    return iso2
      .toUpperCase()
      .replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt()));
  }

  // 2) Populate Country <select> using the same data as the phone widget
  const allCountries = window.intlTelInputGlobals.getCountryData();
  allCountries.sort((a, b) => a.name.localeCompare(b.name));

  countrySelect.innerHTML = '';
  for (const c of allCountries) {
    const opt = document.createElement('option');
    opt.value = c.iso2;
    opt.textContent = `${isoToFlag(c.iso2)} ${c.name}`;
    countrySelect.appendChild(opt);
  }

  // Force default selection to United States
  countrySelect.value = "us";

  // 3) Keep them in sync
  countrySelect.addEventListener('change', () => {
    iti.setCountry(countrySelect.value);
  });

  phoneInput.addEventListener('countrychange', () => {
    const data = iti.getSelectedCountryData();
    countrySelect.value = data.iso2;

    const isoEl = document.getElementById('phone_country_iso');
    const dialEl = document.getElementById('phone_dial_code');
    if (isoEl) isoEl.value = data.iso2;
    if (dialEl) dialEl.value = `+${data.dialCode}`;
  });

  // 4) On first load, set hidden fields too
  const data = iti.getSelectedCountryData();
  const isoEl = document.getElementById('phone_country_iso');
  const dialEl = document.getElementById('phone_dial_code');
  if (isoEl) isoEl.value = data.iso2;
  if (dialEl) dialEl.value = `+${data.dialCode}`;
})();

(function () {
  const form = document.getElementById('signupForm');
  if (!form) return;
  const msg  = document.getElementById('formMsg');
  // --- Parent Name enable/disable based on "Who is learning?" ---
    const whoSel = document.getElementById('whoislearning') || form.querySelector('select[name="whoislearning"]');
    const parentInput = form.querySelector('input[name="parent_name"]');

    function syncParentName() {
      if (!whoSel || !parentInput) return;
      // If some scripts clear the value, force default to 'child'
      if (!whoSel.value) whoSel.value = 'child';

      if (whoSel.value === 'child') {
        parentInput.disabled = false;
        parentInput.placeholder = 'Parent name';
      } else {
        parentInput.value = '';
        parentInput.disabled = true;
        parentInput.placeholder = '— Not applicable —';
      }
    }

    // Run once as soon as we can
    syncParentName();

    // Re-run on changes
    whoSel?.addEventListener('change', syncParentName);

    // Also re-run when DOM is ready (catches late mutations)
    document.addEventListener('DOMContentLoaded', syncParentName);

    // If some script replaces the <select>, re-wire the handler
    new MutationObserver(() => {
      const latest = document.getElementById('whoislearning') || form.querySelector('select[name="whoislearning"]');
      if (latest && latest !== whoSel) {
        latest.addEventListener('change', syncParentName);
        syncParentName();
      }
    }).observe(form, { childList: true, subtree: true });


  // Auto-detect IANA timezone
  document.addEventListener('DOMContentLoaded', () => {
    const tzEl = document.getElementById('timezone');
    if (tzEl && !tzEl.value) {
      try { tzEl.value = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; }
      catch { tzEl.value = ""; }
    }
  });

  const API_URL = "https://ipythontime-signup-api.ipythontime.workers.dev/api/submit";

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate Full Name
    const nameField = form.name;
    if (!nameField.value.trim()) {
      if (msg) msg.textContent = 'Full Name is required.';
      nameField.focus();
      return;
    }

    if (msg) msg.textContent = 'Submitting…';

    const countrySel = document.getElementById('country');
    const stateSel   = document.getElementById('state');
    const payload = {
      who_is_learning: form.whoislearning?.value || null,
      student_name:    form.name?.value || null,
      student_dob:     form.dob?.value || null,
      parent_name: (whoSel?.value === 'child' && parentInput?.value.trim())
      ? parentInput.value.trim()
      : null,
      email:           form.email?.value || null,
      phone:           form.phone?.value || null,
      phone_country_iso: document.getElementById('phone_country_iso')?.value || null,
      phone_dial_code:   document.getElementById('phone_dial_code')?.value || null,
      country_iso:       countrySel?.value || null,
      country_label:     countrySel?.selectedOptions?.[0]?.textContent || null,
      state:        stateSel?.value || null,
      state_label:  stateSel?.selectedOptions?.[0]?.textContent || null,
      city:            form.city?.value || null,
      timezone:        form.timezone?.value || null,
      goal: [
        form.goal?.value ? `${form.goal.value}` : null,
      ].filter(Boolean).join(' | '),
      comment: (form.comment?.value?.trim?.() || null),
    };

    // Collect multi-select Preferred Time → comma string
    const ptEl   = document.getElementById('preferred_time');
    const times  = Array.from(ptEl?.selectedOptions || []).map(o => o.value);
    const ptJoin = times.join(',');

    // add to payload
    payload.preferred_time = ptJoin;

    try {
      const res  = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));

      console.log("[frontend] API response", data);

      if (res.ok && data.ok) {
        const hasFlags =
          Object.prototype.hasOwnProperty.call(data, "email_user_sent") ||
          Object.prototype.hasOwnProperty.call(data, "email_admin_sent");

        const anyEmailSent = hasFlags
          ? !!(data.email_user_sent || data.email_admin_sent)
          : null;

        if (anyEmailSent === true) {
          if (msg) msg.textContent = 'Thanks! We received your request and sent a confirmation email.';
        } else if (anyEmailSent === false) {
          if (msg) msg.textContent = 'Thanks! We received your request. (Email did not send yet.)';
          console.warn("[frontend] email errors", {
            user: data.email_user_error,
            admin: data.email_admin_error
          });
        } else {
          if (msg) msg.textContent = 'Thanks! We received your request. We’ll contact you shortly.';
        }

        form.reset();
      } else {
        if (msg) msg.textContent = 'Sorry—something went wrong. Please try again.';
        console.error('[frontend] Submit error:', data);
      }
    } catch (err) {
      if (msg) msg.textContent = 'Network error—please try again.';
      console.error(err);
    }
  });
})();

// ---- Timezone from Country / (optional) State ----
(function () {
  const countryEl = document.getElementById('country');   // <select id="country">
  const stateEl   = document.getElementById('state');     // <select id="state"> (optional)
  const tzEl      = document.getElementById('timezone');  // <input type="hidden" id="timezone">
  const form      = document.getElementById('signupForm');

  if (!countryEl || !tzEl) return;

  // Geocode helper (Nominatim / OpenStreetMap)
  async function geocode(query) {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('addressdetails', '1');
    const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('geocode failed');
    const arr = await res.json();
    return arr[0] || null;
  }

  function setTimezone(zone) {
    if (tzEl) tzEl.value = zone || '';
  }

  function selectedCountryLabel() {
    // Your <select id="country"> is populated with ISO2 values; text may include a flag.
    // Get the visible name and strip leading emoji if present.
    const raw = countryEl.selectedOptions?.[0]?.textContent || countryEl.value || '';
    return raw.replace(/^\p{Emoji_Presentation}|\p{Emoji}\uFE0F?\s*/gu, '').trim();
  }

  async function recomputeTimezone() {
    const countryISO  = (countryEl.value || '').toUpperCase();
    const countryName = selectedCountryLabel();
    const stateName   = (stateEl && stateEl.value ? stateEl.value.trim() : '');

    try {
      // If state/province present → geocode "state, country" → tz from lat/lon
      if (stateName) {
        const place = await geocode(`${stateName}, ${countryName}`);
        if (place) {
          const zone = tzlookup(parseFloat(place.lat), parseFloat(place.lon));
          setTimezone(zone);
          return;
        }
      }

      // Otherwise country-only: try centroid → tz
      const countryPlace = await geocode(countryName);
      if (countryPlace) {
        const zone = tzlookup(parseFloat(countryPlace.lat), parseFloat(countryPlace.lon));
        setTimezone(zone);
        return;
      }

      // Last-resort list-based fallback: first time zone known for the ISO2
      if (window.ct && countryISO) {
        const zones = ct.getTimezonesForCountry(countryISO) || [];
        if (zones.length) {
          setTimezone(zones[0].aliasOf || zones[0].name);
          return;
        }
      }

      // If all else fails, leave the browser guess (set earlier in your file)
    } catch (err) {
      console.warn('[timezone] fallback to browser time zone:', err);
    }
  }

  // Recompute whenever the user changes country/state
  countryEl.addEventListener('change', recomputeTimezone);
  stateEl?.addEventListener('change', recomputeTimezone);

  // Recompute on first paint (after your initial Intl guess)
  document.addEventListener('DOMContentLoaded', recomputeTimezone);

  // Ensure a computed zone right before submit; if empty, compute and then submit
  form?.addEventListener('submit', (e) => {
    if (!tzEl.value) {
      e.preventDefault();
      recomputeTimezone().then(() => form.submit());
    }
  });
})();

// --- measure header + sticky band heights for correct offsets ---
(function(){
  const root   = document.documentElement;
  const header = document.querySelector('.site-header');
  const band   = document.getElementById('sticky-band');

  if (!header || !band) return;

  function setVars(){
    root.style.setProperty('--header-h', header.offsetHeight + 'px');
    root.style.setProperty('--sticky-h', band.offsetHeight   + 'px');
  }

  // set now and on resize (and after fonts/layout settle)
  setVars();
  window.addEventListener('resize', setVars);
  window.addEventListener('load', setVars);
})();

(function(){
  const root = document.documentElement;
  const grid = document.querySelector('.page-grid');
  const toc  = document.querySelector('.page-grid > .toc');
  if (!grid || !toc) return;

  function setTocLeft(){
    const rect = grid.getBoundingClientRect();
    root.style.setProperty('--toc-left', rect.left + 'px');
  }

  setTocLeft();
  window.addEventListener('resize', setTocLeft);
  window.addEventListener('load', setTocLeft);
})();

(function () {
  const form = document.getElementById('signupForm');
  if (!form) return;

  const nameEl = form.elements['name'];
  const dobEl  = form.elements['dob'];
  const msgEl  = document.getElementById('age_policy_message');
  const yearsEl= document.getElementById('age_years');
  const noteEl = document.getElementById('age_notice');

  function computeAgeYears(iso) {
    if (!iso) return NaN;
    const dob = new Date(iso);
    if (isNaN(dob)) return NaN;
    const today = new Date();
    let y = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) y--;
    return y;
  }

  function buildAgeMessage(name, years) {
    // Spec (interpreted with safe edges): <5 => (a), 5–6 => (b), >=7 => (c)
    if (Number.isNaN(years)) return '';
    if (years < 5) {
      return `${name} is too young for iPythonTime class. Sorry for that.`;
    } else if (years < 7) {
      return `${name} age is <7 (ideal minimum age). We will keep your child in record and contact you later.`;
    } else {
      // For >=7 keep your regular success message as-is; we still send age + empty policy message.
      return '';
    }
  }

  function updateAgeFieldsAndNotice() {
    const years = computeAgeYears(dobEl?.value);
    const studentName = (nameEl?.value || 'Student').trim() || 'Student';

    // Fill hidden fields so your backend email includes them
    if (yearsEl) yearsEl.value = Number.isNaN(years) ? '' : String(years);
    const policyMsg = buildAgeMessage(studentName, years);
    if (msgEl) msgEl.value = policyMsg;

    // Show/hide on-page note
    if (noteEl) {
      if (policyMsg) {
        noteEl.textContent = policyMsg;
        noteEl.style.display = 'block';
      } else {
        noteEl.textContent = '';
        noteEl.style.display = 'none';
      }
    }
  }

  // Keep message live as user fills in the form
  if (dobEl) dobEl.addEventListener('change', updateAgeFieldsAndNotice);
  if (nameEl) nameEl.addEventListener('input', updateAgeFieldsAndNotice);

  // Ensure values are set before submit (so email gets the message)
  form.addEventListener('submit', function () {
    updateAgeFieldsAndNotice();
    // We are NOT blocking submission; this just augments payload + shows the note.
    // If you ever want to block for <5, you could preventDefault() here when years < 5.
  });

  // Initialize once (covers prefilled DOB)
  updateAgeFieldsAndNotice();
})();