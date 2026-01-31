// Global variables
let map = null;
let marker = null;
let searchHistory = JSON.parse(localStorage.getItem('ipHistory')) || [];
let currentLocation = { lat: 0, lng: 0 };

// DOM Elements
const ipInput = document.getElementById('ipInput');
const trackBtn = document.getElementById('trackBtn');
const locateBtn = document.getElementById('locateBtn');
const ipField = document.getElementById('ipField');
const locationField = document.getElementById('locationField');
const countryField = document.getElementById('countryField');
const ispField = document.getElementById('ispField');
const timezoneField = document.getElementById('timezoneField');
const coordinatesField = document.getElementById('coordinatesField');
const mapCoordinates = document.getElementById('mapCoordinates');
const searchHistoryContainer = document.getElementById('searchHistory');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const resetViewBtn = document.getElementById('resetView');

// Initialize map
function initMap(lat = 0, lng = 0) {
  if (map) {
    map.remove();
  }
  
  map = L.map('map').setView([lat, lng], 13);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  
  // Update marker
  updateMarker(lat, lng);
  
  // Map controls
  zoomInBtn.addEventListener('click', () => map.zoomIn());
  zoomOutBtn.addEventListener('click', () => map.zoomOut());
  resetViewBtn.addEventListener('click', () => map.setView([lat, lng], 13));
}

// Update map marker
function updateMarker(lat, lng, ip = '') {
  if (marker) {
    map.removeLayer(marker);
  }
  
  // Custom icon
  const customIcon = L.divIcon({
    html: `<div class="custom-marker">
             <i class="fas fa-map-marker-alt"></i>
             ${ip ? `<div class="marker-ip">${ip}</div>` : ''}
           </div>`,
    className: 'custom-marker-container',
    iconSize: [40, 40],
    iconAnchor: [20, 40]
  });
  
  marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
  
  // Update coordinates display
  mapCoordinates.textContent = `Latitude: ${lat.toFixed(4)}, Longitude: ${lng.toFixed(4)}`;
  currentLocation = { lat, lng };
}

// Main IP tracking function
async function trackIP() {
  const inputIP = ipInput.value.trim();
  
  // Show loading state
  setLoadingState(true);
  
  try {
    let ipToTrack = inputIP;
    
    // If no IP provided, get user's IP
    if (!ipToTrack) {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      ipToTrack = ipData.ip;
    }
    
    // Validate IP format (basic validation)
    if (!isValidIP(ipToTrack)) {
      throw new Error('Invalid IP address format');
    }
    
    // Fetch geolocation data
    const geoResponse = await fetch(`https://get.geojs.io/v1/ip/geo/${ipToTrack}.json`);
    
    if (!geoResponse.ok) {
      throw new Error('Failed to fetch geolocation data');
    }
    
    const geoData = await geoResponse.json();
    
    // Check if we have valid location data
    if (!geoData.latitude || !geoData.longitude) {
      throw new Error('No location data available for this IP');
    }
    
    // Update UI with fetched data
    updateUI(geoData);
    
    // Initialize or update map
    const lat = parseFloat(geoData.latitude);
    const lng = parseFloat(geoData.longitude);
    
    if (!map) {
      initMap(lat, lng);
    } else {
      map.setView([lat, lng], 13);
      updateMarker(lat, lng, geoData.ip);
    }
    
    // Add to search history
    addToHistory(geoData);
    
    // Show success message
    showMessage(`Successfully tracked IP: ${geoData.ip}`, 'success');
    
  } catch (error) {
    console.error('Error tracking IP:', error);
    showMessage(`Error: ${error.message}`, 'error');
    
    // Fallback to default view if no map exists
    if (!map) {
      initMap(0, 0);
    }
  } finally {
    setLoadingState(false);
  }
}

// Locate user's current position
async function locateMe() {
  if (!navigator.geolocation) {
    showMessage('Geolocation is not supported by your browser', 'error');
    return;
  }
  
  setLoadingState(true);
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        
        // Reverse geocode to get IP/address info (using a free service)
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const data = await response.json();
        
        // Create a mock geoData object
        const mockGeoData = {
          ip: 'Current Location',
          city: data.address.city || data.address.town || data.address.village || 'Unknown',
          region: data.address.state || 'Unknown',
          country: data.address.country || 'Unknown',
          country_code: data.address.country_code ? data.address.country_code.toUpperCase() : 'XX',
          organization: 'Your Current Location',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          isCurrentLocation: true
        };
        
        // Update UI
        updateUI(mockGeoData);
        
        // Update map
        if (!map) {
          initMap(latitude, longitude);
        } else {
          map.setView([latitude, longitude], 15);
          updateMarker(latitude, longitude, 'You are here');
        }
        
        showMessage('Located your current position!', 'success');
        
      } catch (error) {
        console.error('Error with reverse geocoding:', error);
        showMessage('Could not get address details for your location', 'error');
      } finally {
        setLoadingState(false);
      }
    },
    (error) => {
      setLoadingState(false);
      showMessage(`Geolocation error: ${error.message}`, 'error');
    },
    { timeout: 10000 }
  );
}

