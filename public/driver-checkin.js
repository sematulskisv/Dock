'use strict';

const form = document.querySelector('#checkinForm');
const errorBox = document.querySelector('#formError');
const success = document.querySelector('#success');
const submit = document.querySelector('#submitBtn');

function messageFor(code) {
  if (code === 'validation_failed') return 'Įveskite vilkiko ir užsakymo numerį.';
  if (code === 'rate_limited') return 'Per daug bandymų. Pabandykite vėliau arba kreipkitės į sandėlį.';
  if (code === 'not_found') return 'Rezervacijos pagal šiuos duomenis nerasta. Patikrinkite numerius arba kreipkitės į sandėlį.';
  return 'Nepavyko užregistruoti atvykimo. Pabandykite dar kartą.';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  const truckPlate = document.querySelector('#truckPlate').value.trim();
  const reference = document.querySelector('#reference').value.trim();
  if (!truckPlate || !reference) {
    errorBox.textContent = messageFor('validation_failed');
    errorBox.hidden = false;
    return;
  }

  submit.disabled = true;
  try {
    const response = await fetch('/api/driver-checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ truckPlate, reference }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'server_error');

    form.hidden = true;
    success.hidden = false;
    if (data.result === 'already_checked_in') {
      success.innerHTML = '<strong>Atvykimas jau buvo užregistruotas.</strong><span>Laukite sandėlio darbuotojo nurodymų.</span>';
    }
  } catch (err) {
    errorBox.textContent = messageFor(err.message);
    errorBox.hidden = false;
  } finally {
    submit.disabled = false;
  }
});
