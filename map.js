 mapboxgl.accessToken = 'pk.eyJ1IjoiYmxpc3Nib3k5MCIsImEiOiJjbWxsYWM2aGwwNWlxM2xxd2R5d2V3YXdsIn0.eNYOUNsktQNE11kCYHyXpA';

    const map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [0, 0],
      zoom: 7
    });

    map.on('load', () => map.resize());
    window.addEventListener('resize', () => map.resize());
    setTimeout(() => map.resize(), 800);

    let ipMarker = null;
    let placeMarker = null;
    let liveMarker = null;
    let watchId = null;

    // ────────────────────────────────────────────────
    // IP Lookup
    // ────────────────────────────────────────────────
    async function lookupIP(ip = '') {
      const loading = document.getElementById('loading');
      const errorEl = document.getElementById('error');
      const resultCard = document.getElementById('result-card');

      loading.classList.remove('hidden');
      errorEl.classList.add('hidden');
      resultCard.classList.add('hidden');

      try {
        let url = 'https://ipapi.co/json';
        if (ip.trim()) url = 'https://ipapi.co/' + ip.trim() + '/json';

        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);

        const data = await res.json();
        if (data.error) throw new Error(data.reason || 'Failed');

        document.getElementById('ip-value').textContent = data.ip || data.query || '—';
        document.getElementById('location-value').textContent = 
          [data.city, data.region, data.country_name, data.postal].filter(Boolean).join(', ') || '—';
        document.getElementById('timezone-value').textContent = data.timezone || '—';
        document.getElementById('isp-value').textContent = data.org || data.asn || '—';

        const lng = data.longitude;
        const lat = data.latitude;

        if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
          map.flyTo({ center: [lng, lat], zoom: data.city ? 13 : 8, essential: true });

          if (ipMarker) ipMarker.remove();
          ipMarker = new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<strong>IP Location</strong><br>${data.city || '—'}<br>${data.region || ''}, ${data.country_name || ''}<br><small>ISP: ${data.org || '—'}</small>`
            ))
            .addTo(map);
        }

        resultCard.classList.remove('hidden');
      } catch (err) {
        errorEl.textContent = err.message.includes('fetch') 
          ? 'Cannot reach geolocation service — check internet'
          : err.message;
        errorEl.classList.remove('hidden');
      } finally {
        loading.classList.add('hidden');
      }
    }

    // ────────────────────────────────────────────────
    // Place / City Search (using Mapbox Geocoding)
    // ────────────────────────────────────────────────
    async function searchPlace(placeName) {
      if (!placeName.trim()) return;

      const errorEl = document.getElementById('error');
      errorEl.classList.add('hidden');

      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(placeName)}.json?access_token=${mapboxgl.accessToken}&limit=1&country=ng`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Geocoding failed');

        const data = await res.json();
        if (!data.features || data.features.length === 0) {
          throw new Error('Place not found');
        }

        const [lng, lat] = data.features[0].center;
        const placeNameFormatted = data.features[0].place_name;

        map.flyTo({ center: [lng, lat], zoom: 13, essential: true });

        if (placeMarker) placeMarker.remove();
        placeMarker = new mapboxgl.Marker({ color: '#f59e0b' }) // orange marker
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(
            `<strong>${placeNameFormatted}</strong><br>Found via Mapbox Geocoding`
          ))
          .addTo(map)
          .togglePopup(); // open popup automatically

      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
      }
    }

    // ────────────────────────────────────────────────
    // Live GPS Tracking
    // ────────────────────────────────────────────────
    function startLiveTracking() {
      if (watchId) return;

      const btn = document.getElementById('live-btn');
      const status = document.getElementById('live-status');

      btn.textContent = 'Stop Precise Tracking';
      btn.classList.remove('bg-green-600', 'hover:bg-green-500');
      btn.classList.add('bg-red-600', 'hover:bg-red-500');
      status.classList.remove('hidden');

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lng = position.coords.longitude;
          const lat = position.coords.latitude;
          const acc = position.coords.accuracy;

          map.flyTo({ center: [lng, lat], zoom: 16, essential: true });

          if (liveMarker) liveMarker.remove();

          const el = document.createElement('div');
          el.className = 'pulse-dot w-10 h-10 bg-green-500 rounded-full border-4 border-white shadow-xl flex items-center justify-center';
          el.innerHTML = '<div class="w-5 h-5 bg-white rounded-full"></div>';

          liveMarker = new mapboxgl.Marker({ element: el })
            .setLngLat([lng, lat])
            .setPopup(new mapboxgl.Popup().setHTML(
              `<strong>Your Live Location</strong><br>Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}<br>Accuracy: ≈ ${Math.round(acc)} m`
            ))
            .addTo(map);
        },
        (error) => {
          let msg = 'Location access failed.';
          if (error.code === 1) msg = 'Permission denied — please allow location access.';
          alert(msg);
          stopLiveTracking();
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }

    function stopLiveTracking() {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      const btn = document.getElementById('live-btn');
      const status = document.getElementById('live-status');

      btn.textContent = 'Show Precise Live Location';
      btn.classList.remove('bg-red-600', 'hover:bg-red-500');
      btn.classList.add('bg-green-600', 'hover:bg-green-500');
      status.classList.add('hidden');

      if (liveMarker) {
        liveMarker.remove();
        liveMarker = null;
      }
    }

    // Event listeners
    document.getElementById('track-ip-btn').addEventListener('click', () => {
      lookupIP(document.getElementById('ip-input').value.trim());
    });

    document.getElementById('ip-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('track-ip-btn').click();
    });

    document.getElementById('search-place-btn').addEventListener('click', () => {
      searchPlace(document.getElementById('place-input').value.trim());
    });

    document.getElementById('place-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('search-place-btn').click();
    });

    document.getElementById('live-btn').addEventListener('click', () => {
      if (watchId) stopLiveTracking();
      else {
        if (!navigator.geolocation) {
          alert('Geolocation not supported in this browser.');
          return;
        }
        startLiveTracking();
      }
    });

    // Auto-load current IP on start
    lookupIP();