// Update UI with geolocation data
function updateUI(data) {
  ipField.textContent = data.ip;
  locationField.textContent = `${data.city || 'Unknown'}, ${data.region || 'Unknown'}`;
  countryField.textContent = `${data.country || 'Unknown'} ${data.country_code ? `(${data.country_code})` : ''}`;
  ispField.textContent = data.organization || 'Unknown';
  timezoneField.textContent = data.timezone || 'Unknown';
  coordinatesField.textContent = `${data.latitude || '0'}, ${data.longitude || '0'}`;
}

// Add search to history
function addToHistory(geoData) {
  const historyItem = {
    ip: geoData.ip,
    city: geoData.city,
    region: geoData.region,
    country: geoData.country,
    timestamp: new Date().toISOString(),
    latitude: geoData.latitude,
    longitude: geoData.longitude
  };
  
  // Add to beginning of array
  searchHistory.unshift(historyItem);
  
  // Keep only last 10 searches
  if (searchHistory.length > 10) {
    searchHistory = searchHistory.slice(0, 10);
  }
  
  // Save to localStorage
  localStorage.setItem('ipHistory', JSON.stringify(searchHistory));
  
  // Update history display
  renderHistory();
}

// Render search history
function renderHistory() {
  if (searchHistory.length === 0) {
    searchHistoryContainer.innerHTML = '<p class="empty-history">No recent searches yet. Your searches will appear here.</p>';
    return;
  }
  
  searchHistoryContainer.innerHTML = '';
  
  searchHistory.forEach((item, index) => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    const timeAgo = getTimeAgo(new Date(item.timestamp));
    
    historyItem.innerHTML = `
      <div>
        <div class="history-ip">${item.ip}</div>
        <div class="history-location">${item.city}, ${item.region}, ${item.country}</div>
        <div class="history-time">${timeAgo}</div>
      </div>
      <div class="history-actions">
        <button onclick="searchHistoryItem(${index})">View Again</button>
      </div>
    `;
    
    searchHistoryContainer.appendChild(historyItem);
  });
}

// Search from history
function searchHistoryItem(index) {
  const item = searchHistory[index];
  ipInput.value = item.ip;
  trackIP();
}

// Utility: Get time ago string
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Utility: Validate IP address
function isValidIP(ip) {
  // Allow empty for auto-detection
  if (!ip) return true;
  
  // IPv4 pattern
  const ipv4Pattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
}

// Show message
function showMessage(message, type = 'info') {
  // Remove any existing message
  const existingMessage = document.querySelector('.message');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}-message`;
  messageDiv.textContent = message;
  
  // Add to page
  document.querySelector('.search-container').appendChild(messageDiv);
  
  // Remove after 5 seconds
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.remove();
    }
  }, 5000);
}

// Set loading state
function setLoadingState(isLoading) {
  if (isLoading) {
    trackBtn.innerHTML = '<div class="loading"></div> Tracking...';
    trackBtn.disabled = true;
    locateBtn.disabled = true;
  } else {
    trackBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Track IP';
    trackBtn.disabled = false;
    locateBtn.disabled = false;
  }
}

// Allow Enter key to trigger search
ipInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    trackIP();
  }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize map with default view
  initMap(0, 0);
  
  // Render search history
  renderHistory();
  
  // Try to auto-detect user's IP on first load
  setTimeout(() => {
    if (!ipInput.value) {
      trackIP();
    }
  }, 1000);
});

// Add CSS for custom marker
const style = document.createElement('style');
style.textContent = `
  .custom-marker-container {
    background: transparent;
    border: none;
  }
  
  .custom-marker {
    position: relative;
    color: #ef4444;
    font-size: 2.5rem;
    text-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
    filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.5));
  }
  
  .marker-ip {
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    background: #3b82f6;
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.7rem;
    white-space: nowrap;
    font-weight: 600;
  }
  
  .leaflet-popup-content {
    font-family: 'Poppins', sans-serif;
  }
  
  .leaflet-popup-content-wrapper {
    border-radius: 12px;
  }
  
  .message {
    padding: 1rem;
    border-radius: 12px;
    text-align: center;
    margin: 1rem 0;
    animation: fadeIn 0.3s;
  }
  
  .success-message {
    background: #10b981;
    color: white;
  }
  
  .error-message {
    background: #ef4444;
    color: white;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);