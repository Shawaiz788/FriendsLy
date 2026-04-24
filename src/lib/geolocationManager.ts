// geolocationManager.ts

// Helper functions for geolocation API usage with error handling and user guidance

/**
 * Check if Geolocation is supported by the browser.
 * @returns {boolean} True if supported, else false.
 */
function isGeolocationSupported() {
    return 'geolocation' in navigator;
}

/**
 * Get current position using Geolocation API.
 * @returns {Promise<GeolocationPosition>} A promise that resolves with the position object.
 */
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!isGeolocationSupported()) {
            reject('Geolocation is not supported by this browser.');
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, (error) => {
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    reject('User denied the request for Geolocation.');
                    break;
                case error.POSITION_UNAVAILABLE:
                    reject('Location information is unavailable.');
                    break;
                case error.TIMEOUT:
                    reject('The request to get user location timed out.');
                    break;
                case error.UNKNOWN_ERROR:
                    reject('An unknown error occurred.');
                    break;
            }
        });
    });
}

/**
 * Example usage of getCurrentPosition function and handling errors.
 */
async function exampleUsage() {
    try {
        const position = await getCurrentPosition();
        console.log(`Latitude: ${position.coords.latitude}, Longitude: ${position.coords.longitude}`);
    } catch (error) {
        console.error(error);
        alert(error); // Alert user about the error
    }
}

// Exporting functions for external usage
export { isGeolocationSupported, getCurrentPosition, exampleUsage };