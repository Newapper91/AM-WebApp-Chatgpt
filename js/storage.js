/**
 * storage.js
 * -----------
 * Persists every form input to localStorage so the calculator remembers
 * your numbers between visits — handy when it's installed as a home-screen
 * app on a phone and reopened later. Everything stays on-device; nothing
 * is sent anywhere.
 */

const AppStorage = {
  KEY: 'mortgageCalc.state.v1',

  /** Save the current value of every labeled input/select on the page. */
  save() {
    const data = { fields: {}, radios: {} };

    document.querySelectorAll('input[id], select[id]').forEach((el) => {
      if (el.type === 'checkbox') {
        data.fields[el.id] = el.checked;
      } else if (el.type !== 'radio') {
        data.fields[el.id] = el.value;
      }
    });

    document.querySelectorAll('input[type="radio"][name]').forEach((el) => {
      if (el.checked) data.radios[el.name] = el.value;
    });

    try {
      localStorage.setItem(this.KEY, JSON.stringify(data));
    } catch (e) {
      // localStorage unavailable (e.g. private browsing) — fail silently.
    }
  },

  /** Restore previously-saved values. Returns true if anything was restored. */
  load() {
    let data;
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return false;
      data = JSON.parse(raw);
    } catch (e) {
      return false;
    }

    Object.entries(data.fields || {}).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!value;
      } else {
        el.value = value;
      }
    });

    Object.entries(data.radios || {}).forEach(([name, value]) => {
      document.querySelectorAll(`input[type="radio"][name="${name}"]`).forEach((radio) => {
        radio.checked = radio.value === value;
      });
    });

    return true;
  },

  /** Erase all saved values (used by the "Reset to defaults" control). */
  clear() {
    try {
      localStorage.removeItem(this.KEY);
    } catch (e) {
      // ignore
    }
  },
};

window.AppStorage = AppStorage;
